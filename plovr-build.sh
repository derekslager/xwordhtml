#!/bin/sh
DIR=`dirname $0`
java -jar $DIR/../plovr/build/plovr.jar build $DIR/js/plovr-config.js >$DIR/js/xw.js
