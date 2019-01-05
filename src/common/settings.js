// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
'use strict';

import fs from 'fs';

import path from 'path';

import WindowsRegistry from 'winreg';

import buildConfig from './config/buildConfig';

import defaultPreferences from './config/defaultPreferences';

import upgradePreferences from './config/upgradePreferences';

// appData is
// * On Windows: %APPDATA%
// * On GNU/Linux: $XDG_CONFIG_HOME or ~/.config
// * On macOS: ~/Library/Application Support
// userData is by default appData appended by the app name.
// Contrary to the popular belief, on Windows, AppData leads to AppData/Roaming.
// The config.json resides thus by default in
// C:/Users/<user>/AppData/Roaming/Mattermost/config.json
// But userData can be overridden by data-dir passed as argument to the
// final executable (all OS concerned).
let configFile;

let config;

let electronIpc;

let appBuildConfig;

function merge(base, target) {
  return Object.assign({}, base, target);
}

function loadDefault() {
  return JSON.parse(JSON.stringify(defaultPreferences));
}

function hasBuildConfigDefaultTeams(config) {
  return config.defaultTeams.length > 0;
}

function checkIsAddingServerPreventedByGPOHKLM() {

}

function manageTeamGPO() {
  var regKey;
  regKey = new WindowsRegistry({
    hive: WindowsRegistry.HKCU,
    key: '\\Software\\Policies\\Mattermost',
  });

  regKey.values(function(err, items /* array of RegistryItem */) {
    if (err) {
      console.log("No GPO defined at all.");
      return;
    }

    for (var i = 0; i < items.length; i++) {
      // Values are as hexadecimal in registry
      if (items[i].name === "PreventAddNewServer" && items[i].value === "0x1") {
        buildConfig.enableServerManagement = false;
        getDefaultServerListFromGPO(replaceServersByGPOServers);
        break;
      }
    }

    if (i === items.length) {
      regKey = new WindowsRegistry({
        hive: WindowsRegistry.HKLM,
        key: '\\Software\\Policies\\Mattermost',
      });
      regKey.values(function(err, items /* array of RegistryItem */) {
        if (err) {
          console.log("No GPO defined at all.");
          return;
        }

        for (var i = 0; i < items.length; i++) {
          // Values are as hexadecimal in registry
          if (items[i].name === "PreventAddNewServer" && items[i].value === "0x1") {
            buildConfig.enableServerManagement = false;
            getDefaultServerListFromGPO(replaceServersByGPOServers);
            break;
          }
        }
      });

      // Adding servers is not restricted by GPO. We can have our local servers
      // as well.
      if (i === items.length) {
        buildConfig.enableServerManagement = true;
        getDefaultServerListFromGPO(addNewServersFromGPOServers);
      }
    }
  });
}

function addNewServersFromGPOServers(servers) {
  var serversToAdd = [];
  for (var i = 0; i < servers.length; i++) {
    var server = {};
    server.name = servers[i].name;
    server.url = servers[i].value; 
    serversToAdd = serversToAdd.concat(server);
  }
  config.teams.push(serversToAdd);
  save(config);
  electronIpc.emit('update-config');
}

function replaceServersByGPOServers(servers) {
  var serversToAdd = [];
  for (var i = 0; i < servers.length; i++) {
    var server = {};
    server.name = servers[i].name;
    server.url = servers[i].value; 
    serversToAdd = serversToAdd.concat(server);
  }
  config.teams = serversToAdd;
  save(config);
  electronIpc.emit('update-config');
}

function getDefaultServerListFromGPOHKLM(servers, callback) {
  var regKey = new WindowsRegistry({
    hive: WindowsRegistry.HKLM,
    key:  '\\Software\\Policies\\Mattermost\\DefaultServerList'
  });
  regKey.values(function(err, items /* array of RegistryItem */) {
    if (err) {
      callback(servers);
      return;  
    }
    callback(servers.concat(items));
  });
}

function getDefaultServerListFromGPO(callback) {

  var regKey = new WindowsRegistry({
    hive: WindowsRegistry.HKCU,
    key:  '\\Software\\Policies\\Mattermost\\DefaultServerList'
  });
  regKey.values(function(err, items /* array of RegistryItem */) {
    getDefaultServerListFromGPOHKLM(items, callback);
  });
}

function upgrade(config) {
  return upgradePreferences(config);
}

function readFileSync(configFile) {
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  if (config.version === defaultPreferences.version) {
    const defaultConfig = loadDefault();
    return merge(defaultConfig, config);
  }
  return config;
}

function writeFile(configFile, config, callback) {
  if (config.version !== defaultPreferences.version) {
    throw new Error('version ' + config.version + ' is not equal to ' + defaultPreferences.version);
  }
  const data = JSON.stringify(config, null, '  ');
  fs.writeFile(configFile, data, 'utf8', callback);
}

function writeFileSync(configFile, config) {
  if (config.version !== defaultPreferences.version) {
    throw new Error('version ' + config.version + ' is not equal to ' + defaultPreferences.version);
  }

  const dir = path.dirname(configFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  const data = JSON.stringify(config, null, '  ');
  fs.writeFileSync(configFile, data, 'utf8');
}

function read() {
  return readFileSync(configFile);
}

function save(config) {
  writeFileSync(configFile, config);
}

function mergeDefaultTeams(servers) {
  const newServers = [];
  if (hasBuildConfigDefaultTeams(buildConfig)) {
    newServers.push(...JSON.parse(JSON.stringify(buildConfig.defaultTeams)));
  }
  if (buildConfig.enableServerManagement) {
    newServers.push(...JSON.parse(JSON.stringify(servers)));
  }
  return newServers;
}

function init(app, ipcMain) {
  configFile = app.getPath('userData') + '/config.json';
  electronIpc = ipcMain;
  appBuildConfig = buildConfig;

  try {
    config = readFileSync(configFile);
    if (config.version !== defaultPreferences.version) {
      config = upgrade(config)
      save(config);
    }

  } catch (e) {
    // The config file does not exist, load defaults
    console.log('Failed to read or upgrade config.json', e);
    config = loadDefault();
  
    // Append config only if we failed because we weren't able to read
    // the config file, not because we weren't able to write back changes to
    // the config file.
    if (!config.teams.length && config.defaultTeam) {
      config.teams.push(config.defaultTeam);
      save(config);
    }
  }

  if (process.platform == "win32") {
    manageTeamGPO();
  }

  if (config.enableHardwareAcceleration === false) {
    app.disableHardwareAcceleration();
  }

  return config;
}

export default {
  version: defaultPreferences.version,

  upgrade,
  read,
  save,

  readFileSync,
  writeFile,
  writeFileSync,

  loadDefault,

  mergeDefaultTeams,
  init
};
