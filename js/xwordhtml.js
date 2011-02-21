goog.provide('derekslager.xword.XwordHtml');

goog.require('goog.array');

goog.require('goog.async.Deferred');

goog.require('goog.debug.Console');
goog.require('goog.debug.Logger');
goog.require('goog.debug.Logger.Level');
goog.require('goog.debug.LogManager');

goog.require('goog.dom.classes');
goog.require('goog.dom.DomHelper');
goog.require('goog.dom.ViewportSizeMonitor');

goog.require('goog.events.EventHandler');
goog.require('goog.events.EventType');
goog.require('goog.events.KeyCodes');
goog.require('goog.events.KeyHandler');
goog.require('goog.events.KeyHandler.EventType');

goog.require('goog.fs.FileReader');
goog.require('goog.fs.FileReader.EventType');
goog.require('goog.fs.FileReader.ReadyState');

goog.require('goog.functions');

goog.require('goog.fx.dom.Scroll');
goog.require('goog.fx.easing');

goog.require('goog.math.Integer');

goog.require('goog.string.Unicode');

goog.require('goog.string');
goog.require('goog.style');

goog.require('goog.Timer');

goog.require('goog.ui.Dialog');
goog.require('goog.ui.Dialog.ButtonSet');
goog.require('goog.ui.MenuItem');
goog.require('goog.ui.Prompt');
goog.require('goog.ui.Toolbar');
goog.require('goog.ui.ToolbarButton');
goog.require('goog.ui.ToolbarMenuButton');
goog.require('goog.ui.ToolbarToggleButton');

goog.require('goog.window');

goog.require('derekslager.xword.Clue');
goog.require('derekslager.xword.Crossword');
goog.require('derekslager.xword.Game');
goog.require('derekslager.xword.Game.EventType');
goog.require('derekslager.xword.Square');

/**
 * @constructor
 */
derekslager.xword.XwordHtml = function() {
    this.logger = goog.debug.LogManager.getLogger('derekslager.xword.XwordHtml');

    goog.debug.LogManager.getRoot().setLevel(goog.debug.Logger.Level.FINE);

    if (goog.DEBUG) {
        var console = new goog.debug.Console();
        console.setCapturing(true);
    }

    this.dom = new goog.dom.DomHelper();
    this.handler = new goog.events.EventHandler(this);
    this.dropZone = this.dom.getElement('dropzone');

    this.sizeMonitor = goog.dom.ViewportSizeMonitor.getInstanceForWindow();
    this.handler.listen(this.sizeMonitor, goog.events.EventType.RESIZE, this.onViewportResize);
    this.dropZone.style.height = (this.sizeMonitor.getSize().height - derekslager.xword.XwordHtml.viewportOffset) + 'px';
};

/** @type {number} */
derekslager.xword.XwordHtml.viewportOffset = 70;

/**
 * Current search term for 'Huh?' menu.
 * @type {string} 
 */
derekslager.xword.XwordHtml.prototype.wtfSearchTerm;

/**
 * @type {Element}
 */
derekslager.xword.XwordHtml.prototype.timer;

/**
 * @type {goog.ui.Prompt}
 */
derekslager.xword.XwordHtml.prototype.rebusPrompt;

derekslager.xword.XwordHtml.prototype.onViewportResize = function(e) {
    var size = e.target.getSize();
    this.dropZone.style.height = (size.height - derekslager.xword.XwordHtml.viewportOffset) + 'px';
};

/**
 * @param {goog.events.BrowserEvent} e
 */
derekslager.xword.XwordHtml.prototype.onDragOver = function(e) {
    var zone = e.currentTarget;

    zone.style.backgroundColor = 'red';
    zone.style.color = 'white';

    e.stopPropagation();
    e.preventDefault();
};

/**
 * @param {goog.events.BrowserEvent} e
 */
derekslager.xword.XwordHtml.prototype.onDragLeave = function(e) {
    var zone = e.currentTarget;

    zone.style.backgroundColor = '';
    zone.style.color = '';
};

/**
 * @param {string} s
 */
derekslager.xword.XwordHtml.parseShort = function(s) {
    return new goog.math.Integer([s.charCodeAt(0), s.charCodeAt(1)], 0).toInt();
};

/**
 * {Object.<number, number>}
 */
derekslager.xword.XwordHtml.iso88591toUnicode =
    {128:8364, 129:65533, 130:8218, 131:402, 132:8222, 133:8230, 134:8224,
     135:8225, 136:710, 137:8240, 138:352, 139:8249, 140:338, 141:65533,
     142:381, 143:65533, 144:65533, 145:8216, 146:8217, 147:8220, 148:8221,
     149:8226, 150:8211, 151:8212, 152:732, 153:8482, 154:353, 155:8250,
     156:339, 157:65533, 158:382, 159:376};

