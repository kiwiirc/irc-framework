const GraphemeSplitter = require('grapheme-splitter');
const { encode: encodeUTF8 } = require('isomorphic-textencoder');

const graphemeSplitter = new GraphemeSplitter();

/* abstract */ class SubstringTooLargeForLineError extends Error {
    /* substring: string */
    /* opts: Options */

    constructor(substring/* : string */, opts/* : Options */) {
        super();

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        // @ts-ignore
        if (Error.captureStackTrace) {
            // @ts-ignore
            Error.captureStackTrace(this, this.constructor);
        }

        // Custom debugging information
        this.substring = substring;
        this.opts = opts;
    }

    get name() {
        return this.constructor.name;
    }
}

class WordTooLargeForLineError extends SubstringTooLargeForLineError {
    get message() {
        return `${size(this.substring)} byte word can't fit in a ${this.opts.bytes} byte block: ${this.substring}`;
    }
}

class GraphemeTooLargeForLineError extends SubstringTooLargeForLineError {
    get message() {
        return `${size(this.substring)} byte grapheme can't fit in a ${this.opts.bytes} byte block: ${this.substring}`;
    }
}

class CodepointTooLargeForLineError extends SubstringTooLargeForLineError {
    get message() {
        return `${size(this.substring)} byte codepoint can't fit in a ${this.opts.bytes} byte block: ${this.substring}`;
    }
}

function size(str/* : string */)/* : number */ {
    const byteArray = encodeUTF8(str);
    const bytes = byteArray.byteLength;
    return bytes;
}

/* export interface Options {
    bytes: number,
    allowBreakingWords?: boolean,
    allowBreakingGraphemes?: boolean,
} */

function * lineBreak(str/* : string */, opts/* : Options */)/* : IterableIterator<string> */ {
    let line = '';
    let previousWhitespace = '';

    for (const [word, trailingWhitespace] of wordBreak(str)) {
        // word fits in current line
        if (size(line) + size(previousWhitespace) + size(word) <= opts.bytes) {
            line += previousWhitespace + word;
            previousWhitespace = trailingWhitespace;
            continue;
        }

        // can fit word in a line by itself
        if (size(word) <= opts.bytes) {
            if (line) {
                yield line; // yield previously built up line
            }

            // previously buffered whitespace is discarded as it was replaced by a line break
            // store new whitespace for later
            previousWhitespace = trailingWhitespace;

            line = word; // next line starts with word
            continue;
        }

        // can't fit word into a line by itself
        if (!opts.allowBreakingWords) {
            throw new WordTooLargeForLineError(word, opts);
        }

        // try to fit part of word into current line
        const wordPreviousWhitespace = trailingWhitespace;
        for (const grapheme of graphemeSplitter.iterateGraphemes(word)) {
            // can fit next grapheme
            if (size(line) + size(previousWhitespace) + size(grapheme) <= opts.bytes) {
                line += previousWhitespace + grapheme;
                previousWhitespace = '';
                continue;
            }

            // can fit next grapheme into a line by itself
            if (size(grapheme) <= opts.bytes) {
                if (line) {
                    yield line;
                }
                previousWhitespace = '';
                line = grapheme;
                continue;
            }

            // grapheme can't fit in a single line
            if (!opts.allowBreakingGraphemes) {
                throw new GraphemeTooLargeForLineError(grapheme, opts);
            }

            // break grapheme into codepoints instead
            for (const codepoint of grapheme) {
                // can fit codepoint into current line
                if (size(line) + size(previousWhitespace) + size(codepoint) <= opts.bytes) {
                    line += previousWhitespace + codepoint;
                    previousWhitespace = '';
                    continue;
                }

                // can fit codepoint into its own line
                if (size(codepoint) <= opts.bytes) {
                    if (line) {
                        yield line;
                    }
                    previousWhitespace = '';
                    line = codepoint;
                    continue;
                }

                // can't fit codepoint into its own line
                throw new CodepointTooLargeForLineError(codepoint, opts);
            } // end of codepoint loop
        } // end of grapheme loop
        previousWhitespace = wordPreviousWhitespace;
    } // end of [word, trailingWhitespace] loop

    // unyielded leftovers when we're done iterating over the input string
    if (previousWhitespace) {
        if (size(line) + size(previousWhitespace) <= opts.bytes) {
            line += previousWhitespace; // retain trailing whitespace on input line if possible
        }
    }
    if (line) {
        yield line;
    }
}

// yields [word, trailingWhitespace] tuples
function * wordBreak(str/* : string */)/* : IterableIterator<[string, string]> */ {
    let word = '';
    let trailingWhitespace = '';

    for (const grapheme of graphemeSplitter.iterateGraphemes(str)) {
        // grapheme is whitespace
        if (/^\s+$/.test(grapheme)) {
            // collect whitespace
            trailingWhitespace += grapheme;
            continue;
        }

        // grapheme is non-whitespace

        // start of new word
        if (trailingWhitespace) {
            yield [word, trailingWhitespace];
            word = grapheme;
            trailingWhitespace = '';
            continue;
        }

        // continuation of word
        word += grapheme;
    }

    // possible leftovers at end of input string
    if (word) {
        yield [word, trailingWhitespace];
    }
    // trailingWhitespace can't be non-empty unless word is non-empty
}

module.exports = {
    WordTooLargeForLineError,
    GraphemeTooLargeForLineError,
    CodepointTooLargeForLineError,
    lineBreak,
    wordBreak,
};
