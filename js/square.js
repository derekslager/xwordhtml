goog.provide('derekslager.xword.Square');

/**
 * @constructor
 */
derekslager.xword.Square = function() {};

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
 * @return {number?}
 */
derekslager.xword.Square.prototype.getNumber = function() {
    return this.down || this.across;
};
