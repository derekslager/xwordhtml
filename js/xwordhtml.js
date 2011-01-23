goog.provide('derekslager.xword.XwordHtml');

goog.require('goog.array');

goog.require('goog.debug.Console');
goog.require('goog.debug.Logger');
goog.require('goog.debug.Logger.Level');
goog.require('goog.debug.LogManager');

goog.require('goog.dom.classes');
goog.require('goog.dom.DomHelper');

goog.require('goog.events.EventHandler');
goog.require('goog.events.EventType');
goog.require('goog.events.KeyCodes');
goog.require('goog.events.KeyHandler');
goog.require('goog.events.KeyHandler.EventType');

goog.require('goog.functions');

goog.require('goog.fx.dom.Scroll');
goog.require('goog.fx.easing');

goog.require('goog.math.Integer');

goog.require('goog.string.Unicode');

goog.require('goog.style');

goog.require('goog.ui.MenuItem');
goog.require('goog.ui.Toolbar');
goog.require('goog.ui.ToolbarMenuButton');

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

    var console = new goog.debug.Console();
    console.setCapturing(true);

    this.dom = new goog.dom.DomHelper();
    this.handler = new goog.events.EventHandler(this);
    this.dropZone = this.dom.getElement('dropzone');
};

/**
 * @param {goog.events.Event} e
 */
derekslager.xword.XwordHtml.prototype.onDragOver = function(e) {
    e.target.style.backgroundColor = 'red';
    e.target.style.color = 'white';

    e.stopPropagation();
    e.preventDefault();
};

/**
 * @param {string} s
 */
derekslager.xword.XwordHtml.parseShort = function(s) {
    return new goog.math.Integer([s.charCodeAt(0), s.charCodeAt(1)], 0).toInt();
};

/**
 * @param {string} s A binary string with characters encoded as
 * ISO-8859-1.
 * @return {string} A Unicode string.
 */
derekslager.xword.XwordHtml.decodeIso88591 = function(s) {
    // TODO(derek): perform decoding of extended chars
    return s;
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
    if (e.target.readyState == FileReader.DONE) {
        var result = e.target.result;
        this.logger.fine('onLoadEnd result: ' + result);
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

        var solution = crossword.solution = result.substr(SOLUTION_OFFSET, width * height);

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

        // Assign numbers.
        var number = 1;
        for (i = 0; i < crossword.height; i++) {
            for (var j = 0; j < crossword.width; j++) {
                var square = crossword.squares[i][j];
                if (!square) continue;

                square.circled = circledClues[(i * crossword.width) + j];

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
                }

                if (square.down) {
                    var clue = new derekslager.xword.Clue();
                    clue.number = square.down;
                    clue.direction = derekslager.xword.Direction.DOWN;
                    clue.text = crossword.clues[clueIndex++];
                    clue.square = square;
                    crossword.down.push(clue);
                }
            }
        }

        this.table = this.renderCrossword(puzzle, crossword);

    } else {
        this.logger.warning('unexpected readyState: ' + e.target.readyState);
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

    var output = [];
    for (var i = 0, file; file = files[i]; i++) {
        var puzzle = this.dom.createDom('div', 'puzzle');
        // puzzle.appendChild(this.dom.createDom('h1', null, file.name));

        var reader = new FileReader();
        reader.onloadend = goog.bind(this.onLoadEnd, this, puzzle);

        // Read file contents.
        reader.readAsBinaryString(file);

        this.dom.getDocument().body.appendChild(puzzle);
    }
};

/**
 * Checks the provided square for correctness.
 * @param derekslager.xword.Square square
 * @return true if the cell is good.
 */
derekslager.xword.XwordHtml.prototype.checkSquare = function(square) {
    if (!square) {
        return false;
    }
    var cell = this.getCell(square);
    var value = this.getCellValue(cell);
    var good = square.answer === value;
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
        var cell = this.getCell(square);
        this.setCellValue(cell, square.answer);
    } else if (action === 'reveal-word') {
        var squares = game.getCurrentWordSquares();
        for (var i = 0; i < squares.length; i++) {
            var square = squares[i];
            this.setCellValue(this.getCell(square), square.answer);
        }
    } else if (action === 'check-letter') {
        var square = game.getCurrentSquare();
        this.checkSquare(square);
    } else if (action === 'check-word') {
        var squares = game.getCurrentWordSquares();
        goog.array.forEach(squares, this.checkSquare, this);
    } else if (action === 'check-puzzle') {
        var allOk = false;
        var rows = game.crossword.squares;
        for (var i = 0; i < rows.length; i++) {
            var checks = goog.array.map(rows[i], this.checkSquare, this);
            allOk = allOk && goog.array.every(checks, goog.functions.identity);
        }
        if (allOk) {
            window.alert('You solved the puzzle!');
        }
    }
    this.table.focus();
};

/**
 * @param {Element} container
 * @param {derekslager.xword.Crossword} crossword
 * @return {!Element} The created table element.
 */
