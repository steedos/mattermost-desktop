// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
/* eslint-disable global-require */

'use strict';

import {remote} from 'electron';

class NWWindow {
  get() {
    window.process.env.USERPROFILE = remote.app.getPath('downloads');
    window.process.env.__nwjs = true;
    return {};
  }
}

export function nwjsRequire(module) {
  switch (module) {
  case 'crypto':
    return require('crypto');
  case 'fs':
    return require('fs');
  case 'path':
    return require('path');
  case 'net':
    return require('net');
  case 'child_process':
    return require('child_process');
  case 'url':
    return require('url');
  case 'http':
    return require('http');
  case 'https':
    return require('https');
  default:
    return {};
  }
}

export default function initializeNWJS(window) {
  const hostname = window.location.hostname;
  if (hostname.endsWith('.steedos.com') ||
      hostname.endsWith('.steedos.cn') ||
      hostname.endsWith('steedos.ticp.net') ||
      hostname.endsWith('github.com') ||
      hostname.endsWith('localhost') ||
      hostname.endsWith('127.0.0.1')
  ) {
    window.nw = {};
    window.nw.remote = remote;
    window.nw.require = nwjsRequire;
    window.nw.Window = new NWWindow();
  }
}
