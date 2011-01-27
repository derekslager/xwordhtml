goog.provide('derekslager.xword.Square');

/**
 * @constructor
 */
derekslager.xword.Square = function() {};

/**
 * @type {number}
 */
derekslager.xword.Square.prototype.row;

/**
 * @type {number}
 */
derekslager.xword.Square.prototype.column;

/**
 * The answer, or the first letter of the answer if the square is a
 * rebus.
 * @type {string}
 */
derekslager.xword.Square.prototype.answer;

/**
 * The rebus for this square. This take precedence over answer when
 * present.
 * @type {string}
 */
derekslager.xword.Square.prototype.rebus;

/**
 * The value as entered by the user.
 * @type {string}
 */
derekslager.xword.Square.prototype.value;

/**
 * @type {number}
 */
derekslager.xword.Square.prototype.down;

/**
 * @type {number}
 */
derekslager.xword.Square.prototype.across;

/**
 * @type {boolean}
 */
derekslager.xword.Square.prototype.circled;

/**
 * @return {number?}
 */
derekslager.xword.Square.prototype.getNumber = function() {
    return this.down || this.across;
};
