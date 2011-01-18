goog.provide('derekslager.xword.Crossword');

/**
 * @constructor
 */
derekslager.xword.Crossword = function() {
    // title,author,copyright
    // width,height
    // down,across
    // squares
    // checksumOk
};

/** @type {string} */
derekslager.xword.Crossword.prototype.title;

/** @type {string} */
derekslager.xword.Crossword.prototype.author;

/** @type {string} */
derekslager.xword.Crossword.prototype.copyright;

/** @type {number} */
derekslager.xword.Crossword.prototype.width;

/** @type {number} */
derekslager.xword.Crossword.prototype.height;

/** @type {Array.<Array.<derekslager.xword.Square>>} */
derekslager.xword.Crossword.prototype.squares;

/** @type {Array.<string>} */
derekslager.xword.Crossword.prototype.solution;

/** @type {Array.<string>} */
derekslager.xword.Crossword.prototype.clues;

/** @type {Array.<string>} */
derekslager.xword.Crossword.prototype.across = [];

/** @type {Array.<string>} */
derekslager.xword.Crossword.prototype.down = [];

/** @type {string} */
derekslager.xword.Crossword.prototype.notes;
