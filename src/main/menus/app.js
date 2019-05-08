// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import {app, dialog, ipcMain, Menu, shell} from 'electron';

function createTemplate(mainWindow, config, isDev) {
  const settingsURL = isDev ? 'http://localhost:8080/browser/settings.html' : `file://${app.getAppPath()}/browser/settings.html`;

  const separatorItem = {
    type: 'separator',
  };

  const appName = app.getName();
  const firstMenuName = (process.platform === 'darwin') ? appName : '文件';
  const template = [];

  let platformAppMenu = process.platform === 'darwin' ? [{
    label: '关于 ' + appName,
    role: 'about',
    click() {
      dialog.showMessageBox(mainWindow, {
        buttons: ['好'],
        message: `${appName} 桌面客户端 ${app.getVersion()}`,
      });
    },
  }, separatorItem, {
    label: '偏好设置...',
    accelerator: 'CmdOrCtrl+,',
    click() {
      mainWindow.loadURL(settingsURL);
    },
  }] : [{
    label: '设置...',
    accelerator: 'CmdOrCtrl+,',
    click() {
      mainWindow.loadURL(settingsURL);
    },
  }];

  if (config.enableServerManagement === true) {
    platformAppMenu.push({
      label: '登录到另一个服务器',
      click() {
        mainWindow.webContents.send('add-server');
      },
    });
  }

  platformAppMenu = platformAppMenu.concat(process.platform === 'darwin' ? [
    separatorItem, {
      role: 'hide',
      label: '隐藏 ' + appName
    }, {
      role: 'hideothers',
      label: '隐藏其他'
    }, {
      role: 'unhide',
      label: '全部显示'
    }, separatorItem, {
      role: 'quit',
      label: '退出 ' + appName
    }] : [
    separatorItem, {
      role: 'quit',
      label: '退出 ' + appName,
      accelerator: 'CmdOrCtrl+Q',
      click() {
        app.quit();
      },
    }]
  );

  template.push({
    label: '&' + firstMenuName,
    submenu: [
      ...platformAppMenu,
    ],
  });
  template.push({
    label: '编辑',
    submenu: [{
      role: 'undo',
      label: '撤销',
    }, {
      role: 'redo',
      label: '重做',
    }, separatorItem, {
      role: 'cut',
      label: '剪切',
    }, {
      role: 'copy',
      label: '复制',
    }, {
      role: 'paste',
      label: '粘贴',
    }, {
      role: 'selectall',
      label: '全部选中',
    }],
  });
  template.push({
    label: '查看',
    submenu: [/*{
      label: '查找..',
      accelerator: 'CmdOrCtrl+F',
      click(item, focusedWindow) {
        focusedWindow.webContents.send('toggle-find');
      },
    }, */{
      label: '重新载入',
      accelerator: 'CmdOrCtrl+R',
      click(item, focusedWindow) {
        if (focusedWindow) {
          if (focusedWindow === mainWindow) {
            mainWindow.webContents.send('reload-tab');
          } else {
            focusedWindow.reload();
          }
        }
      },
    }, {
      role: 'togglefullscreen',
      label: '进入全屏幕',
    }, separatorItem, {
      role: 'resetzoom',
      label: '实际大小',
    }, {
      label: '放大',
      role: 'zoomin',
    }, {
      label: '放大 (隐藏)',
      accelerator: 'CmdOrCtrl+=',
      visible: false,
      role: 'zoomin',
    }, {
      label: '缩小',
      role: 'zoomout',
    }, {
      label: '缩小 (隐藏)',
      accelerator: 'CmdOrCtrl+Shift+-',
      visible: false,
      role: 'zoomout',
    }, separatorItem, {
      label: '开发工具（桌面客户端）',
      accelerator: (() => {
        if (process.platform === 'darwin') {
          return 'Alt+Command+I';
        }
        return 'Ctrl+Shift+I';
      })(),
      click(item, focusedWindow) {
        if (focusedWindow) {
          focusedWindow.toggleDevTools();
        }
      },
    }, {
      label: '开发工具（当前服务器）',
      click() {
        mainWindow.webContents.send('open-devtool');
      },
    }, {
      label: '清空缓存并重新载入',
      accelerator: 'Shift+CmdOrCtrl+R',
      click(item, focusedWindow) {
        if (focusedWindow) {
          if (focusedWindow === mainWindow) {
            mainWindow.webContents.send('clear-cache-and-reload-tab');
          } else {
            focusedWindow.webContents.session.clearCache(() => {
              focusedWindow.reload();
            });
          }
        }
      },
    }],
  });
  template.push({
    label: '历史记录',
    submenu: [{
      label: '返回',
      accelerator: process.platform === 'darwin' ? 'Cmd+[' : 'Alt+Left',
      click: (item, focusedWindow) => {
        if (focusedWindow === mainWindow) {
          mainWindow.webContents.send('go-back');
        } else if (focusedWindow.webContents.canGoBack()) {
          focusedWindow.goBack();
        }
      },
    }, {
      label: '前进',
      accelerator: process.platform === 'darwin' ? 'Cmd+]' : 'Alt+Right',
      click: (item, focusedWindow) => {
        if (focusedWindow === mainWindow) {
          mainWindow.webContents.send('go-forward');
        } else if (focusedWindow.webContents.canGoForward()) {
          focusedWindow.goForward();
        }
      },
    }],
  });

  const teams = config.teams;
  const windowMenu = {
    label: '窗口',
    submenu: [{
      role: 'minimize',
      label: '最小化',
    }, {
      role: 'close',
      label: '关闭',
    }, separatorItem, ...teams.slice(0, 9).map((team, i) => {
      return {
        label: team.name,
        accelerator: `CmdOrCtrl+${i + 1}`,
        click() {
          mainWindow.show(); // for OS X
          mainWindow.webContents.send('switch-tab', i);
        },
      };
    }), separatorItem, {
      label: '选择下一服务器',
      accelerator: 'Ctrl+Tab',
      click() {
        mainWindow.webContents.send('select-next-tab');
      },
      enabled: (teams.length > 1),
    }, {
      label: '选择前一服务器',
      accelerator: 'Ctrl+Shift+Tab',
      click() {
        mainWindow.webContents.send('select-previous-tab');
      },
      enabled: (teams.length > 1),
    }],
  };
  template.push(windowMenu);
  const submenu = [];
  if (config.helpLink) {
    submenu.push({
      label: '了解更多...',
      click() {
        shell.openExternal(config.helpLink);
      },
    });
    submenu.push(separatorItem);
  }
  submenu.push({
    label: `版本 ${app.getVersion()}`,
    enabled: false,
  });
  if (config.enableAutoUpdater) {
    submenu.push({
      label: '检查更新...',
      click() {
        ipcMain.emit('check-for-updates', true);
      },
    });
  }
  template.push({label: '帮助', submenu});
  return template;
}

function createMenu(mainWindow, config, isDev) {
  return Menu.buildFromTemplate(createTemplate(mainWindow, config, isDev));
}

export default {
  createMenu,
};
