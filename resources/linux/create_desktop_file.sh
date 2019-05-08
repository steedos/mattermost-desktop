#!/bin/sh
set -e
WORKING_DIR=`pwd`
THIS_PATH=`readlink -f $0`
cd `dirname ${THIS_PATH}`
FULL_PATH=`pwd`
cd ${WORKING_DIR}
cat <<EOS > Steedos.desktop
[Desktop Entry]
Name=Steedos
Comment=Steedos Desktop application for Linux
Exec="${FULL_PATH}/steedos-desktop"
Terminal=false
Type=Application
Icon=${FULL_PATH}/icon.svg
Categories=Network;InstantMessaging;
EOS
chmod +x Steedos.desktop
