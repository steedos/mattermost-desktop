// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This file uses setState().
/* eslint-disable react/no-set-state */

import React from 'react';
import {Button, Checkbox, Col, FormGroup, Grid, HelpBlock, Navbar, Radio, Row} from 'react-bootstrap';

import {ipcRenderer, remote} from 'electron';
import {debounce} from 'underscore';

import Config from '../../common/config';

import TeamList from './TeamList.jsx';
import AutoSaveIndicator from './AutoSaveIndicator.jsx';

const CONFIG_TYPE_SERVERS = 'servers';
const CONFIG_TYPE_APP_OPTIONS = 'appOptions';

const config = new Config(remote.app.getPath('userData') + '/config.json', remote.getCurrentWindow().registryConfigData);

function backToIndex(index) {
  const target = typeof index === 'undefined' ? 0 : index;
  const indexURL = remote.getGlobal('isDev') ? 'http://localhost:8080/browser/index.html' : `file://${remote.app.getAppPath()}/browser/index.html`;
  remote.getCurrentWindow().loadURL(`${indexURL}?index=${target}`);
}

export default class SettingsPage extends React.Component {
  constructor(props) {
    super(props);

    this.state = this.convertConfigDataToState(config.data);

    this.trayIconThemeRef = React.createRef();

    this.saveQueue = [];
  }

  componentDidMount() {
    config.on('update', (configData) => {
      this.updateSaveState();
      this.setState(this.convertConfigDataToState(configData, this.state));
    });

    config.on('error', (error) => {
      console.log('Config saving error: ', error);

      const savingState = Object.assign({}, this.state.savingState);
      Object.entries(savingState).forEach(([configType, currentState]) => {
        if (currentState !== AutoSaveIndicator.SAVING_STATE_DONE) {
          savingState[configType] = AutoSaveIndicator.SAVING_STATE_ERROR;
          this.setState({savingState});
        }
      });
    });

    // when the config object changes here in the renderer process, tell the main process to reload its config object to get the changes
    config.on('synchronize', () => {
      ipcRenderer.send('reload-config');
    });

    // listen for any config reload requests from the main process to reload configuration changes here in the renderer process
    ipcRenderer.on('reload-config', () => {
      config.reload();
    });

    ipcRenderer.on('add-server', () => {
      this.setState({
        showAddTeamForm: true,
      });
    });

    ipcRenderer.on('switch-tab', (event, key) => {
      backToIndex(key);
    });
  }

  convertConfigDataToState = (configData, currentState = {}) => {
    const newState = Object.assign({}, configData);
    newState.showAddTeamForm = currentState.showAddTeamForm || false;
    newState.trayWasVisible = currentState.trayWasVisible || remote.getCurrentWindow().trayWasVisible;
    if (newState.teams.length === 0 && currentState.firstRun !== false) {
      newState.firstRun = false;
      newState.showAddTeamForm = true;
    }
    newState.savingState = currentState.savingState || {
      appOptions: AutoSaveIndicator.SAVING_STATE_DONE,
      servers: AutoSaveIndicator.SAVING_STATE_DONE,
    };
    return newState;
  }

  saveSetting = (configType, {key, data}) => {
    this.saveQueue.push({
      configType,
      key,
      data,
    });
    this.updateSaveState();
    this.processSaveQueue();
  }

  processSaveQueue = debounce(() => {
    config.setMultiple(this.saveQueue.splice(0, this.saveQueue.length));
  }, 500);

  updateSaveState = () => {
    let queuedUpdateCounts = {
      [CONFIG_TYPE_SERVERS]: 0,
      [CONFIG_TYPE_APP_OPTIONS]: 0,
    };

    queuedUpdateCounts = this.saveQueue.reduce((updateCounts, {configType}) => {
      updateCounts[configType]++;
      return updateCounts;
    }, queuedUpdateCounts);

    const savingState = Object.assign({}, this.state.savingState);

    Object.entries(queuedUpdateCounts).forEach(([configType, count]) => {
      if (count > 0) {
        savingState[configType] = AutoSaveIndicator.SAVING_STATE_SAVING;
      } else if (count === 0 && savingState[configType] === AutoSaveIndicator.SAVING_STATE_SAVING) {
        savingState[configType] = AutoSaveIndicator.SAVING_STATE_SAVED;
        this.resetSaveState(configType);
      }
    });

    this.setState({savingState});
  }

  resetSaveState = debounce((configType) => {
    if (this.state.savingState[configType] !== AutoSaveIndicator.SAVING_STATE_SAVING) {
      const savingState = Object.assign({}, this.state.savingState);
      savingState[configType] = AutoSaveIndicator.SAVING_STATE_DONE;
      this.setState({savingState});
    }
  }, 2000);

