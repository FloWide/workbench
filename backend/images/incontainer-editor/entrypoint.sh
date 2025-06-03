#!/bin/bash

set -a
set -e
set -x
source $HOME/.bashrc
echo $PATH
if [ "$(id -u)" = "0" ]; then
    chown -R runner:runner ${HOME}
    exec gosu runner $@
else
    exec $@
fi