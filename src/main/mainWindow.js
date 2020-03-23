// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import fs from 'fs';
import path from 'path';

import {app, BrowserWindow} from 'electron';

import * as Validator from './Validator';

function saveWindowState(file, window) {
  const windowState = window.getBounds();
  windowState.maximized = window.isMaximized();
  try {
    fs.writeFileSync(file, JSON.stringify(windowState));
  } catch (e) {
    // [Linux] error happens only when the window state is changed before the config dir is created.
    console.log(e);
  }
}

function createMainWindow(config, options) {
  const defaultWindowWidth = 1000;
  const defaultWindowHeight = 700;
  const minimumWindowWidth = 400;
  const minimumWindowHeight = 240;

  // Create the browser window.
  const boundsInfoPath = path.join(app.getPath('userData'), 'bounds-info.json');
  let windowOptions;
  try {
    windowOptions = JSON.parse(fs.readFileSync(boundsInfoPath, 'utf-8'));
    windowOptions = Validator.validateBoundsInfo(windowOptions);
    if (!windowOptions) {
      throw new Error('Provided bounds info file does not validate, using defaults instead.');
    }
  } catch (e) {
    // Follow Electron's defaults, except for window dimensions which targets 1024x768 screen resolution.
    windowOptions = {width: defaultWindowWidth, height: defaultWindowHeight};
  }

  const {hideOnStartup, trayIconShown} = options;
  const {maximized: windowIsMaximized} = windowOptions;

  if (process.platform === 'linux') {
    windowOptions.icon = options.linuxAppIcon;
  }
  Object.assign(windowOptions, {
    title: app.getName(),
    fullscreenable: true,
    show: hideOnStartup || false,
    minWidth: minimumWindowWidth,
    minHeight: minimumWindowHeight,
    frame: false,
    fullscreen: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#fff', // prevents blurry text: https://electronjs.org/docs/faq#the-font-looks-blurry-what-is-this-and-what-can-i-do
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true,
      disableBlinkFeatures: 'Auxclick',
    },
  });

  const mainWindow = new BrowserWindow(windowOptions);
  mainWindow.deeplinkingUrl = options.deeplinkingUrl;

  const indexURL = global.isDev ? 'http://localhost:8080/browser/index.html' : `file://${app.getAppPath()}/browser/index.html`;
  mainWindow.loadURL(indexURL);

  // handle hiding the app when launched by auto-start
  if (hideOnStartup) {
    if (trayIconShown && process.platform !== 'darwin') {
      mainWindow.hide();
    } else {
      mainWindow.minimize();
    }
  }

  mainWindow.webContents.on('will-attach-webview', (event, webPreferences) => {
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = false;
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.webContents.setZoomLevel(0);

    // handle showing the window when not launched by auto-start
    // - when not configured to auto-start, immediately show contents and optionally maximize as needed
    if (!hideOnStartup) {
      mainWindow.show();
      if (windowIsMaximized) {
        mainWindow.maximize();
      }
    }
  });

  mainWindow.once('show', () => {
    // handle showing the app when hidden to the tray icon by auto-start
    // - optionally maximize the window as needed
    if (hideOnStartup && windowIsMaximized) {
      mainWindow.maximize();
    }
  });

  mainWindow.once('restore', () => {
    // handle restoring the window when minimized to the app icon by auto-start
    // - optionally maximize the window as needed
    if (hideOnStartup && windowIsMaximized) {
      mainWindow.maximize();
    }
  });

  mainWindow.webContents.on('will-attach-webview', (event, webPreferences) => {
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = false;
  });

  // App should save bounds when a window is closed.
  // However, 'close' is not fired in some situations(shutdown, ctrl+c)
  // because main process is killed in such situations.
  // 'blur' event was effective in order to avoid this.
  // Ideally, app should detect that OS is shutting down.
  mainWindow.on('blur', () => {
    saveWindowState(boundsInfoPath, mainWindow);
    mainWindow.blurWebView();
  });

  mainWindow.on('close', (event) => {
    if (global.willAppQuit) { // when [Ctrl|Cmd]+Q
      saveWindowState(boundsInfoPath, mainWindow);
    } else { // Minimize or hide the window for close button.
      event.preventDefault();
      function hideWindow(window) {
        window.blur(); // To move focus to the next top-level window in Windows
        window.hide();
      }
      switch (process.platform) {
      case 'win32':
        hideWindow(mainWindow);
        break;
      case 'linux':
        if (config.minimizeToTray) {
          hideWindow(mainWindow);
        } else {
          mainWindow.minimize();
        }
        break;
      case 'darwin':
        // need to leave fullscreen first, then hide the window
        if (mainWindow.isFullScreen()) {
          mainWindow.once('leave-full-screen', () => {
            hideWindow(mainWindow);
          });
          mainWindow.setFullScreen(false);
        } else {
          hideWindow(mainWindow);
        }
        break;
      default:
      }
    }
  });

  // Register keyboard shortcuts
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // Add Alt+Cmd+(Right|Left) as alternative to switch between servers
    if (process.platform === 'darwin') {
      if (input.alt && input.meta) {
        if (input.key === 'ArrowRight') {
          mainWindow.webContents.send('select-next-tab');
        }
        if (input.key === 'ArrowLeft') {
          mainWindow.webContents.send('select-previous-tab');
        }
      }
    }
  });

  return mainWindow;
}

export default createMainWindow;
