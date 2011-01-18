#!/bin/sh
DIR=`dirname $0`
java -jar $DIR/../plovr/build/plovr.jar serve $DIR/js/plovr-config.js