derekslager.xword.XwordHtml.prototype.renderCrossword = function(container, crossword) {

    container.appendChild(this.dom.createDom('h2', null, crossword.title));

    container.appendChild(
        this.dom.createDom(
            'div', null,
            this.dom.createTextNode(crossword.author),
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

    toolbar.addChild(check, true);
    toolbar.addChild(reveal, true);

    toolbar.render(container);

    // Build the grid.
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

    this.handler.listen(game,
                        derekslager.xword.Game.EventType.POSITION_CHANGED,
                        this.onPositionChanged);
    this.handler.listen(game,
                        derekslager.xword.Game.EventType.DIRECTION_CHANGED,
                        this.onDirectionChanged);
    this.handler.listen(game,
                        derekslager.xword.Game.EventType.CLUE_CHANGED,
                        this.onClueChanged);

    this.handler.listen(table,
                        goog.events.EventType.CLICK,
                        goog.bind(this.onCrosswordClicked, this, game));

    var keyHandler = new goog.events.KeyHandler(table);
    this.handler.listen(keyHandler,
                        goog.events.KeyHandler.EventType.KEY,
                        goog.bind(this.onCrosswordKey, this, game));

    this.handler.listen(toolbar, goog.ui.Component.EventType.ACTION, goog.partial(this.onToolbarAction, game));

    container.appendChild(table);

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

    clues.appendChild(this.dom.createDom('strong', undefined, 'Across'));
    clues.appendChild(across);
    clues.appendChild(this.dom.createDom('strong', undefined, 'Down'));
    clues.appendChild(down);

    container.appendChild(clues);

    return table;
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
    this.logger.fine('clue changed in ' + game.crossword.title);

    // Find the clue.
    var previousClue = this.dom.getElement(this.getClueId(e.previousClue));
    var clue = this.dom.getElement(this.getClueId(e.clue));

    goog.dom.classes.remove(previousClue, 'sc');
    goog.dom.classes.add(clue, 'sc');

    // Center the clue in its container.
    var parent = /** @type {Element} */ (clue.parentNode);
    var targetY = (clue.offsetTop - parent.offsetTop) - (parent.offsetHeight / 2);

    var scroll = new goog.fx.dom.Scroll(
        parent,
        [0, parent.scrollTop],
        [0, targetY],
        500,
        goog.fx.easing.easeOut);
    scroll.play();
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
    goog.dom.classes.remove(cell, 'good', 'bad');
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
        game.changeDirection();
    } else if (!e.ctrlKey && !e.altKey && !e.metaKey &&
               e.keyCode >= goog.events.KeyCodes.A &&
               e.keyCode <= goog.events.KeyCodes.Z) {
        this.beforeChange(game);
        this.setCellValue(this.getCell(game.getCurrentSquare()), String.fromCharCode(e.charCode).toUpperCase());
        game.moveNext();
    } else if (e.keyCode == goog.events.KeyCodes.UP) {
        this.beforeChange(game);
        game.moveUp();
    } else if (e.keyCode == goog.events.KeyCodes.RIGHT) {
        this.beforeChange(game);
        game.moveRight();
    } else if (e.keyCode == goog.events.KeyCodes.DOWN) {
        this.beforeChange(game);
        game.moveDown();
    } else if (e.keyCode == goog.events.KeyCodes.LEFT) {
        this.beforeChange(game);
        game.moveLeft();
    } else if (e.keyCode == goog.events.KeyCodes.TAB) {
        this.beforeChange(game);
        if (e.shiftKey) {
            game.previousWord();
        } else {
            game.nextWord();
        }
    } else if (e.keyCode === goog.events.KeyCodes.DELETE) {
        this.beforeChange(game);
        this.setCellValue(this.getCell(game.getCurrentSquare()), goog.string.Unicode.NBSP);
    } else if (e.keyCode === goog.events.KeyCodes.BACKSPACE) {
        this.beforeChange(game);
        if (this.isCellEmpty(this.getCell(game.getCurrentSquare()))) {
            game.movePrevious();
        }
        this.setCellValue(this.getCell(game.getCurrentSquare()), goog.string.Unicode.NBSP);
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

derekslager.xword.XwordHtml.prototype.onCrosswordClicked = function(game, e) {
    var cell = goog.dom.getAncestorByTagNameAndClass(e.target, goog.dom.TagName.TD);
    if (cell && !goog.dom.classes.has(cell, 'b')) {

        this.beforeChange(game);

        var x = cell.cellIndex;
        var y = cell.parentNode.rowIndex;

        // If it's the same cell that was already highlighted, change
        // direction.
        if (x === game.x && y === game.y) {
            game.changeDirection();
        }

        game.setPosition(x, y);

        this.update(game);
    }
};

derekslager.xword.XwordHtml.prototype.load = function() {
    this.handler.listen(this.dropZone, goog.events.EventType.DRAGOVER, this.onDragOver);
    this.handler.listen(this.dropZone, goog.events.EventType.DROP, this.onDrop);
    this.logger.fine('Event listeners added.');
};
