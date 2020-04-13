// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This file uses setState().
/* eslint-disable react/no-set-state */

import url from 'url';

import React from 'react';
import PropTypes from 'prop-types';
import {ipcRenderer, remote, shell} from 'electron';
import log from 'electron-log';

import contextMenu from '../js/contextMenu';
import Utils from '../../utils/util';
import {protocols} from '../../../electron-builder.json';
const scheme = protocols[0].schemes[0];

import ErrorView from './ErrorView.jsx';

const preloadJS = `file://${remote.app.getAppPath()}/browser/webview/mattermost_bundle.js`;

const ERR_NOT_IMPLEMENTED = -11;
const U2F_EXTENSION_URL = 'chrome-extension://kmendfapggjehodndflmmgagdbamhnfd/u2f-comms.html';

const appIconURL = `file:///${remote.app.getAppPath()}/assets/appicon_48.png`;

const BWindow = require('electron').remote.BrowserWindow;

export default class MattermostView extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      errorInfo: null,
      isContextMenuAdded: false,
      reloadTimeoutID: null,
      isLoaded: false,
      basename: '/',
    };

    this.webviewRef = React.createRef();
  }

  handleUnreadCountChange = (sessionExpired, unreadCount, mentionCount, isUnread, isMentioned) => {
    if (this.props.onBadgeChange) {
      this.props.onBadgeChange(sessionExpired, unreadCount, mentionCount, isUnread, isMentioned);
    }
  }

  dispatchNotification = async (title, body, channel, teamId, silent) => {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      log.error('Notifications not granted');
      return;
    }
    const notification = new Notification(title, {
      body,
      tag: body,
      icon: appIconURL,
      requireInteraction: false,
      silent,
    });
    notification.onclick = () => {
      this.webviewRef.current.send('notification-clicked', {channel, teamId});
    };
    notification.onerror = () => {
      log.error('Notification failed to show');
    };
  }

  openBrowserWindow(url, options) {
    let optionsObj = {};
    if (!options){
      optionsObj = {width: 1200, height: 900, show: true, autoHideMenuBar: true};
    }else{
      optionsObj = options;
    }
    let win = new BWindow(optionsObj);
    win.on('closed', function() {
      win = null;
    });
    
    win.loadURL(url);
    win.show();
  }

  componentDidMount() {
    const self = this;
    const webview = this.webviewRef.current;
    webview.addEventListener('did-fail-load', (e) => {
      console.log(self.props.name, 'webview did-fail-load', e);
      if (e.errorCode === -3) { // An operation was aborted (due to user action).
        return;
      }
      if (e.errorCode === ERR_NOT_IMPLEMENTED && e.validatedURL === U2F_EXTENSION_URL) {
        // U2F device is not supported, but the guest page should fall back to PIN code in 2FA.
        // https://github.com/mattermost/desktop/issues/708
        return;
      }

      self.setState({
        errorInfo: e,
        isLoaded: true,
      });
      function reload() {
        window.removeEventListener('online', reload);
        self.reload();
      }
      if (navigator.onLine) {
        self.setState({
          reloadTimeoutID: setTimeout(reload, 30000),
        });
      } else {
        window.addEventListener('online', reload);
      }
    });

    // Open link in browserWindow. for example, attached files.
    webview.addEventListener('new-window', (e) => {
      if (!Utils.isValidURI(e.url)) {
        return;
      }
      const currentURL = url.parse(webview.getURL());
      const destURL = url.parse(e.url);
      if (destURL.protocol !== 'http:' && destURL.protocol !== 'https:' && destURL.protocol !== `${scheme}:`) {
        ipcRenderer.send('confirm-protocol', destURL.protocol, e.url);
        return;
      }

      if (Utils.isInternalURL(destURL, currentURL, this.state.basename)) {
        if (destURL.path.match(/^\/api\/v[3-4]\/public\/files\//)) {
          ipcRenderer.send('download-url', e.url);
        } else if (destURL.path.match(/^\/help\//)) {
          // continue to open special case internal urls in default browser
          shell.openExternal(e.url);
        } else if (Utils.isTeamUrl(this.props.src, e.url, true) || Utils.isPluginUrl(this.props.src, e.url)) {
          // New window should disable nodeIntegration.
          window.open(e.url, remote.app.getName(), 'nodeIntegration=no, contextIsolation=yes, show=yes');
        }else {
          // 使用BrowserWindow打开，不使用默认浏览器打开
          self.openBrowserWindow(e.url);
        }
      } else {
        const parsedURL = Utils.parseURL(e.url);
        const serverURL = Utils.getServer(parsedURL, this.props.teams);
        if (serverURL !== null && Utils.isTeamUrl(serverURL.url, parsedURL)) {
          this.props.handleInterTeamLink(parsedURL);
        } else {
          // if the link is external, use default os' application.
          ipcRenderer.send('confirm-protocol', destURL.protocol, e.url);
        }
      }
    });

    // 'dom-ready' means "content has been loaded"
    // So this would be emitted again when reloading a webview
    webview.addEventListener('dom-ready', () => {
      // webview.openDevTools();

      // Remove this once https://github.com/electron/electron/issues/14474 is fixed
      // - fixes missing cursor bug in electron
      // - only apply this focus fix if the current view is active
      if (this.props.active) {
        webview.blur();
        webview.focus();
      }
      if (!this.state.isContextMenuAdded) {
        contextMenu.setup(webview, {
          useSpellChecker: this.props.useSpellChecker,
          onSelectSpellCheckerLocale: (locale) => {
            if (this.props.onSelectSpellCheckerLocale) {
              this.props.onSelectSpellCheckerLocale(locale);
            }
            webview.send('set-spellchecker');
          },
        });
        this.setState({isContextMenuAdded: true});
      }
    });

    webview.addEventListener('update-target-url', (event) => {
      if (self.props.onTargetURLChange) {
        self.props.onTargetURLChange(event.url);
      }
    });

    webview.addEventListener('ipc-message', (event) => {
      switch (event.channel) {
      case 'onGuestInitialized':
        self.setState({
          isLoaded: true,
          basename: event.args[0] || '/',
        });
        break;
      case 'onBadgeChange': {
        self.handleUnreadCountChange(...event.args);
        break;
      }
      case 'dispatchNotification': {
        self.dispatchNotification(...event.args);
        break;
      }
      case 'onNotificationClick':
        self.props.onNotificationClick();
        break;
      case 'mouse-move':
        this.handleMouseMove(event.args[0]);
        break;
      case 'mouse-up':
        this.handleMouseUp();
        break;
      }
    });

    webview.addEventListener('page-title-updated', (event) => {
      if (self.props.active) {
        ipcRenderer.send('update-title', {
          title: event.title,
        });
      }
    });

    webview.addEventListener('console-message', (e) => {
      const message = `[${this.props.name}] ${e.message}`;
      switch (e.level) {
      case 0:
        console.log(message);
        break;
      case 1:
        console.warn(message);
        break;
      case 2:
        console.error(message);
        break;
      default:
        console.log(message);
        break;
      }
    });

    // start listening for user status updates from main
    ipcRenderer.on('user-activity-update', this.handleUserActivityUpdate);
    ipcRenderer.on('exit-fullscreen', this.handleExitFullscreen);
  }

  componentWillUnmount() {
    // stop listening for user status updates from main
    ipcRenderer.removeListener('user-activity-update', this.handleUserActivityUpdate);
    ipcRenderer.removeListener('exit-fullscreen', this.handleExitFullscreen);
  }

  reload = () => {
    clearTimeout(this.state.reloadTimeoutID);
    this.setState({
      errorInfo: null,
      reloadTimeoutID: null,
      isLoaded: false,
    });
    const webview = this.webviewRef.current;
    webview.reload();
  }

  clearCacheAndReload = () => {
    this.setState({
      errorInfo: null,
    });
    const webContents = this.webviewRef.current.getWebContents();
    webContents.session.clearCache(() => {
      webContents.reload();
    });
  }

  focusOnWebView = () => {
    const webview = this.webviewRef.current;
    const webContents = webview.getWebContents(); // webContents might not be created yet.
    if (webContents) {
      webview.focus();
      webContents.focus();
    }
  }

  handleMouseMove = (event) => {
    const moveEvent = document.createEvent('MouseEvents');
    moveEvent.initMouseEvent('mousemove', null, null, null, null, null, null, event.clientX, event.clientY);
    document.dispatchEvent(moveEvent);
  }

  handleMouseUp = () => {
    const upEvent = document.createEvent('MouseEvents');
    upEvent.initMouseEvent('mouseup');
    document.dispatchEvent(upEvent);
  }

  canGoBack = () => {
    const webview = this.webviewRef.current;
    return webview.getWebContents().canGoBack();
  }

  canGoForward = () => {
    const webview = this.webviewRef.current;
    return webview.getWebContents().canGoForward();
  }

  goBack = () => {
    const webview = this.webviewRef.current;
    webview.getWebContents().goBack();
  }

  goForward = () => {
    const webview = this.webviewRef.current;
    webview.getWebContents().goForward();
  }

  getSrc = () => {
    const webview = this.webviewRef.current;
    return webview.src;
  }

  handleDeepLink = (relativeUrl) => {
    const webview = this.webviewRef.current;
    webview.executeJavaScript(
      'history.pushState(null, null, "' + relativeUrl + '");'
    );
    webview.executeJavaScript(
      'dispatchEvent(new PopStateEvent("popstate", null));'
    );
  }

  handleUserActivityUpdate = (event, status) => {
    // pass user activity update to the webview
    this.webviewRef.current.send('user-activity-update', status);
  }

  handleExitFullscreen = () => {
    // pass exit fullscreen request to the webview
    this.webviewRef.current.send('exit-fullscreen');
  }

  render() {
    const errorView = this.state.errorInfo ? (
      <ErrorView
        id={this.props.id + '-fail'}
        className='errorView'
        errorInfo={this.state.errorInfo}
        active={this.props.active}
      />) : null;

    // Need to keep webview mounted when failed to load.
    const classNames = ['mattermostView'];
    if (this.props.withTab) {
      classNames.push('mattermostView-with-tab');
    }
    if (!this.props.active) {
      classNames.push('mattermostView-hidden');
    }

    const loadingImage = !this.state.errorInfo && this.props.active && !this.state.isLoaded ? (
      <div className='mattermostView-loadingScreen'>
        <img
          className='mattermostView-loadingImage'
          src='../assets/loading.gif'
          srcSet='../assets/loading.gif 1x, ../assets/loading@2x.gif 2x'
        />
      </div>
    ) : null;

    return (
      <div
        className={classNames.join(' ')}
      >
        { errorView }
        <webview
          id={this.props.id}
          preload={preloadJS}
          src={this.props.src}
          ref={this.webviewRef}
        />
        {/* { loadingImage } */}
      </div>);
  }
}

MattermostView.propTypes = {
  name: PropTypes.string,
  id: PropTypes.string,
  teams: PropTypes.array.isRequired,
  withTab: PropTypes.bool,
  onTargetURLChange: PropTypes.func,
  onBadgeChange: PropTypes.func,
  src: PropTypes.string,
  active: PropTypes.bool,
  useSpellChecker: PropTypes.bool,
  onSelectSpellCheckerLocale: PropTypes.func,
  handleInterTeamLink: PropTypes.func,
};

/* eslint-enable react/no-set-state */