/**
 * @param {string} s A binary string with characters encoded as
 * ISO 8859-1 (latin1).
 * @return {string} A Unicode string.
 */
derekslager.xword.XwordHtml.decodeIso88591 = function(s) {
    var cs = [];
    for (var i = 0; i < s.length; i++) {
        var c = s.charCodeAt(i);
        cs.push(String.fromCharCode(derekslager.xword.XwordHtml.iso88591toUnicode[c] || c));
    }
    return cs.join('');
};

/**
 * @param {string} s
 * @param {Array.<number>} index
 */
derekslager.xword.XwordHtml.readString = function(s, index) {
    var nul = s.indexOf('\0', index[0]);
    var result = s.substring(index[0], nul);
    index[0] = (nul + 1);
    return derekslager.xword.XwordHtml.decodeIso88591(result);
};

/**
 * @param {Element} puzzle
 * @param {goog.events.Event} e
 */
derekslager.xword.XwordHtml.prototype.onLoadEnd = function(puzzle, e) {
    var reader = /** @type {goog.fs.FileReader} */ (e.target);
    if (reader.getError()) {
        alert('Unable to read file.');
    } else {
        var result = /** @type {string} */ (reader.getResult());
        this.logger.fine('header: ' + result.substr(2, 12));

        // TODO(derek): confirm ACROSS&DOWN, throw on error

        /** @const */
        var WIDTH_OFFSET = 0x2C;

        // Parse the file and build a crossword.
        var crossword = new derekslager.xword.Crossword();

        var width = crossword.width = result.charCodeAt(WIDTH_OFFSET); // parseInt(result[WIDTH_OFFSET], 10);
        var height = crossword.height = result.charCodeAt(WIDTH_OFFSET + 1);
        var clueCount = derekslager.xword.XwordHtml.parseShort(result.substr(WIDTH_OFFSET + 2, 2));

        this.logger.fine('clueCount: ' + clueCount);

        /** @const */
        var SOLUTION_OFFSET = 0x34;

        var solution = result.substr(SOLUTION_OFFSET, width * height);

        var stringIndex = [SOLUTION_OFFSET + ((width * height) * 2)];

        crossword.title = derekslager.xword.XwordHtml.readString(result, stringIndex);
        crossword.author = derekslager.xword.XwordHtml.readString(result, stringIndex);
        crossword.copyright = derekslager.xword.XwordHtml.readString(result, stringIndex);

        crossword.clues = [];
        for (var i = 0; i < clueCount; i++) {
            crossword.clues.push(derekslager.xword.XwordHtml.readString(result, stringIndex));
        }

        crossword.notes = derekslager.xword.XwordHtml.readString(result, stringIndex);

        var circledClues = {};
        var rebusIndices = {};
        var rebusValues = [];

        // Having read all the strings, we should be either at EOF or
        // we'll have extra sections.
        var index = stringIndex[0];
        this.logger.fine('looking for sections starting at index ' + index);
        while (result.length > index + 9) {
            this.logger.fine('INDEX: ' + index);
            // Read section header.
            var sectionHeader = result.substr(index, 8);
            var lengthBytes = sectionHeader.substr(4, 2);
            this.logger.fine('len bytes len: ' + lengthBytes.length);

            // Determine the length of the data section.
            var length = derekslager.xword.XwordHtml.parseShort(lengthBytes);
            this.logger.fine('found section of length ' + length);

            var dataIndex = index + 8;

            var sectionName = sectionHeader.substr(0, 4);
            this.logger.fine('FOUND SECTION "' + sectionName + '"');
            if (sectionName == 'GEXT') {
                for (var c = 0; c < length; c++) {
                    var cc = result.charCodeAt(dataIndex + c);
                    if (cc & 0x80) {
                        circledClues[c] = true;
                    }
                }
            } else if (sectionName == 'GRBS') {
                // Section containing non-0 entries for rebus squares.
                for (var c = 0; c < length; c++) {
                    var cc = result.charCodeAt(dataIndex + c);
                    if (cc) {
                        rebusIndices[c] = cc - 1;
                    }
                }
            } else if (sectionName == 'RTBL') {
                // Rebus solutions, 2 character index, colon, value, semicolon.
                // " 0:FOO; 1:BAR;10:BAZ;"
                this.logger.fine(result.substr(dataIndex, length));
                var rebusSolutions = result.substr(dataIndex, length).split(';');
                for (var r = 0; r < rebusSolutions.length; r++) {
                    var rv = rebusSolutions[r];
                    if (rv) {
                        var rebusIndex = parseInt(rv.substr(0, 2), 10);
                        var rebusValue = rv.substring(3);
                        rebusValues[rebusIndex] = rebusValue;
                    }
                }
            }

            index += (length + 9);
        }

        crossword.squares = new Array(crossword.height);
        for (i = 0; i < crossword.height; i++) {
            crossword.squares[i] = new Array(crossword.width);
            for (var j = 0; j < crossword.width; j++) {
                var answer = solution[i * crossword.width + j];
                if (answer !== '.') {
                    var square = new derekslager.xword.Square();
                    square.row = i;
                    square.column = j;
                    square.answer = answer;
                    crossword.squares[i][j] = square;
                }
            }
        }

        // Assign numbers, circles, rebuses, etc.
        var number = 1;
        for (i = 0; i < crossword.height; i++) {
            for (var j = 0; j < crossword.width; j++) {
                var square = crossword.squares[i][j];
                if (!square) continue;

                var totalIndex = (i * crossword.width) + j;
                square.circled = circledClues[totalIndex];
                var rebusIndex = rebusIndices[totalIndex];
                if (rebusIndex) {
                    square.rebus = rebusValues[rebusIndex];
                }

                if ((j === 0 || !crossword.squares[i][j - 1]) &&
                    (j + 1 < crossword.width && crossword.squares[i][j + 1])) {
                    square.across = number;
                }
                if ((i === 0 || !crossword.squares[i - 1][j]) &&
                    (i + 1 < crossword.height && crossword.squares[i + 1][j])) {
                    square.down = number;
                }

                if (square.down || square.across) {
                    number++;
                }
            }
        }

        // Separate the clues.
        var clueIndex = 0;
        for (i = 0; i < crossword.height; i++) {
            for (var j = 0; j < crossword.width; j++) {
                var square = crossword.squares[i][j];
                if (!square) continue;

                if (square.across) {
                    var clue = new derekslager.xword.Clue();
                    clue.number = square.across;
                    clue.direction = derekslager.xword.Direction.ACROSS;
                    clue.text = crossword.clues[clueIndex++];
                    clue.square = square;
                    crossword.across.push(clue);

                    square.acrossClue = clue;
                }

                if (square.down) {
                    var clue = new derekslager.xword.Clue();
                    clue.number = square.down;
                    clue.direction = derekslager.xword.Direction.DOWN;
                    clue.text = crossword.clues[clueIndex++];
                    clue.square = square;
                    crossword.down.push(clue);

                    square.downClue = clue;
                }
            }
        }

        this.renderCrossword(puzzle, crossword);
    }

    this.dom.removeNode(this.dropZone);
};

