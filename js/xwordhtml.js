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

goog.require('goog.math.Integer');

goog.require('goog.string.Unicode');

goog.require('derekslager.xword.Clue');
goog.require('derekslager.xword.Crossword');
goog.require('derekslager.xword.Game');
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
 * @param {string} s
 * @param {Array.<number>} index
 */
derekslager.xword.XwordHtml.readString = function(s, index) {
    var nul = s.indexOf('\0', index[0]);
    var result = s.substring(index[0], nul);
    index[0] = (nul + 1);
    return result;
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
        puzzle.appendChild(this.dom.createDom('h1', null, file.name));

        var reader = new FileReader();
        reader.onloadend = goog.bind(this.onLoadEnd, this, puzzle);

        // Read file contents.
        reader.readAsBinaryString(file);

        this.dom.getDocument().body.appendChild(puzzle);
    }
};

/**
 * @param {Element} container
 * @param {derekslager.xword.Crossword} crossword
 * @return {!Element} The created table element.
 */
derekslager.xword.XwordHtml.prototype.renderCrossword = function(container, crossword) {

    container.appendChild(this.dom.createDom('h2', null, crossword.title));

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
                var number = square.getNumber();
                var n = number ? String(number) : goog.string.Unicode.NBSP;
                cell.appendChild(this.dom.createDom('span', 'n', n));
                cell.appendChild(this.dom.createDom('span', 'a', square.answer));
            } else {
                goog.dom.classes.add(cell, 'b');
            }
        }
    }

    // Track game state.
    var game = new derekslager.xword.Game(crossword);

    this.handler.listen(table,
                        goog.events.EventType.CLICK,
                        goog.bind(this.onCrosswordClicked, this, game));

    var keyHandler = new goog.events.KeyHandler(table);
    this.handler.listen(keyHandler,
                        goog.events.KeyHandler.EventType.KEY,
                        goog.bind(this.onCrosswordKey, this, game));

    container.appendChild(table);

    // Clues.
    var clues = this.dom.createDom('div', 'clues');

    var across = this.dom.createDom('div', 'c across');
    for (i = 0; i < crossword.across.length; i++) {
        var clue = crossword.across[i];
        var element = this.dom.createDom('div', null, clue.number + '. ' + clue.text);
        this.handler.listen(element,
                            goog.events.EventType.CLICK,
                            goog.partial(this.onClueClicked, game, clue));
        across.appendChild(element);
    }

    var down = this.dom.createDom('div', 'c across');
    for (i = 0; i < crossword.down.length; i++) {
        var clue = crossword.down[i];
        var element = this.dom.createDom('div', null, clue.number + '. ' + clue.text);
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
    game.x = clue.square.column;
    game.y = clue.square.row;
    game.direction = clue.direction;
    this.update(game);
    this.logger.fine('clicked clue corresponding to position ' +
                     clue.square.column + 'x' + clue.square.row);
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
derekslager.xword.XwordHtml.prototype.getCellValue = function(cell) {
    return this.dom.getTextContent(cell.firstChild.nextSibling);
};

/**
 * @param {Element} cell
 * @param {string} value
 */
derekslager.xword.XwordHtml.prototype.setCellValue = function(cell, value) {
    cell.firstChild.nextSibling.innerHTML = value;
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
        game.nextWord();
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
};

derekslager.xword.XwordHtml.prototype.onCrosswordClicked = function(game, e) {
    var cell = goog.dom.getAncestorByTagNameAndClass(e.target, goog.dom.TagName.TD);
    if (cell.nodeName === 'TD' && !goog.dom.classes.has(cell, 'b')) {

        this.beforeChange(game);

        var x = cell.cellIndex;
        var y = cell.parentNode.rowIndex;

        // If it's the same cell that was already highlighted, change
        // direction.
        if (x === game.x && y === game.y) {
            game.changeDirection();
        }

        game.x = x;
        game.y = y;

        this.update(game);
    }
};

derekslager.xword.XwordHtml.prototype.load = function() {
    this.handler.listen(this.dropZone, goog.events.EventType.DRAGOVER, this.onDragOver);
    this.handler.listen(this.dropZone, goog.events.EventType.DROP, this.onDrop);
    this.logger.fine('Event listeners added.');
};
