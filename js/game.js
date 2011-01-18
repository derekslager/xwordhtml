goog.provide('derekslager.xword.Game');
goog.provide('derekslager.xword.Direction');

goog.require('goog.debug.LogManager');
goog.require('goog.dom.classes');
goog.require('goog.string.Unicode');

/**
 * Class to track game state for a puzzle.
 * @param {derekslager.xword.Crossword} crossword
 * @constructor
 */
derekslager.xword.Game = function(crossword) {

    this.logger = goog.debug.LogManager.getLogger('derekslager.xword.Game');

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
 * Move up, skipping past black squares.
 */
derekslager.xword.Game.prototype.moveUp = function() {
    var y = this.y;
    while (y-- > 0) {
        if (this.getSquare(this.x, y)) {
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
        if (this.getSquare(this.x, y)) {
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
        if (this.getSquare(x, this.y)) {
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
        if (this.getSquare(x, this.y)) {
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
        if (this.x > 0 && this.getSquare(this.x - 1, this.y)) {
            this.x--;
        }
    } else {
        if (this.y > 0 && this.getSquare(this.x, this.y - 1)) {
            this.y--;
        }
    }
};

/**
 * Move to the next cell, if possible.
 */
derekslager.xword.Game.prototype.moveNext = function() {
    if (this.direction === derekslager.xword.Direction.ACROSS) {
        if (this.x < this.crossword.width - 1 && this.getSquare(this.x + 1, this.y)) {
            this.x++;
        }
    } else {
        if (this.y < this.crossword.height - 1 && this.getSquare(this.x, this.y + 1)) {
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
};

derekslager.xword.Game.prototype.changeDirection = function() {
    this.direction =
        this.direction === derekslager.xword.Direction.ACROSS ?
        derekslager.xword.Direction.DOWN :
        derekslager.xword.Direction.ACROSS;
};

/**
 * @param {number} x
 * @param {number} y
 */
derekslager.xword.Game.prototype.getSquare = function(x, y) {
    return this.crossword.squares[y][x];
};

/**
 * @return {derekslager.xword.Square}
 */
derekslager.xword.Game.prototype.getCurrentSquare = function() {
    return this.getSquare(this.x, this.y);
};

/**
 * Retrieve the cells for the current word, in no particular order.
 * @return {Array.<derekslager.xword.Square>}
 */
derekslager.xword.Game.prototype.getCurrentWordSquares = function() {
    var squares = [];
    squares.push(this.getCurrentSquare());
    if (this.direction == derekslager.xword.Direction.ACROSS) {
        for (var i = this.x + 1; i < this.crossword.width; i++) {
            var square = this.getSquare(i, this.y);
            if (!square) break;
            squares.push(square);
        }
        for (i = this.x - 1; i >= 0; i--) {
            var square = this.getSquare(i, this.y);
            if (!square) break;
            squares.push(square);
        }
    } else {
        for (var i = this.y + 1; i < this.crossword.height; i++) {
            var square = this.getSquare(this.x, i);
            if (!square) break;
            squares.push(square);
        }
        for (i = this.y - 1; i >= 0; i--) {
            var square = this.getSquare(this.x, i);
            if (!square) break;
            squares.push(square);
        }
    }
    return squares;
};

/**
 * @enum {number}
 */
derekslager.xword.Direction = {
    ACROSS: 0,
    DOWN: 1
};