/**
 * @param {goog.events.Event} e
 */
derekslager.xword.XwordHtml.prototype.onDrop = function(e) {
    e.stopPropagation();
    e.preventDefault();

    this.logger.fine('DROP');

    var files = e.getBrowserEvent().dataTransfer.files;

    if (files.length === 0) {
        alert('No files found.');
    } else {
        // Grab the first file, ignoring others.
        var file = files[0];
        var puzzle = this.dom.createDom('div', 'puzzle');

        var reader = new goog.fs.FileReader();
        this.waitForEvent(goog.fs.FileReader.EventType.LOAD_END, reader)
            .addCallback(goog.bind(this.onLoadEnd, this, puzzle));
        reader.readAsBinaryString(file);

        this.dom.insertSiblingAfter(puzzle, this.dropZone);
    }
};

/**
 * @param {goog.fs.FileReader.EventType} type
 * @param {goog.events.EventTarget} target
 */
derekslager.xword.XwordHtml.prototype.waitForEvent = function(type, target) {
    var d = new goog.async.Deferred();
    goog.events.listenOnce(target, type, d.callback, false, d);
    return d;
};

/**
 * Checks the provided square for correctness.
 * @param derekslager.xword.Square square
 * @return {boolean} Whether or not the cell was good.
 */
derekslager.xword.XwordHtml.prototype.checkSquare = function(square) {
    if (!square) {
        return true;
    }
    var cell = this.getCell(square);
    var value = this.getCellValue(cell);
    var good = (square.rebus && square.rebus === value) || square.answer === value;
    if (!good) {
        goog.dom.classes.add(cell, 'bad');
    }
    return good;
};

/**
 * @param {derekslager.xword.Game} game
 * @param {goog.events.Event} e
 */
