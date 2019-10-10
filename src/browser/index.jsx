// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import './css/index.css';

window.eval = global.eval = () => { // eslint-disable-line no-multi-assign, no-eval
  throw new Error('Sorry, Mattermost does not support window.eval() for security reasons.');
};

import url from 'url';

import React from 'react';
import ReactDOM from 'react-dom';
import {remote, ipcRenderer} from 'electron';

import Config from '../common/config';

import EnhancedNotification from './js/notification';
import MainPage from './components/MainPage.jsx';
import {createDataURL as createBadgeDataURL} from './js/badge';

Notification = EnhancedNotification; // eslint-disable-line no-global-assign, no-native-reassign

const config = new Config(remote.app.getPath('userData') + '/config.json', remote.getCurrentWindow().registryConfigData);

const teams = config.teams;

remote.getCurrentWindow().removeAllListeners('focus');

if (teams.length === 0) {
  remote.getCurrentWindow().loadFile('browser/settings.html');
}

const parsedURL = url.parse(window.location.href, true);
const initialIndex = parsedURL.query.index ? parseInt(parsedURL.query.index, 10) : 0;

let deeplinkingUrl = null;
if (!parsedURL.query.index || parsedURL.query.index === null) {
  deeplinkingUrl = remote.getCurrentWindow().deeplinkingUrl;
}

config.on('update', (configData) => {
  teams.splice(0, teams.length, ...configData.teams);
});

config.on('synchronize', () => {
  ipcRenderer.send('reload-config');
});

ipcRenderer.on('reload-config', () => {
  config.reload();
});

function showBadgeWindows(sessionExpired, unreadCount, mentionCount) {
  function sendBadge(dataURL, description) {
    // window.setOverlayIcon() does't work with NativeImage across remote boundaries.
    // https://github.com/atom/electron/issues/4011
    ipcRenderer.send('update-unread', {
      overlayDataURL: dataURL,
      description,
      sessionExpired,
      unreadCount,
      mentionCount,
    });
  }

  if (sessionExpired) {
    const dataURL = createBadgeDataURL('•');
    sendBadge(dataURL, 'Session Expired: Please sign in to continue receiving notifications.');
  } else if (mentionCount > 0) {
    const dataURL = createBadgeDataURL(mentionCount.toString());
    sendBadge(dataURL, 'You have unread mentions (' + mentionCount + ')');
  } else if (unreadCount > 0 && config.showUnreadBadge) {
    const dataURL = createBadgeDataURL('•');
    sendBadge(dataURL, 'You have unread channels (' + unreadCount + ')');
  } else {
    sendBadge(null, 'You have no unread messages');
  }
}

function showBadgeOSX(sessionExpired, unreadCount, mentionCount) {
  if (sessionExpired) {
    remote.app.dock.setBadge('•');
  } else if (mentionCount > 0) {
    remote.app.dock.setBadge(mentionCount.toString());
  } else if (unreadCount > 0 && config.showUnreadBadge) {
    remote.app.dock.setBadge('•');
  } else {
    remote.app.dock.setBadge('');
  }

  ipcRenderer.send('update-unread', {
    sessionExpired,
    unreadCount,
    mentionCount,
  });
}

function showBadgeLinux(sessionExpired, unreadCount, mentionCount) {
  if (remote.app.isUnityRunning()) {
    if (sessionExpired) {
      remote.app.setBadgeCount(mentionCount + 1);
    } else {
      remote.app.setBadgeCount(mentionCount);
    }
  }

  ipcRenderer.send('update-unread', {
    sessionExpired,
    unreadCount,
    mentionCount,
  });
}

function showBadge(sessionExpired, unreadCount, mentionCount) {
  switch (process.platform) {
  case 'win32':
    showBadgeWindows(sessionExpired, unreadCount, mentionCount);
    break;
  case 'darwin':
    showBadgeOSX(sessionExpired, unreadCount, mentionCount);
    break;
  case 'linux':
    showBadgeLinux(sessionExpired, unreadCount, mentionCount);
    break;
  }
}

function teamConfigChange(updatedTeams) {
  config.set('teams', updatedTeams);
}

function handleSelectSpellCheckerLocale(locale) {
  config.set('spellCheckerLocale', locale);
}

ReactDOM.render(
  <MainPage
    teams={teams}
    initialIndex={initialIndex}
    onBadgeChange={showBadge}
    onTeamConfigChange={teamConfigChange}
    useSpellChecker={config.useSpellChecker}
    onSelectSpellCheckerLocale={handleSelectSpellCheckerLocale}
    deeplinkingUrl={deeplinkingUrl}
    showAddServerButton={config.enableServerManagement}
  />,
  document.getElementById('content')
);

// Deny drag&drop navigation in mainWindow.
// Drag&drop is allowed in webview of index.html.
document.addEventListener('dragover', (event) => event.preventDefault());
document.addEventListener('drop', (event) => event.preventDefault());
