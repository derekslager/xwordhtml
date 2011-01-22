goog.provide('derekslager.xword.Game');
goog.provide('derekslager.xword.Direction');
goog.provide('derekslager.xword.Game.EventType');

goog.require('goog.debug.LogManager');
goog.require('goog.dom.classes');
goog.require('goog.events.Event');
goog.require('goog.events.EventTarget');
goog.require('goog.string.Unicode');

/**
 * Class to track game state for a puzzle.
 * @param {derekslager.xword.Crossword} crossword
 * @constructor
 * @extends {goog.events.EventTarget}
 */
derekslager.xword.Game = function(crossword) {
    goog.base(this);

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
goog.inherits(derekslager.xword.Game, goog.events.EventTarget);

/**
 * Retrieves the current clue.
 * @return {derekslager.xword.Clue}
 */
derekslager.xword.Game.prototype.getCurrentClue = function() {
    var squares = this.getCurrentWordSquares();
    for (var i = 0; i < squares.length; i++) {
        var square = squares[i];
        if (this.direction == derekslager.xword.Direction.ACROSS) {
            if (square.across) {
                var clue = new derekslager.xword.Clue();
                clue.number = square.across;
                clue.direction = this.direction;
                clue.square = square;
                return clue;
            }
        } else if (square.down) {
            var clue = new derekslager.xword.Clue();
            clue.number = square.down;
            clue.direction = this.direction;
            clue.square = square;
            return clue;
        }
    }
    return null;
};

/**
 * @param {derekslager.xword.Direction} direction
 */
derekslager.xword.Game.prototype.setDirection = function(direction) {
    if (direction != this.direction) {
        this.changeDirection();
    }
};

/**
 * @param {derekslager.xword.Clue} previousClue
 */
derekslager.xword.Game.prototype.checkForClueChanged = function(previousClue) {
    var clue = this.getCurrentClue();
    if (previousClue.square.column != clue.square.column ||
        previousClue.square.row != clue.square.row ||
        previousClue.direction != clue.direction) {
        var event = new goog.events.Event(derekslager.xword.Game.EventType.CLUE_CHANGED);
        event.previousClue = previousClue;
        event.clue = clue;
        this.dispatchEvent(event);
    }
};

/**
 * Sets the current position.
 * @param {number} column
 * @param {number} row
 */
derekslager.xword.Game.prototype.setPosition = function(column, row) {
    var previousX = this.x;
    var previousY = this.y;

    var previousClue = this.getCurrentClue();

    this.x = column;
    this.y = row;

    if (previousX != this.x || previousY != this.y) {
        var event = new goog.events.Event(derekslager.xword.Game.EventType.POSITION_CHANGED);
        event.previousColumn = previousX;
        event.previousRow = previousY;
        event.column = column;
        event.row = row;
        this.dispatchEvent(event);

        this.checkForClueChanged(previousClue);
    }
};

/**
 * Move up, skipping past black squares.
 */
derekslager.xword.Game.prototype.moveUp = function() {
    var y = this.y;
    while (y-- > 0) {
        if (this.getSquare(this.x, y)) {
            this.setPosition(this.x, y);
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
            this.setPosition(this.x, y);
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
            this.setPosition(x, this.y);
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
            this.setPosition(x, this.y);
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
            this.setPosition(this.x - 1, this.y);
        }
    } else {
        if (this.y > 0 && this.getSquare(this.x, this.y - 1)) {
            this.setPosition(this.x, this.y - 1);
        }
    }
};

/**
 * Move to the next cell, if possible.
 */
derekslager.xword.Game.prototype.moveNext = function() {
    if (this.direction === derekslager.xword.Direction.ACROSS) {
        if (this.x < this.crossword.width - 1 && this.getSquare(this.x + 1, this.y)) {
            this.setPosition(this.x + 1, this.y);
        }
    } else {
        if (this.y < this.crossword.height - 1 && this.getSquare(this.x, this.y + 1)) {
            this.setPosition(this.x, this.y + 1);
        }
    }
};

/**
 * Move to the previous word.
 */
derekslager.xword.Game.prototype.previousWord = function() {
    var clue = this.getCurrentClue();
    var row = clue.square.row;
    var column = clue.square.column;
    while (true) {
        if (column-- == 0) {
            row = (row == 0 ? this.crossword.height - 1 : row - 1);
            column = this.crossword.width + 1;
        } else {
            var square = this.crossword.squares[row][column];
            if (!square) continue;
            if ((this.direction == derekslager.xword.Direction.ACROSS && square.across) ||
                (this.direction == derekslager.xword.Direction.DOWN && square.down)) {
                this.setPosition(column, row);
                return;
            }
        }
    }
};

/**
 * Move to the next word.
 */
derekslager.xword.Game.prototype.nextWord = function() {
    // TODO(derek): refactor, just need getCurrent(Numbered?)Square
    var clue = this.getCurrentClue();
    var row = clue.square.row;
    var column = clue.square.column;
    while (true) {
        if (column++ == this.crossword.width) {
            row = (row + 1) % this.crossword.height;
            column = -1;
        } else {
            var square = this.crossword.squares[row][column];
            if (!square) continue;
            if ((this.direction == derekslager.xword.Direction.ACROSS && square.across) ||
                (this.direction == derekslager.xword.Direction.DOWN && square.down)) {
                this.setPosition(column, row);
                return;
            }
        }
    }
};

derekslager.xword.Game.prototype.changeDirection = function() {
    var previousClue = this.getCurrentClue();

    this.direction =
        this.direction === derekslager.xword.Direction.ACROSS ?
        derekslager.xword.Direction.DOWN :
        derekslager.xword.Direction.ACROSS;

    this.dispatchEvent(derekslager.xword.Game.EventType.DIRECTION_CHANGED);
    this.checkForClueChanged(previousClue);
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
 * @enum {string}
 */
derekslager.xword.Game.EventType = {
    CLUE_CHANGED: 'word',
    POSITION_CHANGED: 'position',
    DIRECTION_CHANGED: 'direction'
};

/**
 * @enum {number}
 */
derekslager.xword.Direction = {
    ACROSS: 0,
    DOWN: 1
};