derekslager.xword.XwordHtml.prototype.onToolbarAction = function(game, e) {
    var item = /** @type {goog.ui.MenuItem} */ (e.target);
    var action = /** @type {string} */ (item.getModel());
    if (action === 'reveal-letter') {
        var square = game.getCurrentSquare();
        game.setSquareValue(square, square.rebus || square.answer);
    } else if (action === 'reveal-word') {
        var squares = game.getCurrentWordSquares();
        for (var i = 0; i < squares.length; i++) {
            var square = squares[i];
            game.setSquareValue(square, square.rebus || square.answer);
        }
    } else if (action === 'check-letter') {
        var square = game.getCurrentSquare();
        this.checkSquare(square);
    } else if (action === 'check-word') {
        var squares = game.getCurrentWordSquares();
        goog.array.forEach(squares, this.checkSquare, this);
    } else if (action === 'check-puzzle') {
        var allOk = true;
        var rows = game.crossword.squares;
        for (var i = 0; i < rows.length; i++) {
            var checks = goog.array.map(rows[i], this.checkSquare, this);
            allOk = allOk && goog.array.every(checks, goog.functions.identity);
        }
        if (allOk) {
            game.stopTimer();
            window.alert('You solved the puzzle!');
        } else {
            window.alert('Puzzle contains blank or invalid squares.');
        }
    } else if (action === 'rebus-entry') {
        this.showRebusPrompt(game);
    } else if (action === 'pause-timer') {
        if (e.target.isChecked()) {
            game.stopTimer();
        } else {
            game.startTimer();
        }
    } else if (action === 'show-notepad') {
        alert(game.crossword.notes);
    } else if (action === 'help') {
        if (!this.helpDialog) {
            this.helpDialog = new goog.ui.Dialog();
            this.helpDialog.setTitle('Keyboard Shortcuts');
            this.helpDialog.render();
            var help = /** @type {Element} */ (this.dom.removeNode(this.dom.getElement('help')));
            this.helpDialog.getContentElement().appendChild(help);
            this.helpDialog.setButtonSet(goog.ui.Dialog.ButtonSet.createOk());
            goog.style.showElement(help, true);
        }
        this.helpDialog.setVisible(true);
    } else if (action === 'wtf-google') {
        goog.window.open(
            'http://www.google.com/search?q=' + encodeURIComponent(this.wtfSearchTerm));
    } else if (action === 'wtf-xwi') {
        goog.window.open(
            'http://www.xwordinfo.com/Finder?word=' + encodeURIComponent(this.wtfSearchTerm));
    } else {
        this.logger.warning('Unhandled: ' + action);
    }
    this.table.focus();
};

/**
 * @param {Element} container
 * @param {derekslager.xword.Crossword} crossword
 */
