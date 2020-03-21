// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This files uses setState().
/* eslint-disable react/no-set-state */

import url from 'url';

import React from 'react';
import PropTypes from 'prop-types';
import {CSSTransition, TransitionGroup} from 'react-transition-group';
import {Grid, Row} from 'react-bootstrap';
import DotsVerticalIcon from 'mdi-react/DotsVerticalIcon';

import {ipcRenderer, remote} from 'electron';

import Utils from '../../utils/util';

import restoreButton from '../../assets/titlebar/chrome-restore.svg';
import maximizeButton from '../../assets/titlebar/chrome-maximize.svg';
import minimizeButton from '../../assets/titlebar/chrome-minimize.svg';
import closeButton from '../../assets/titlebar/chrome-close.svg';

import LoginModal from './LoginModal.jsx';
import MattermostView from './MattermostView.jsx';
import TabBar from './TabBar.jsx';
import HoveringURL from './HoveringURL.jsx';
import Finder from './Finder.jsx';
import NewTeamModal from './NewTeamModal.jsx';
import SelectCertificateModal from './SelectCertificateModal.jsx';

export default class MainPage extends React.Component {
  constructor(props) {
    super(props);

    let key = this.props.teams.findIndex((team) => team.order === this.props.initialIndex);
    if (this.props.deeplinkingUrl !== null) {
      const parsedDeeplink = this.parseDeeplinkURL(this.props.deeplinkingUrl);
      if (parsedDeeplink) {
        key = parsedDeeplink.teamIndex;
      }
    }

    this.topBar = React.createRef();

    this.state = {
      key,
      sessionsExpired: new Array(this.props.teams.length),
      unreadCounts: new Array(this.props.teams.length),
      mentionCounts: new Array(this.props.teams.length),
      unreadAtActive: new Array(this.props.teams.length),
      mentionAtActiveCounts: new Array(this.props.teams.length),
      loginQueue: [],
      targetURL: '',
      certificateRequests: [],
      maximized: false,
    };
  }

  parseDeeplinkURL(deeplink, teams = this.props.teams) {
    if (deeplink && Array.isArray(teams) && teams.length) {
      const deeplinkURL = url.parse(deeplink);
      let parsedDeeplink = null;
      teams.forEach((team, index) => {
        const teamURL = url.parse(team.url);
        if (deeplinkURL.host === teamURL.host) {
          parsedDeeplink = {
            teamURL,
            teamIndex: index,
            originalURL: deeplinkURL,
            url: `${teamURL.protocol}//${teamURL.host}${deeplinkURL.pathname}`,
            path: deeplinkURL.pathname,
          };
        }
      });
      return parsedDeeplink;
    }
    return null;
  }

  getTabWebContents(index = this.state.key || 0, teams = this.props.teams) {
    const allWebContents = remote.webContents.getAllWebContents();
    const openDevTools = allWebContents.find((webContents) => webContents.getURL().includes('chrome-devtools') && webContents.isFocused());
    if (openDevTools) {
      return openDevTools;
    }

    if (this.state.showNewTeamModal) {
      const indexURL = '/browser/index.html';
      return allWebContents.find((webContents) => webContents.getURL().includes(indexURL));
    }

    if (!teams || !teams.length || index > teams.length) {
      return null;
    }
    const tabURL = teams[index].url;
    if (!tabURL) {
      return null;
    }
    return allWebContents.find((webContents) => webContents.getURL().includes(tabURL) || webContents.getURL().includes(this.refs[`mattermostView${index}`].getSrc()));
  }

