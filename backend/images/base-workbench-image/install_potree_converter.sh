#!/bin/bash


curl -O -L https://github.com/potree/PotreeConverter/releases/download/2.1.1/PotreeConverter_2.1.1_x64_linux.zip
unzip PotreeConverter_2.1.1_x64_linux.zip -d ./potree
cp ./potree/PotreeConverter_linux_x64/PotreeConverter /usr/bin
chmod +x /usr/bin/PotreeConverter
cp ./potree/PotreeConverter_linux_x64/liblaszip.so /lib