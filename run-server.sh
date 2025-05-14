#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd $DIR || (echo "error!"; exit 1)
VIRTUALIZE_ACTIVATE_VIA_SCRIPT=1 source ./activate

echo "starting https-director-server"
node --env-file config.env --env-file server/secrets.env server/https-director-server.js
# note: --env-file is a node 20.6+ thing