  componentDidMount() {
    const self = this;

    // Due to a bug in Chrome on macOS, mousemove events from the webview won't register when the webview isn't in focus,
    // thus you can't drag tabs unless you're right on the container.
    // this makes it so your tab won't get stuck to your cursor no matter where you mouse up
    if (process.platform === 'darwin') {
      self.topBar.current.addEventListener('mouseleave', () => {
        if (event.target === self.topBar.current) {
          const upEvent = document.createEvent('MouseEvents');
          upEvent.initMouseEvent('mouseup');
          document.dispatchEvent(upEvent);
        }
      });

      // Hack for when it leaves the electron window because apparently mouseleave isn't good enough there...
      self.topBar.current.addEventListener('mousemove', () => {
        if (event.clientY === 0 || event.clientX === 0 || event.clientX >= window.innerWidth) {
          const upEvent = document.createEvent('MouseEvents');
          upEvent.initMouseEvent('mouseup');
          document.dispatchEvent(upEvent);
        }
      });
    }

    ipcRenderer.on('login-request', (event, request, authInfo) => {
      self.setState({
        loginRequired: true,
      });
      const loginQueue = self.state.loginQueue;
      loginQueue.push({
        request,
        authInfo,
      });
      self.setState({
        loginQueue,
      });
    });

    ipcRenderer.on('select-user-certificate', (_, origin, certificateList) => {
      const certificateRequests = self.state.certificateRequests;
      certificateRequests.push({
        server: origin,
        certificateList,
      });
      self.setState({
        certificateRequests,
      });
      if (certificateRequests.length === 1) {
        self.switchToTabForCertificateRequest(origin);
      }
    });

    // can't switch tabs sequentially for some reason...
    ipcRenderer.on('switch-tab', (event, key) => {
      const nextIndex = this.props.teams.findIndex((team) => team.order === key);
      this.handleSelect(nextIndex);
    });
    ipcRenderer.on('select-next-tab', () => {
      const currentOrder = this.props.teams[this.state.key].order;
      const nextOrder = ((currentOrder + 1) % this.props.teams.length);
      const nextIndex = this.props.teams.findIndex((team) => team.order === nextOrder);
      this.handleSelect(nextIndex);
    });

    ipcRenderer.on('select-previous-tab', () => {
      const currentOrder = this.props.teams[this.state.key].order;

      // js modulo operator returns a negative number if result is negative, so we have to ensure it's positive
      const nextOrder = ((this.props.teams.length + (currentOrder - 1)) % this.props.teams.length);
      const nextIndex = this.props.teams.findIndex((team) => team.order === nextOrder);
      this.handleSelect(nextIndex);
    });

    // reload the activated tab
    ipcRenderer.on('reload-tab', () => {
      this.refs[`mattermostView${this.state.key}`].reload();
    });
    ipcRenderer.on('clear-cache-and-reload-tab', () => {
      this.refs[`mattermostView${this.state.key}`].clearCacheAndReload();
    });

    function focusListener() {
      self.handleOnTeamFocused(self.state.key);
      self.refs[`mattermostView${self.state.key}`].focusOnWebView();
      self.setState({unfocused: false});
    }

    function blurListener() {
      self.setState({unfocused: true});
    }

    const currentWindow = remote.getCurrentWindow();
    currentWindow.on('focus', focusListener);
    currentWindow.on('blur', blurListener);
    window.addEventListener('beforeunload', () => {
      currentWindow.removeListener('focus', focusListener);
    });

    if (currentWindow.isMaximized()) {
      self.setState({maximized: true});
    }
    currentWindow.on('maximize', this.handleMaximizeState);
    currentWindow.on('unmaximize', this.handleMaximizeState);

    if (currentWindow.isFullScreen()) {
      self.setState({fullScreen: true});
    }
    currentWindow.on('enter-full-screen', this.handleFullScreenState);
    currentWindow.on('leave-full-screen', this.handleFullScreenState);

    // https://github.com/mattermost/desktop/pull/371#issuecomment-263072803
    currentWindow.webContents.on('devtools-closed', () => {
      focusListener();
    });

    ipcRenderer.on('open-devtool', () => {
      document.getElementById(`mattermostView${self.state.key}`).openDevTools();
    });

    ipcRenderer.on('zoom-in', () => {
      const activeTabWebContents = this.getTabWebContents(this.state.key);
      if (!activeTabWebContents) {
        return;
      }
      if (activeTabWebContents.getZoomLevel() >= 9) {
        return;
      }
      activeTabWebContents.setZoomLevel(activeTabWebContents.getZoomLevel() + 1);
    });

    ipcRenderer.on('zoom-out', () => {
      const activeTabWebContents = this.getTabWebContents(this.state.key);
      if (!activeTabWebContents) {
        return;
      }
      if (activeTabWebContents.getZoomLevel() <= -8) {
        return;
      }
      activeTabWebContents.setZoomLevel(activeTabWebContents.getZoomLevel() - 1);
    });

    ipcRenderer.on('zoom-reset', () => {
      const activeTabWebContents = this.getTabWebContents(this.state.key);
      if (!activeTabWebContents) {
        return;
      }
      activeTabWebContents.setZoomLevel(0);
    });

    ipcRenderer.on('undo', () => {
      const activeTabWebContents = this.getTabWebContents(this.state.key);
      if (!activeTabWebContents) {
        return;
      }
      activeTabWebContents.undo();
    });

    ipcRenderer.on('redo', () => {
      const activeTabWebContents = this.getTabWebContents(this.state.key);
      if (!activeTabWebContents) {
        return;
      }
      activeTabWebContents.redo();
    });

    ipcRenderer.on('cut', () => {
      const activeTabWebContents = this.getTabWebContents(this.state.key);
      if (!activeTabWebContents) {
        return;
      }
      activeTabWebContents.cut();
    });

    ipcRenderer.on('copy', () => {
      const activeTabWebContents = this.getTabWebContents(this.state.key);
      if (!activeTabWebContents) {
        return;
      }
      activeTabWebContents.copy();
    });

    ipcRenderer.on('paste', () => {
      const activeTabWebContents = this.getTabWebContents(this.state.key);
      if (!activeTabWebContents) {
        return;
      }
      activeTabWebContents.paste();
    });

    ipcRenderer.on('paste-and-match', () => {
      const activeTabWebContents = this.getTabWebContents(this.state.key);
      if (!activeTabWebContents) {
        return;
      }
      activeTabWebContents.pasteAndMatchStyle();
    });

    //goBack and goForward
    ipcRenderer.on('go-back', () => {
      const mattermost = self.refs[`mattermostView${self.state.key}`];
      if (mattermost.canGoBack()) {
        mattermost.goBack();
      }
    });

    ipcRenderer.on('go-forward', () => {
      const mattermost = self.refs[`mattermostView${self.state.key}`];
      if (mattermost.canGoForward()) {
        mattermost.goForward();
      }
    });

    ipcRenderer.on('add-server', () => {
      this.addServer();
    });

    ipcRenderer.on('focus-on-webview', () => {
      this.focusOnWebView();
    });

    ipcRenderer.on('protocol-deeplink', (event, deepLinkUrl) => {
      const parsedDeeplink = this.parseDeeplinkURL(deepLinkUrl);
      if (parsedDeeplink) {
        if (this.state.key !== parsedDeeplink.teamIndex) {
          this.handleSelect(parsedDeeplink.teamIndex);
        }
        self.refs[`mattermostView${parsedDeeplink.teamIndex}`].handleDeepLink(parsedDeeplink.path);
      }
    });

    ipcRenderer.on('toggle-find', () => {
      this.activateFinder(true);
    });

    if (process.platform === 'darwin') {
      self.setState({
        isDarkMode: remote.systemPreferences.isDarkMode(),
      });
      remote.systemPreferences.subscribeNotification('AppleInterfaceThemeChangedNotification', () => {
        self.setState({
          isDarkMode: remote.systemPreferences.isDarkMode(),
        });
      });
    } else {
      self.setState({
        isDarkMode: this.props.getDarkMode(),
      });

      ipcRenderer.on('set-dark-mode', () => {
        this.setDarkMode();
      });

      this.threeDotMenu = React.createRef();
      ipcRenderer.on('focus-three-dot-menu', () => {
        if (this.threeDotMenu.current) {
          this.threeDotMenu.current.focus();
        }
      });
    }
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.key !== this.state.key) { // i.e. When tab has been changed
      this.refs[`mattermostView${this.state.key}`].focusOnWebView();
    }
  }

  switchToTabForCertificateRequest = (origin) => {
    // origin is server name + port, if the port doesn't match the protocol, it is kept by URL
    const originURL = new URL(`http://${origin.split(':')[0]}`);
    const secureOriginURL = new URL(`https://${origin.split(':')[0]}`);

    const key = this.props.teams.findIndex((team) => {
      const parsedURL = new URL(team.url);
      return (parsedURL.origin === originURL.origin) || (parsedURL.origin === secureOriginURL.origin);
    });
    this.handleSelect(key);
  };

  handleInterTeamLink = (linkUrl) => {
    const selectedTeam = Utils.getServer(linkUrl, this.props.teams);
    if (!selectedTeam) {
      return;
    }
    this.refs[`mattermostView${selectedTeam.index}`].handleDeepLink(linkUrl.href);
    this.setState({key: selectedTeam.index});
  }

  handleMaximizeState = () => {
    const win = remote.getCurrentWindow();
    this.setState({maximized: win.isMaximized()});
  }

  handleFullScreenState = () => {
    const win = remote.getCurrentWindow();
    this.setState({fullScreen: win.isFullScreen()});
  }

  handleSelect = (key) => {
    const newKey = (this.props.teams.length + key) % this.props.teams.length;
    this.setState({
      key: newKey,
      finderVisible: false,
    });
    const webview = document.getElementById('mattermostView' + newKey);
    ipcRenderer.send('update-title', {
      title: webview.getTitle(),
    });
    window.focus();
    webview.focus();
    this.handleOnTeamFocused(newKey);
  }

  handleDragAndDrop = (dropResult) => {
    const {removedIndex, addedIndex} = dropResult;
    if (removedIndex !== addedIndex) {
      const teamIndex = this.props.moveTabs(removedIndex, addedIndex < this.props.teams.length ? addedIndex : this.props.teams.length - 1);
      this.handleSelect(teamIndex);
    }
  }

  handleBadgeChange = (index, sessionExpired, unreadCount, mentionCount, isUnread, isMentioned) => {
    const sessionsExpired = this.state.sessionsExpired;
    const unreadCounts = this.state.unreadCounts;
    const mentionCounts = this.state.mentionCounts;
    const unreadAtActive = this.state.unreadAtActive;
    const mentionAtActiveCounts = this.state.mentionAtActiveCounts;
    sessionsExpired[index] = sessionExpired;
    unreadCounts[index] = unreadCount;
    mentionCounts[index] = mentionCount;

    // Never turn on the unreadAtActive flag at current focused tab.
    if (this.state.key !== index || !remote.getCurrentWindow().isFocused()) {
      unreadAtActive[index] = unreadAtActive[index] || isUnread;
      if (isMentioned) {
        mentionAtActiveCounts[index]++;
      }
    }
    this.setState({
      sessionsExpired,
      unreadCounts,
      mentionCounts,
      unreadAtActive,
      mentionAtActiveCounts,
    });
    this.handleBadgesChange();
  }

  markReadAtActive = (index) => {
    const unreadAtActive = this.state.unreadAtActive;
    const mentionAtActiveCounts = this.state.mentionAtActiveCounts;
    unreadAtActive[index] = false;
    mentionAtActiveCounts[index] = 0;
    this.setState({
      unreadAtActive,
      mentionAtActiveCounts,
    });
    this.handleBadgesChange();
  }

  handleBadgesChange = () => {
    if (this.props.onBadgeChange) {
      const someSessionsExpired = this.state.sessionsExpired.some((sessionExpired) => sessionExpired);

      let allUnreadCount = this.state.unreadCounts.reduce((prev, curr) => {
        return prev + curr;
      }, 0);
      this.state.unreadAtActive.forEach((state) => {
        if (state) {
          allUnreadCount += 1;
        }
      });

      let allMentionCount = this.state.mentionCounts.reduce((prev, curr) => {
        return prev + curr;
      }, 0);
      this.state.mentionAtActiveCounts.forEach((count) => {
        allMentionCount += count;
      });

      this.props.onBadgeChange(someSessionsExpired, allUnreadCount, allMentionCount);
    }
  }

  handleOnTeamFocused = (index) => {
    // Turn off the flag to indicate whether unread message of active channel contains at current tab.
    this.markReadAtActive(index);
  }

  handleLogin = (request, username, password) => {
    ipcRenderer.send('login-credentials', request, username, password);
    const loginQueue = this.state.loginQueue;
    loginQueue.shift();
    this.setState({loginQueue});
  }

  handleLoginCancel = () => {
    const loginQueue = this.state.loginQueue;
    loginQueue.shift();
    this.setState({loginQueue});
  }

  handleTargetURLChange = (targetURL) => {
    clearTimeout(this.targetURLDisappearTimeout);
    if (targetURL === '') {
      // set delay to avoid momentary disappearance when hovering over multiple links
      this.targetURLDisappearTimeout = setTimeout(() => {
        this.setState({targetURL: ''});
      }, 500);
    } else {
      this.setState({targetURL});
    }
  }

  handleClose = () => {
    const win = remote.getCurrentWindow();
    win.close();
  }

  handleMinimize = () => {
    const win = remote.getCurrentWindow();
    win.minimize();
  }

  handleMaximize = () => {
    const win = remote.getCurrentWindow();
    win.maximize();
  }

  handleRestore = () => {
    const win = remote.getCurrentWindow();
    win.restore();
  }

  openMenu = () => {
    // @eslint-ignore
    this.threeDotMenu.current.blur();
    this.props.openMenu();
  }

  handleDoubleClick = () => {
    const doubleClickAction = remote.systemPreferences.getUserDefault('AppleActionOnDoubleClick', 'string');
    const win = remote.getCurrentWindow();
    if (doubleClickAction === 'Minimize') {
      win.minimize();
    } else if (doubleClickAction === 'Maximize' && !win.isMaximized()) {
      win.maximize();
    } else if (doubleClickAction === 'Maximize' && win.isMaximized()) {
      win.unmaximize();
    }
  }

  addServer = () => {
    this.setState({
      showNewTeamModal: true,
    });
  }

  focusOnWebView = () => {
    this.refs[`mattermostView${this.state.key}`].focusOnWebView();
  }

  activateFinder = () => {
    this.setState({
      finderVisible: true,
      focusFinder: true,
    });
  }

  closeFinder = () => {
    this.setState({
      finderVisible: false,
    });
  }

  inputBlur = () => {
    this.setState({
      focusFinder: false,
    });
  }

  handleSelectCertificate = (certificate) => {
    const certificateRequests = this.state.certificateRequests;
    const current = certificateRequests.shift();
    this.setState({certificateRequests});
    ipcRenderer.send('selected-client-certificate', current.server, certificate);
    if (certificateRequests.length > 0) {
      this.switchToTabForCertificateRequest(certificateRequests[0].server);
    }
  }
  handleCancelCertificate = () => {
    const certificateRequests = this.state.certificateRequests;
    const current = certificateRequests.shift();
    this.setState({certificateRequests});
    ipcRenderer.send('selected-client-certificate', current.server);
    if (certificateRequests.length > 0) {
      this.switchToTabForCertificateRequest(certificateRequests[0].server);
    }
  };
  setDarkMode() {
    this.setState({
      isDarkMode: this.props.setDarkMode(),
    });
  }

  render() {
    const self = this;
    const tabsRow = (
      <TabBar
        id='tabBar'
        isDarkMode={this.state.isDarkMode}
        teams={this.props.teams}
        sessionsExpired={this.state.sessionsExpired}
        unreadCounts={this.state.unreadCounts}
        mentionCounts={this.state.mentionCounts}
        unreadAtActive={this.state.unreadAtActive}
        mentionAtActiveCounts={this.state.mentionAtActiveCounts}
        activeKey={this.state.key}
        onSelect={this.handleSelect}
        onAddServer={this.addServer}
        showAddServerButton={this.props.showAddServerButton}
        onDrop={this.handleDragAndDrop}
      />
    );

    let topBarClassName = 'topBar';
    if (process.platform === 'darwin') {
      topBarClassName += ' macOS';
    }
    if (this.state.isDarkMode) {
      topBarClassName += ' darkMode';
    }
    if (this.state.fullScreen) {
      topBarClassName += ' fullScreen';
    }

    let maxButton;
    if (this.state.maximized) {
      maxButton = (
        <div
          className='button restore-button'
          onClick={this.handleRestore}
        >
          <img src={restoreButton}/>
        </div>
      );
    } else {
      maxButton = (
        <div
          className='button max-button'
          onClick={this.handleMaximize}
        >
          <img src={maximizeButton}/>
        </div>
      );
    }

    let overlayGradient;
    if (process.platform !== 'darwin') {
      overlayGradient = (
        <span className='overlay-gradient'/>
      );
    }

    let titleBarButtons;
    if (process.platform !== 'darwin') {
      titleBarButtons = (
        <span className='title-bar-btns'>
          <div
            className='button min-button'
            onClick={this.handleMinimize}
          >
            <img src={minimizeButton}/>
          </div>
          {maxButton}
          <div
            className='button close-button'
            onClick={this.handleClose}
          >
            <img src={closeButton}/>
          </div>
        </span>
      );
    }

    const topRow = (
      <Row
        className={topBarClassName}
        onDoubleClick={this.handleDoubleClick}
      >
        <div
          ref={this.topBar}
          className={`topBar-bg${this.state.unfocused ? ' unfocused' : ''}`}
        >
          <button
            className='three-dot-menu'
            onClick={this.openMenu}
            tabIndex={0}
            ref={this.threeDotMenu}
          >
            <DotsVerticalIcon/>
          </button>
          {tabsRow}
          {overlayGradient}
          {titleBarButtons}
        </div>
      </Row>
    );

    const views = this.props.teams.map((team, index) => {
      function handleBadgeChange(sessionExpired, unreadCount, mentionCount, isUnread, isMentioned) {
        self.handleBadgeChange(index, sessionExpired, unreadCount, mentionCount, isUnread, isMentioned);
      }
      function handleNotificationClick() {
        self.handleSelect(index);
      }
      const id = 'mattermostView' + index;
      const isActive = self.state.key === index;

      let teamUrl = team.url;

      if (this.props.deeplinkingUrl) {
        const parsedDeeplink = this.parseDeeplinkURL(this.props.deeplinkingUrl, [team]);
        if (parsedDeeplink) {
          teamUrl = parsedDeeplink.url;
        }
      }

      return (
        <MattermostView
          key={id}
          id={id}
          teams={this.props.teams}
          useSpellChecker={this.props.useSpellChecker}
          onSelectSpellCheckerLocale={this.props.onSelectSpellCheckerLocale}
          src={teamUrl}
          name={team.name}
          onTargetURLChange={self.handleTargetURLChange}
          onBadgeChange={handleBadgeChange}
          onNotificationClick={handleNotificationClick}
          handleInterTeamLink={self.handleInterTeamLink}
          ref={id}
          active={isActive}
        />);
    });
    const viewsRow = (
      <Row>
        {views}
      </Row>);

    let request = null;
    let authServerURL = null;
    let authInfo = null;
    if (this.state.loginQueue.length !== 0) {
      request = this.state.loginQueue[0].request;
      const tmpURL = url.parse(this.state.loginQueue[0].request.url);
      authServerURL = `${tmpURL.protocol}//${tmpURL.host}`;
      authInfo = this.state.loginQueue[0].authInfo;
    }
    const modal = (
      <NewTeamModal
        currentOrder={this.props.teams.length}
        show={this.state.showNewTeamModal}
        restoreFocus={false}
        onClose={() => {
          this.setState({
            showNewTeamModal: false,
          });
        }}
        onSave={(newTeam) => {
          this.props.localTeams.push(newTeam);
          this.props.onTeamConfigChange(this.props.localTeams, () => {
            self.setState({
              showNewTeamModal: false,
              key: this.props.teams.length - 1,
            });
          });
        }}
      />
    );
    return (
      <div
        className='MainPage'
        onClick={this.focusOnWebView}
      >
        <LoginModal
          show={this.state.loginQueue.length !== 0}
          request={request}
          authInfo={authInfo}
          authServerURL={authServerURL}
          onLogin={this.handleLogin}
          onCancel={this.handleLoginCancel}
        />
        <SelectCertificateModal
          certificateRequests={this.state.certificateRequests}
          onSelect={this.handleSelectCertificate}
          onCancel={this.handleCancelCertificate}
        />
        <Grid fluid={true}>
          { topRow }
          { viewsRow }
          { this.state.finderVisible ? (
            <Finder
              webviewKey={this.state.key}
              close={this.closeFinder}
              focusState={this.state.focusFinder}
              inputBlur={this.inputBlur}
            />
          ) : null}
        </Grid>
        <TransitionGroup>
          { (this.state.targetURL === '') ?
            null :
            <CSSTransition
              classNames='hovering'
              timeout={{enter: 300, exit: 500}}
            >
              <HoveringURL
                key='hoveringURL'
                targetURL={this.state.targetURL}
              />
            </CSSTransition>
          }
        </TransitionGroup>
        <div>
          { modal }
        </div>
      </div>
    );
  }
}

MainPage.propTypes = {
  onBadgeChange: PropTypes.func.isRequired,
  teams: PropTypes.array.isRequired,
  localTeams: PropTypes.array.isRequired,
  onTeamConfigChange: PropTypes.func.isRequired,
  initialIndex: PropTypes.number.isRequired,
  useSpellChecker: PropTypes.bool.isRequired,
  onSelectSpellCheckerLocale: PropTypes.func.isRequired,
  deeplinkingUrl: PropTypes.string,
  showAddServerButton: PropTypes.bool.isRequired,
  getDarkMode: PropTypes.func.isRequired,
  setDarkMode: PropTypes.func.isRequired,
  moveTabs: PropTypes.func.isRequired,
  openMenu: PropTypes.func.isRequired,
};

/* eslint-enable react/no-set-state */
