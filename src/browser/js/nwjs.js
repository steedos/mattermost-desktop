// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

'use strict';

import {remote} from 'electron';

class NWWindow {
  get() {
    window.process.env.USERPROFILE = remote.app.getPath('downloads');
    window.process.env.__nwjs = true;
    return {};
  }
}

export default function initializeNodeRemote() {
  console.log(window.location);
  const hostname = window.location.hostname;
  if (hostname.endsWith('.steedos.com') ||
      hostname.endsWith('.steedos.cn') ||
      hostname.endsWith('steedos.ticp.net') ||
      hostname.endsWith('localhost') ||
      hostname.endsWith('127.0.0.1')
  ) {
    window.nw = {};
    window.nw.remote = remote;
    window.nw.require = remote.require;
    window.nw.Window = new NWWindow();
  }
}
