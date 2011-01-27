#!/bin/sh
cat css/common.css css/dialog.css css/menubutton.css css/menu.css css/menuitem.css css/toolbar.css css/xwordhtml.css | yui-compressor --type css -o css/xw.css
