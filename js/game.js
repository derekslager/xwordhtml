goog.provide('derekslager.xword.Game');
goog.provide('derekslager.xword.Direction');

goog.require('goog.debug.LogManager');
goog.require('goog.dom.classes');
goog.require('goog.string.Unicode');

/**
 * Class to track game state for a puzzle.
 * @param {Element} table
 * @param {derekslager.xword.Crossword} crossword
 * @constructor
 */
derekslager.xword.Game = function(table, crossword) {

    this.logger = goog.debug.LogManager.getLogger('derekslager.xword.Game');

    this.table = table;
    this.crossword = crossword;

    /**
     * The current direction.
     * @type {derekslager.xword.Direction}
     */
    this.direction = derekslager.xword.Direction.ACROSS;

    this.x = 0;
    this.y = 0;
};

/**
 * @param {Element} cell
 */
derekslager.xword.Game.isBlack = function(cell) {
    return goog.dom.classes.has(cell, 'b');
};

/**
 * Move up, skipping past black squares.
 */
derekslager.xword.Game.prototype.moveUp = function() {
    var y = this.y;
    while (y-- > 0) {
        if (!derekslager.xword.Game.isBlack(this.getCell(this.x, y))) {
            this.y = y;
            break;
        }
    }
};

/**
 * Move down, skipping past black squares.
 */
derekslager.xword.Game.prototype.moveDown = function() {
    var y = this.y;
    var max = this.crossword.height - 1;
    while (y++ < max) {
        if (!derekslager.xword.Game.isBlack(this.getCell(this.x, y))) {
            this.y = y;
            break;
        }
    }
};

/**
 * Move left, skipping past black squares.
 */
derekslager.xword.Game.prototype.moveLeft = function() {
    var x = this.x;
    while (x-- > 0) {
        if (!derekslager.xword.Game.isBlack(this.getCell(x, this.y))) {
            this.x = x;
            break;
        }
    }
};

/**
 * Move right, skipping past black squares.
 */
derekslager.xword.Game.prototype.moveRight = function() {
    var x = this.x;
    var max = this.crossword.width - 1;
    while (x++ < max) {
        if (!derekslager.xword.Game.isBlack(this.getCell(x, this.y))) {
            this.x = x;
            break;
        }
    }
};

/**
 * Move to the previous cell, if possible.
 */
derekslager.xword.Game.prototype.movePrevious = function() {
    if (this.direction === derekslager.xword.Direction.ACROSS) {
        if (this.x > 0 &&
            !derekslager.xword.Game.isBlack(this.getCell(this.x - 1, this.y))) {
            this.x--;
        }
    } else {
        if (this.y > 0 &&
            !derekslager.xword.Game.isBlack(this.getCell(this.x, this.y - 1))) {
            this.y--;
        }
    }
};

/**
 * Move to the next cell, if possible.
 */
derekslager.xword.Game.prototype.moveNext = function() {
    if (this.direction === derekslager.xword.Direction.ACROSS) {
        if (this.x < this.crossword.width - 1 &&
            !derekslager.xword.Game.isBlack(this.getCell(this.x + 1, this.y))) {
            this.x++;
        }
    } else {
        if (this.y < this.crossword.height - 1 &&
            !derekslager.xword.Game.isBlack(this.getCell(this.x, this.y + 1))) {
            this.y++;
        }
    }
};

/**
 * Move to the next word.
 */
derekslager.xword.Game.prototype.nextWord = function() {
    var row = this.y;
    var cell = this.x;
    while (true) {
        if (cell++ == this.crossword.width) {
            row = (row + 1) % this.crossword.height;
            cell = -1;
        } else {
            var square = this.crossword.squares[row][cell];
            if (!square) continue;
            if ((this.direction == derekslager.xword.Direction.ACROSS && square.across) ||
                (this.direction == derekslager.xword.Direction.DOWN && square.down)) {
                this.x = cell;
                this.y = row;
                return;
            }
        }
    }
    // Shouldn't happen.
    return;
};

derekslager.xword.Game.prototype.changeDirection = function() {
    this.direction =
        this.direction === derekslager.xword.Direction.ACROSS ?
        derekslager.xword.Direction.DOWN :
        derekslager.xword.Direction.ACROSS;
};

/**
 * @param {Element} cell
 */
derekslager.xword.Game.prototype.getCellValue = function(cell) {
    return goog.dom.getTextContent(cell.firstChild.nextSibling);
};

/**
 * @param {Element} cell
 * @param {string} value
 */
derekslager.xword.Game.prototype.setCellValue = function(cell, value) {
    cell.firstChild.nextSibling.innerHTML = value;
};

/**
 * @param {number} x
 * @param {number} y
 */
derekslager.xword.Game.prototype.getCell = function(x, y) {
    return this.table.rows[y].cells[x];
};

/**
 * @return {Element}
 */
derekslager.xword.Game.prototype.getCurrentCell = function() {
    return this.getCell(this.x, this.y);
};

/**
 * @param {Element} cell
 */
derekslager.xword.Game.prototype.isCellEmpty = function(cell) {
    var value = this.getCellValue(cell);
    this.logger.fine('isCellEmpty: "' + value + '"');
    return !value || value == goog.string.Unicode.NBSP;
};

/**
 * Retrieve the cells for the current word, in no particular order.
 * @return {Array.<Element>}
 */
derekslager.xword.Game.prototype.getCurrentWordCells = function() {
    var cells = [];
    cells.push(this.getCurrentCell());
    if (this.direction == derekslager.xword.Direction.ACROSS) {
        for (var i = this.x + 1; i < this.crossword.width; i++) {
            var cell = this.getCell(i, this.y);
            if (derekslager.xword.Game.isBlack(cell)) break;
            cells.push(cell);
        }
        for (i = this.x - 1; i >= 0; i--) {
            var cell = this.getCell(i, this.y);
            if (derekslager.xword.Game.isBlack(cell)) break;
            cells.push(cell);
        }
    } else {
        for (var i = this.y + 1; i < this.crossword.height; i++) {
            var cell = this.getCell(this.x, i);
            if (derekslager.xword.Game.isBlack(cell)) break;
            cells.push(cell);
        }
        for (i = this.y - 1; i >= 0; i--) {
            var cell = this.getCell(this.x, i);
            if (derekslager.xword.Game.isBlack(cell)) break;
            cells.push(cell);
        }
    }
    return cells;
};

/**
 * @enum {number}
 */
derekslager.xword.Direction = {
    ACROSS: 0,
    DOWN: 1
};
