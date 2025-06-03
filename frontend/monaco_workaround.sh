#!/bin/bash

# Copies all monaco css and font to assets folder

find node_modules/monaco-editor/esm/ -name "*.css" | while read css_file; do
cat $css_file >> src/assets/monaco.css
done

find node_modules/monaco-editor/esm/ -name "*codicon.ttf" | while read file; do
cp $file src/assets/
done