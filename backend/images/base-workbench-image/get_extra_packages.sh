#!/bin/bash

OWNER="FloWide"

PACKAGES=("streamlit_flowide" "flowide3d")
FILE_NAMES=("release.zip" "release.zip")


UNZIP_DIR="./temp_dist"
WHEELS_DIR="./wheel_files"

if [ -d $WHEELS_DIR ]; then
    rm -R $WHEELS_DIR
fi

mkdir $WHEELS_DIR
for i in ${!PACKAGES[@]}; do
    PACKAGE=${PACKAGES[$i]}
    FILE=${FILE_NAMES[$i]}
    echo "Getting package: ${PACKAGE}"
    echo "Target file: ${FILE}"
    if [ -d $UNZIP_DIR ]; then
        echo "Removing previous dist directory"
        rm -R $UNZIP_DIR
    fi
    API_URL="https://$GITHUB_TOKEN:@api.github.com/repos/$OWNER/$PACKAGE"
    ASSET_ID=$(curl $API_URL/releases/latest | jq -r '.assets[0].id')
    if [ $ASSET_ID = "null" ]; then
        echo "Couldn't get asset id for ${PACKAGE}"
        continue
    else
        echo "Asset ID: $ASSET_ID"
        if test -f "$FILE"; then
            rm -f $FILE
        fi
        curl -O -J -L -H "Accept: application/octet-stream" "$API_URL/releases/assets/$ASSET_ID"
        unzip $FILE -d $UNZIP_DIR
        files=$(find $UNZIP_DIR -name *.whl)
        for file in ${files[@]}; do
            echo "$file"
            cp "$file" "$WHEELS_DIR"
        done
        rm -R $UNZIP_DIR
        rm -f $FILE
    fi
done
