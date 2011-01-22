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
 * @type {string}
 */
derekslager.xword.Square.prototype.answer;

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