derekslager.xword.XwordHtml.prototype.renderCrossword = function(container, crossword) {

    var header = this.dom.createDom('div');
    header.style.padding = '4px 8px';
    header.style.backgroundColor = '#fafafa';
    container.appendChild(header);

    header.appendChild(this.dom.createDom('h2', null, crossword.title));

    header.appendChild(
        this.dom.createDom(
            'div', 'metadata',
            this.dom.createTextNode(crossword.author + ' '),
            this.dom.createTextNode(crossword.copyright)));

    // Build the toolbar.
    var toolbar = new goog.ui.Toolbar();

    var check = new goog.ui.ToolbarMenuButton('Check');
    check.addItem(new goog.ui.MenuItem('Check Letter', 'check-letter', this.dom));
    check.addItem(new goog.ui.MenuItem('Check Word', 'check-word', this.dom));
    check.addItem(new goog.ui.MenuItem('Check Puzzle', 'check-puzzle', this.dom));

    var reveal = new goog.ui.ToolbarMenuButton('Reveal');
    reveal.addItem(new goog.ui.MenuItem('Reveal Letter', 'reveal-letter', this.dom));
    reveal.addItem(new goog.ui.MenuItem('Reveal Word', 'reveal-word', this.dom));

    var wtf = new goog.ui.ToolbarMenuButton('Huh?');
    this.google = new goog.ui.MenuItem('Search Google', 'wtf-google', this.dom);
    this.google.setEnabled(false);
    // this.google.setTooltip('Search for the current word on Google.');
    this.xwordInfo = new goog.ui.MenuItem('Search XWord Info', 'wtf-xwi', this.dom);
    this.xwordInfo.setEnabled(false);
    // this.xwordInfo.setTooltip('Find matches for the current word (whole or partial) on XWord Info.');
    wtf.addItem(this.google);
    wtf.addItem(this.xwordInfo);

    var rebus = new goog.ui.ToolbarButton('Rebus');
    rebus.setModel('rebus-entry');
    rebus.setTooltip('Enter multiple letters into a single square.');

    var pause = new goog.ui.ToolbarToggleButton('Pause Timer', undefined, this.dom);
    pause.setModel('pause-timer');

    var help = new goog.ui.ToolbarButton('Help');
    help.setModel('help');

    toolbar.addChild(check, true);
    toolbar.addChild(reveal, true);
    toolbar.addChild(wtf, true);
    toolbar.addChild(rebus, true);

    // Show the "notepad" button if notes are present.
    if (crossword.notes) {
        var notes = new goog.ui.ToolbarButton('Notepad');
        notes.setModel('show-notepad');
        toolbar.addChild(notes, true);
    }

    toolbar.addChild(pause, true);
    toolbar.addChild(help, true);

    toolbar.render(container);

    // Build the grid.
    var grid = this.dom.createDom('div', 'm');

    var table = this.dom.createTable(crossword.height, crossword.width);
    goog.dom.classes.add(table, 'grid');
    table.tabIndex = -1; // make focusable so we can get key events

    for (var i = 0; i < crossword.squares.length; i++) {
        var row = crossword.squares[i];

        for (var j = 0; j < row.length; j++) {
            var cell = table.rows[i].cells[j];

            var square = row[j];
            if (square) {
                if (square.circled) {
                    cell = cell.appendChild(this.dom.createDom('div', 'circled'));
                }

                var number = square.getNumber();
                var n = number ? String(number) : goog.string.Unicode.NBSP;
                cell.appendChild(this.dom.createDom('span', 'n', n));
                cell.appendChild(this.dom.createDom('span', 'a', goog.string.Unicode.NBSP));
            } else {
                goog.dom.classes.add(cell, 'b');
            }
        }
    }

    // Track game state.
    var game = new derekslager.xword.Game(crossword);

    // Movement.
    this.handler.listen(game,
                        derekslager.xword.Game.EventType.POSITION_CHANGED,
                        this.onPositionChanged);
    this.handler.listen(game,
                        derekslager.xword.Game.EventType.DIRECTION_CHANGED,
                        this.onDirectionChanged);
    this.handler.listen(game,
                        derekslager.xword.Game.EventType.CLUE_CHANGED,
                        this.onClueChanged);
    this.handler.listen(game,
                        derekslager.xword.Game.EventType.CROSSING_CLUE_CHANGED,
                        this.onCrossingClueChanged);

    this.handler.listen(game,
                        derekslager.xword.Game.EventType.SQUARE_VALUE_CHANGED,
                        this.onSquareValueChanged);

    this.handler.listen(game,
                        derekslager.xword.Game.EventType.TIMER_TICK,
                        this.onTimerTick);

    // Set enabled/disabled states for Huh? menu.
    this.handler.listen(game,
                        [ derekslager.xword.Game.EventType.POSITION_CHANGED,
                          derekslager.xword.Game.EventType.DIRECTION_CHANGED,
                          derekslager.xword.Game.EventType.SQUARE_VALUE_CHANGED,
                          derekslager.xword.Game.EventType.CLUE_CHANGED ],
                        this.setWtfMenuStates);

    this.handler.listen(table,
                        goog.events.EventType.CLICK,
                        goog.bind(this.onCrosswordClicked, this, game));

    var keyHandler = new goog.events.KeyHandler(table);
    this.handler.listen(keyHandler,
                        goog.events.KeyHandler.EventType.KEY,
                        goog.bind(this.onCrosswordKey, this, game));

    this.handler.listen(toolbar, goog.ui.Component.EventType.ACTION, goog.partial(this.onToolbarAction, game));

    grid.appendChild(table);
    container.appendChild(grid);

    // Clues.
    var clues = this.dom.createDom('div', 'clues');

    var across = this.dom.createDom('div', 'c across');
    for (i = 0; i < crossword.across.length; i++) {
        var clue = crossword.across[i];
        var element = this.dom.createDom('div', { 'id': this.getClueId(clue) }, clue.number + '. ' + clue.text);
        this.handler.listen(element,
                            goog.events.EventType.CLICK,
                            goog.partial(this.onClueClicked, game, clue));
        across.appendChild(element);
    }

    var down = this.dom.createDom('div', 'c across');
    for (i = 0; i < crossword.down.length; i++) {
        var clue = crossword.down[i];
        var element = this.dom.createDom('div', { 'id': this.getClueId(clue) }, clue.number + '. ' + clue.text);
        this.handler.listen(element,
                            goog.events.EventType.CLICK,
                            goog.partial(this.onClueClicked, game, clue));
        down.appendChild(element);
    }

    clues.appendChild(this.timer = this.dom.createDom('div', 'timer', '0:00'));

    clues.appendChild(this.dom.createDom('strong', undefined, 'Across'));
    clues.appendChild(across);
    clues.appendChild(this.dom.createDom('strong', undefined, 'Down'));
    clues.appendChild(down);

    grid.appendChild(clues);

    // TODO(derek): clean this hot mess up
    this.table = table;
    this.update(game);
    table.focus();

    this.highlightClue(/** @type {Element} */ (across.firstChild), 'sc');
    this.highlightClue(/** @type {Element} */ (down.firstChild), 'scc');

    game.startTimer();
};