  handleTeamsChange = (teams) => {
    setImmediate(this.saveSetting, CONFIG_TYPE_SERVERS, {key: 'teams', data: teams});
    this.setState({
      showAddTeamForm: false,
      teams,
    });
    if (teams.length === 0) {
      this.setState({showAddTeamForm: true});
    }
  }

  handleCancel = () => {
    backToIndex();
  }

  handleChangeShowTrayIcon = () => {
    const shouldShowTrayIcon = !this.refs.showTrayIcon.props.checked;
    setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'showTrayIcon', data: shouldShowTrayIcon});
    this.setState({
      showTrayIcon: shouldShowTrayIcon,
    });

    if (process.platform === 'darwin' && !shouldShowTrayIcon) {
      this.setState({
        minimizeToTray: false,
      });
    }
  }

  handleChangeTrayIconTheme = (theme) => {
    setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'trayIconTheme', data: theme});
    this.setState({
      trayIconTheme: theme,
    });
  }

  handleChangeAutoStart = () => {
    setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'autostart', data: !this.refs.autostart.props.checked});
    this.setState({
      autostart: !this.refs.autostart.props.checked,
    });
  }

  handleChangeMinimizeToTray = () => {
    const shouldMinimizeToTray = this.state.showTrayIcon && !this.refs.minimizeToTray.props.checked;

    setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'minimizeToTray', data: shouldMinimizeToTray});
    this.setState({
      minimizeToTray: shouldMinimizeToTray,
    });
  }

  toggleShowTeamForm = () => {
    this.setState({
      showAddTeamForm: !this.state.showAddTeamForm,
    });
    document.activeElement.blur();
  }

  setShowTeamFormVisibility = (val) => {
    this.setState({
      showAddTeamForm: val,
    });
  }

  handleFlashWindow = () => {
    setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {
      key: 'notifications',
      data: {
        ...this.state.notifications,
        flashWindow: this.refs.flashWindow.props.checked ? 0 : 2,
      },
    });
    this.setState({
      notifications: {
        ...this.state.notifications,
        flashWindow: this.refs.flashWindow.props.checked ? 0 : 2,
      },
    });
  }

  handleBounceIcon = () => {
    setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {
      key: 'notifications',
      data: {
        ...this.state.notifications,
        bounceIcon: !this.refs.bounceIcon.props.checked,
      },
    });
    this.setState({
      notifications: {
        ...this.state.notifications,
        bounceIcon: !this.refs.bounceIcon.props.checked,
      },
    });
  }

  handleBounceIconType = (event) => {
    setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {
      key: 'notifications',
      data: {
        ...this.state.notifications,
        bounceIconType: event.target.value,
      },
    });
    this.setState({
      notifications: {
        ...this.state.notifications,
        bounceIconType: event.target.value,
      },
    });
  }

  handleShowUnreadBadge = () => {
    setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'showUnreadBadge', data: !this.refs.showUnreadBadge.props.checked});
    this.setState({
      showUnreadBadge: !this.refs.showUnreadBadge.props.checked,
    });
  }

  handleChangeUseSpellChecker = () => {
    setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'useSpellChecker', data: !this.refs.useSpellChecker.props.checked});
    this.setState({
      useSpellChecker: !this.refs.useSpellChecker.props.checked,
    });
  }

  handleChangeEnableHardwareAcceleration = () => {
    setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'enableHardwareAcceleration', data: !this.refs.enableHardwareAcceleration.props.checked});
    this.setState({
      enableHardwareAcceleration: !this.refs.enableHardwareAcceleration.props.checked,
    });
  }

  updateTeam = (index, newData) => {
    const teams = this.state.localTeams;
    teams[index] = newData;
    setImmediate(this.saveSetting, CONFIG_TYPE_SERVERS, {key: 'teams', data: teams});
    this.setState({
      teams,
    });
  }

  addServer = (team) => {
    const teams = this.state.localTeams;
    teams.push(team);
    setImmediate(this.saveSetting, CONFIG_TYPE_SERVERS, {key: 'teams', data: teams});
    this.setState({
      teams,
    });
  }

  render() {
    const settingsPage = {
      navbar: {
        backgroundColor: '#fff',
      },
      close: {
        textDecoration: 'none',
        position: 'absolute',
        right: '0',
        top: '5px',
        fontSize: '35px',
        fontWeight: 'normal',
        color: '#bbb',
      },
      heading: {
        textAlign: 'center',
        fontSize: '24px',
        margin: '0',
        padding: '1em 0',
      },
      sectionHeading: {
        fontSize: '20px',
        margin: '0',
        padding: '1em 0',
        float: 'left',
      },
      sectionHeadingLink: {
        marginTop: '24px',
        display: 'inline-block',
        fontSize: '15px',
      },
      footer: {
        padding: '0.4em 0',
      },
    };

    const teamsRow = (
      <Row>
        <Col md={12}>
          <TeamList
            teams={this.state.localTeams}
            showAddTeamForm={this.state.showAddTeamForm}
            toggleAddTeamForm={this.toggleShowTeamForm}
            setAddTeamFormVisibility={this.setShowTeamFormVisibility}
            onTeamsChange={this.handleTeamsChange}
            updateTeam={this.updateTeam}
            addServer={this.addServer}
            allowTeamEdit={this.state.enableTeamModification}
            onTeamClick={(index) => {
              backToIndex(index + this.state.buildTeams.length + this.state.registryTeams.length);
            }}
          />
        </Col>
      </Row>
    );

    const serversRow = (
      <Row>
        <Col
          md={10}
          xs={8}
        >
          <h2 style={settingsPage.sectionHeading}>{'服务器管理'}</h2>
          <div className='IndicatorContainer'>
            <AutoSaveIndicator
              id='serversSaveIndicator'
              savingState={this.state.savingState.servers}
              errorMessage={'保存失败，请稍后重试。'}
            />
          </div>
        </Col>
        <Col
          md={2}
          xs={4}
        >
          <p className='text-right'>
            <a
              style={settingsPage.sectionHeadingLink}
              id='addNewServer'
              href='#'
              onClick={this.toggleShowTeamForm}
            >{'⊞ 新增服务器'}</a>
          </p>
        </Col>
      </Row>
    );

    let srvMgmt;
    if (this.state.enableServerManagement === true) {
      srvMgmt = (
        <div>
          {serversRow}
          {teamsRow}
          <hr/>
        </div>
      );
    }

    const options = [];

    // MacOS has an option in the Dock, to set the app to autostart, so we choose to not support this option for OSX
    if (process.platform === 'win32' || process.platform === 'linux') {
      options.push(
        <Checkbox
          key='inputAutoStart'
          id='inputAutoStart'
          ref='autostart'
          checked={this.state.autostart}
          onChange={this.handleChangeAutoStart}
        >
          {'启动时自动加载'}
          <HelpBlock>
            {'如果启用，登录时系统会自动运行此应用。'}
            {' '}
            {'应用自动启动时会最小化并显示在任务栏中。'}
          </HelpBlock>
        </Checkbox>);
    }

    // options.push(
    //   <Checkbox
    //     key='inputSpellChecker'
    //     id='inputSpellChecker'
    //     ref='useSpellChecker'
    //     checked={this.state.useSpellChecker}
    //     onChange={this.handleChangeUseSpellChecker}
    //   >
    //     {'Check spelling'}
    //     <HelpBlock>
    //       {'Highlight misspelled words in your messages.'}
    //       {' Available for English, French, German, Portuguese, Spanish, and Dutch.'}
    //     </HelpBlock>
    //   </Checkbox>);

    if (process.platform === 'darwin' || process.platform === 'win32') {
      const TASKBAR = process.platform === 'win32' ? '任务栏' : '程序坞';
      options.push(
        <Checkbox
          key='inputShowUnreadBadge'
          id='inputShowUnreadBadge'
          ref='showUnreadBadge'
          checked={this.state.showUnreadBadge}
          onChange={this.handleShowUnreadBadge}
        >
          {`有未读消息时在 ${TASKBAR} 显示红色提醒图标`}
          <HelpBlock>
            {`此设置只对未读消息生效，当有未读提及时，${TASKBAR} 始终会显示红色提醒图标。`}
          </HelpBlock>
        </Checkbox>);
    }

    if (process.platform === 'win32' || process.platform === 'linux') {
      options.push(
        <Checkbox
          key='flashWindow'
          id='inputflashWindow'
          ref='flashWindow'
          checked={this.state.notifications.flashWindow === 2}
          onChange={this.handleFlashWindow}
        >
          {'收到新消息时，闪烁应用程序窗口和任务栏图标'}
          <HelpBlock>
            {'如果启用，当收到新消息时，应用程序窗口和任务栏图标会自动闪烁一段时间。'}
          </HelpBlock>
        </Checkbox>);
    }

    if (process.platform === 'darwin') {
      options.push(
        <FormGroup>
          <Checkbox
            inline={true}
            key='bounceIcon'
            id='inputBounceIcon'
            ref='bounceIcon'
            checked={this.state.notifications.bounceIcon}
            onChange={this.handleBounceIcon}
            style={{marginRight: '10px'}}
          >
            {'程序坞图标弹跳'}
          </Checkbox>
          <Radio
            inline={true}
            name='bounceIconType'
            value='informational'
            disabled={!this.state.notifications.bounceIcon}
            defaultChecked={
              !this.state.notifications.bounceIconType ||
              this.state.notifications.bounceIconType === 'informational'
            }
            onChange={this.handleBounceIconType}
          >
            {'一次'}
          </Radio>
          {' '}
          <Radio
            inline={true}
            name='bounceIconType'
            value='critical'
            disabled={!this.state.notifications.bounceIcon}
            defaultChecked={this.state.notifications.bounceIconType === 'critical'}
            onChange={this.handleBounceIconType}
          >
            {'直到我打开应用'}
          </Radio>
          <HelpBlock
            style={{marginLeft: '20px'}}
          >
            {'如果启用，当收到新消息时，程序坞中的应用图标会一直弹跳直到用户打开应用。'}
          </HelpBlock>
        </FormGroup>
      );
    }

    if (process.platform === 'darwin' || process.platform === 'linux') {
      options.push(
        <Checkbox
          key='inputShowTrayIcon'
          id='inputShowTrayIcon'
          ref='showTrayIcon'
          checked={this.state.showTrayIcon}
          onChange={this.handleChangeShowTrayIcon}
        >
          {process.platform === 'darwin' ? `在菜单栏显示 ${remote.app.getName()} 图标` : '在通知区域显示提醒图标'}
          <HelpBlock>
            {'更改此设置需要重新启动应用才会生效。'}
          </HelpBlock>
        </Checkbox>);
    }

    if (process.platform === 'linux') {
      options.push(
        <FormGroup
          key='trayIconTheme'
          ref={this.trayIconThemeRef}
          style={{marginLeft: '20px'}}
        >
          {'Icon theme: '}
          <Radio
            inline={true}
            name='trayIconTheme'
            value='light'
            defaultChecked={this.state.trayIconTheme === 'light' || this.state.trayIconTheme === ''}
            onChange={(event) => this.handleChangeTrayIconTheme('light', event)}
          >
            {'Light'}
          </Radio>
          {' '}
          <Radio
            inline={true}
            name='trayIconTheme'
            value='dark'
            defaultChecked={this.state.trayIconTheme === 'dark'}
            onChange={(event) => this.handleChangeTrayIconTheme('dark', event)}
          >{'Dark'}</Radio>
        </FormGroup>
      );
    }

    if (process.platform === 'linux') {
      options.push(
        <Checkbox
          key='inputMinimizeToTray'
          id='inputMinimizeToTray'
          ref='minimizeToTray'
          disabled={!this.state.showTrayIcon || !this.state.trayWasVisible}
          checked={this.state.minimizeToTray}
          onChange={this.handleChangeMinimizeToTray}
        >
          {'Leave app running in notification area when application window is closed'}
          <HelpBlock>
            {'If enabled, the app stays running in the notification area after app window is closed.'}
            {this.state.trayWasVisible || !this.state.showTrayIcon ? '' : ' Setting takes effect after restarting the app.'}
          </HelpBlock>
        </Checkbox>);
    }

    options.push(
      <Checkbox
        key='inputEnableHardwareAcceleration'
        id='inputEnableHardwareAcceleration'
        ref='enableHardwareAcceleration'
        checked={this.state.enableHardwareAcceleration}
        onChange={this.handleChangeEnableHardwareAcceleration}
      >
        {'使用 GPU 硬件加速'}
        <HelpBlock>
          {'如果启用，华信将会运行的更快，但是在某些系统下也可能会运行不稳定。'}
          {' 更改此设置需要重新启动应用才会生效。'}
        </HelpBlock>
      </Checkbox>
    );

    const optionsRow = (options.length > 0) ? (
      <Row>
        <Col md={12}>
          <h2 style={settingsPage.sectionHeading}>{'客户端选项'}</h2>
          <div className='IndicatorContainer'>
            <AutoSaveIndicator
              id='appOptionsSaveIndicator'
              savingState={this.state.savingState.appOptions}
              errorMessage={'保存失败，请稍后重试。'}
            />
          </div>
          { options.map((opt, i) => (
            <FormGroup key={`fromGroup${i}`}>
              {opt}
            </FormGroup>
          )) }
        </Col>
      </Row>
    ) : null;

    return (
      <div>
        <Navbar
          className='navbar-fixed-top'
          style={settingsPage.navbar}
        >
          <div style={{position: 'relative'}}>
            <h1 style={settingsPage.heading}>{'设置'}</h1>
            <Button
              id='btnClose'
              className='CloseButton'
              bsStyle='link'
              style={settingsPage.close}
              onClick={this.handleCancel}
              disabled={this.state.teams.length === 0}
            >
              <span>{'×'}</span>
            </Button>
          </div>
        </Navbar>
        <Grid
          className='settingsPage'
          style={{paddingTop: '100px'}}
        >
          { srvMgmt }
          { optionsRow }
        </Grid>
      </div>
    );
  }
}

/* eslint-enable react/no-set-state */
