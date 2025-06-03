#!/bin/sh

chown 1000:1000 -R /data/public_http
chown 1000:1000 -R /data/shared_files


git config --global --add safe.directory "*"

exec $@