/**
 * @param {derekslager.xword.Game} game
 * @param {derekslager.xword.Clue} clue
 */
derekslager.xword.XwordHtml.prototype.onClueClicked = function(game, clue, e) {
    this.beforeChange(game);
    game.setDirection(clue.direction);
    game.setPosition(clue.square.column, clue.square.row);
    this.update(game);
    this.logger.fine('clicked clue corresponding to position ' +
                     clue.square.column + 'x' + clue.square.row);
};

/**
 * @param {goog.events.Event} e
 */
derekslager.xword.XwordHtml.prototype.onPositionChanged = function(e) {
    var game = e.target;
    this.logger.fine('position changed in ' + game.crossword.title + ' ' +
                     e.previousColumn + 'x' + e.previousRow + ' => ' +
                     e.column + 'x' + e.row);
};

/**
 * @param {derekslager.xword.Clue} clue
 * @return {string}
 */
derekslager.xword.XwordHtml.prototype.getClueId = function(clue) {
    return 'c-' + (clue.direction == derekslager.xword.Direction.ACROSS ? 'a-' : 'd-') + clue.number;
};

/**
 * @param {goog.events.Event} e
 */
derekslager.xword.XwordHtml.prototype.onClueChanged = function(e) {
    var game = e.target;
    this.logger.fine('clue changed');

    // Find the clue.
    var previousClue = this.dom.getElement(this.getClueId(e.previousClue));
    var clue = this.dom.getElement(this.getClueId(e.clue));

    goog.dom.classes.remove(previousClue, 'sc');

    this.highlightClue(clue, 'sc');
};

/**
 * @param {goog.events.Event} e
 */
derekslager.xword.XwordHtml.prototype.setWtfMenuStates = function(e) {
    var game = e.target;

    var squares = game.getCurrentWordSquares();

    var searchTerm = '';

    var answered = 0;
    for (var i = 0; i < squares.length; i++) {
        var value = squares[i].value;
        if (value) {
            searchTerm += value;
            answered++;
        } else {
            searchTerm += '?';
        }
    }

    this.wtfSearchTerm = searchTerm;

    // If they answered all the letters, we can search on Google. If
    // they answered any letter, they can search on XWord Info.
    this.google.setEnabled(answered == squares.length);
    this.xwordInfo.setEnabled(answered > 0);
};

derekslager.xword.XwordHtml.prototype.onCrossingClueChanged = function(e) {
    var game = e.target;
    this.logger.fine('crossing clue changed');

    var previousClue = this.dom.getElement(this.getClueId(e.previousClue));
    var clue = this.dom.getElement(this.getClueId(e.clue));

    goog.dom.classes.remove(previousClue, 'scc');

    this.highlightClue(clue, 'scc');
};

/**
 * @param {Element} clue
 * @param {string} className
 */
derekslager.xword.XwordHtml.prototype.highlightClue = function(clue, className) {
    goog.dom.classes.add(clue, className);

    // Center the clue in its container.
    var parent = /** @type {Element} */ (clue.parentNode);
    var targetY = (clue.offsetTop - parent.offsetTop) - (parent.offsetHeight / 2);

    if (this.scroll) {
        this.scroll.stop(true);
    }
    this.scroll = new goog.fx.dom.Scroll(
        parent,
        [0, parent.scrollTop],
        [0, targetY],
        500,
        goog.fx.easing.easeOut);
    this.scroll.play();
};

derekslager.xword.XwordHtml.prototype.onSquareValueChanged = function(e) {
    var game = e.target;
    var square = e.square;
    this.setCellValue(this.getCell(square), square.value || goog.string.Unicode.NBSP);
};

derekslager.xword.XwordHtml.prototype.onTimerTick = function(e) {
    var game = e.target;
    var elapsed = game.totalTime;

    var seconds = (elapsed / 1000).toFixed(0);
    var minutes = Math.floor(seconds / 60);

    this.timer.innerHTML =
        minutes.toFixed(0) + ':' +
        goog.string.padNumber(seconds - (minutes * 60), 2);
};

/**
 * @param {goog.events.Event} e
 */
derekslager.xword.XwordHtml.prototype.onDirectionChanged = function(e) {
    var game = e.target;
    this.logger.fine('direction changed in ' + game.crossword.title);
};

/**
 * @param {derekslager.xword.Square} square
 */
derekslager.xword.XwordHtml.prototype.getCell = function(square) {
    return this.table.rows[square.row].cells[square.column];
};

/**
 * @param {Element} cell
 */
derekslager.xword.XwordHtml.prototype.getContentNode = function(cell) {
    var node = cell.firstChild;
    if (goog.dom.classes.has(node, 'circled')) {
        node = node.firstChild;
    }
    return node.nextSibling;
};

/**
 * @param {Element} cell
 */
derekslager.xword.XwordHtml.prototype.getCellValue = function(cell) {
    return this.dom.getTextContent(this.getContentNode(cell));
};

/**
 * @param {Element} cell
 * @param {string} value
 */
derekslager.xword.XwordHtml.prototype.setCellValue = function(cell, value) {
    this.getContentNode(cell).innerHTML = value;
    if (value.length > 1) {
        // Rebus.
        goog.dom.classes.add(cell, 'rebus');
    } else {
        goog.dom.classes.remove(cell, 'rebus');
    }
    goog.dom.classes.remove(cell, 'good', 'bad');
};

/**
 * @param {derekslager.xword.Game} game
 */
derekslager.xword.XwordHtml.prototype.showRebusPrompt = function(game) {
    if (!this.rebusPrompt) {
        this.rebusPrompt =
            new goog.ui.Prompt('Rebus Entry',
                               'Enter letters for the current square.',
                               goog.bind(this.rebusEntryCallback, this, game));
        this.rebusPrompt.setCols(8);
    }
    this.rebusPrompt.setDefaultValue(game.getCurrentSquare().value || '');
    goog.Timer.callOnce(goog.bind(this.rebusPrompt.setVisible, this.rebusPrompt, true));
};

/**
 * @param {derekslager.xword.Game} game
 * @param {string} value
 */
derekslager.xword.XwordHtml.prototype.rebusEntryCallback = function(game, value) {
    // null means cancel
    if (value != null) {
        // TODO(derek): why am I doing so much work here?!
        this.beforeChange(game);
        game.setSquareValue(game.getCurrentSquare(), value.substring(0, 8).toUpperCase());
        game.moveNext();
        this.update(game);
    }
    // No matter what, it'll have stolen focus.
    this.table.focus();
};

/**
 * @param {Element} cell
 */
derekslager.xword.XwordHtml.prototype.isCellEmpty = function(cell) {
    var value = this.getCellValue(cell);
    this.logger.fine('isCellEmpty: "' + value + '"');
    return !value || value == goog.string.Unicode.NBSP;
};

derekslager.xword.XwordHtml.prototype.onCrosswordKey = function(game, e) {
    this.logger.fine('KEY (' + e.keyCode + ') on ' + e.target.nodeName);

    var changed = true;

    if (e.keyCode === goog.events.KeyCodes.SPACE) {
        this.beforeChange(game);
        game.setSquareValue(game.getCurrentSquare(), '');
        game.moveNextNoCycle();
    } else if (!e.ctrlKey && !e.altKey && !e.metaKey &&
               e.keyCode >= goog.events.KeyCodes.A &&
               e.keyCode <= goog.events.KeyCodes.Z) {
        this.beforeChange(game);
        game.setSquareValue(game.getCurrentSquare(), String.fromCharCode(e.charCode).toUpperCase());
        game.moveNext();
    } else if (e.keyCode == goog.events.KeyCodes.UP) {
        this.beforeChange(game);
        if (e.shiftKey) {
            game.previousWord();
        } else if (e.ctrlKey) {
            if (game.direction === derekslager.xword.Direction.ACROSS) {
                game.changeDirection();
            }
        } else {
            game.moveUp();
        }
    } else if (e.keyCode == goog.events.KeyCodes.RIGHT) {
        this.beforeChange(game);
        if (e.shiftKey) {
            game.nextWord();
        } else if (e.ctrlKey) {
            if (game.direction === derekslager.xword.Direction.DOWN) {
                game.changeDirection();
            }
        } else {
            game.moveRight();
        }
    } else if (e.keyCode == goog.events.KeyCodes.DOWN) {
        this.beforeChange(game);
        if (e.shiftKey) {
            game.nextWord();
        } else if (e.ctrlKey) {
            if (game.direction === derekslager.xword.Direction.ACROSS) {
                game.changeDirection();
            }
        } else {
            game.moveDown();
        }
    } else if (e.keyCode == goog.events.KeyCodes.LEFT) {
        this.beforeChange(game);
        if (e.shiftKey) {
            game.previousWord();
        } else if (e.ctrlKey) {
            if (game.direction === derekslager.xword.Direction.DOWN) {
                game.changeDirection();
            }
        } else {
            game.moveLeft();
        }
    } else if (e.keyCode == goog.events.KeyCodes.HOME) {
        this.beforeChange(game);
        if (e.shiftKey) {
            game.moveToFirstSquare();
        } else {
            game.moveToBeginningOfWord();
        }
    } else if (e.keyCode == goog.events.KeyCodes.END) {
        this.beforeChange(game);
        if (e.shiftKey) {
            game.moveToLastSquare();
        } else {
            game.moveToEndOfWord();
        }
    } else if (e.keyCode == goog.events.KeyCodes.TAB ||
               e.keyCode == goog.events.KeyCodes.ENTER) {
        this.beforeChange(game);
        if (e.shiftKey) {
            game.previousWord();
        } else {
            game.nextWord();
        }
    } else if (e.keyCode === goog.events.KeyCodes.DELETE) {
        this.beforeChange(game);
        game.setSquareValue(game.getCurrentSquare(), '');
    } else if (e.keyCode === goog.events.KeyCodes.BACKSPACE) {
        this.beforeChange(game);
        if (this.isCellEmpty(this.getCell(game.getCurrentSquare()))) {
            game.movePrevious();
        }
        game.setSquareValue(game.getCurrentSquare(), '');
    } else if (e.keyCode === goog.events.KeyCodes.INSERT ||
               e.keyCode === goog.events.KeyCodes.F2) {
        this.showRebusPrompt(game);
    } else {
        changed = false;
    }

    if (changed) {
        this.update(game);
        e.stopPropagation();
        e.preventDefault();
    }
};

/**
 * @param {derekslager.xword.Game} game
 * @return {Array.<Element>}
 */
derekslager.xword.XwordHtml.prototype.getCurrentWordCells = function(game) {
    return goog.array.map(game.getCurrentWordSquares(), this.getCell, this);
};

/**
 * @param {derekslager.xword.Game} game
 */
derekslager.xword.XwordHtml.prototype.beforeChange = function(game) {
    // Unhighlight the current cells.
    goog.array.map(this.getCurrentWordCells(game),
                   function(c) { c.style.backgroundColor = ''; });
};

/**
 * @param {derekslager.xword.Game} game
 */
derekslager.xword.XwordHtml.prototype.update = function(game) {
    var wordCells = this.getCurrentWordCells(game);
    for (var i = 0; i < wordCells.length; i++) {
        wordCells[i].style.backgroundColor = '#ddd';
    }
    this.getCell(game.getCurrentSquare()).style.backgroundColor = 'yellow';
    this.table.focus();
};

/**
 * @param {derekslager.xword.Game} game
 * @param {goog.events.BrowserEvent} e
 */
derekslager.xword.XwordHtml.prototype.onCrosswordClicked = function(game, e) {
    var cell = goog.dom.getAncestorByTagNameAndClass(e.target, goog.dom.TagName.TD);
    if (cell && !goog.dom.classes.has(cell, 'b')) {

        this.beforeChange(game);

        var x = cell.cellIndex;
        var y = cell.parentNode.rowIndex;

        // TODO(derek): emulate Across Lite -- right click on any
        // valid square changes direction, but doesn't change
        // position. Left click on any valid square sets position but
        // doesn't change direction. Left click plus drag sets
        // position and changes direction with drag motion.
        game.setPosition(x, y);

        this.update(game);
    }
};

derekslager.xword.XwordHtml.prototype.load = function() {
    this.handler.listen(this.dropZone, goog.events.EventType.DRAGOVER, this.onDragOver);
    // this.handler.listen(this.dropZone, goog.events.EventType.DRAGLEAVE, this.onDragLeave);
    this.handler.listen(this.dropZone, goog.events.EventType.DROP, this.onDrop);
    this.logger.fine('Event listeners added.');
};

goog.exportSymbol('derekslager.xword.XwordHtml', derekslager.xword.XwordHtml);
goog.exportProperty(derekslager.xword.XwordHtml.prototype, 'load', derekslager.xword.XwordHtml.prototype.load);
