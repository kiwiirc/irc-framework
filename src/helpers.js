'use strict';

const Helper = {
    parseMask,
    splitOnce,
};

module.exports = Helper;

function parseMask(mask) {
    let nick = '';
    let user = '';
    let host = '';

    const sep1 = mask.indexOf('!');
    const sep2 = mask.indexOf('@');

    if (sep1 === -1 && sep2 === -1) {
        // something
        if (mask.indexOf('.') > -1) {
            host = mask;
        } else {
            nick = mask;
        }
    } else if (sep1 === -1 && sep2 !== -1) {
        // something@something
        nick = mask.substring(0, sep2);
        host = mask.substring(sep2 + 1);
    } else if (sep1 !== -1 && sep2 === -1) {
        // something!something
        nick = mask.substring(0, sep1);
        user = mask.substring(sep1 + 1);
    } else {
        // something!something@something
        nick = mask.substring(0, sep1);
        user = mask.substring(sep1 + 1, sep2);
        host = mask.substring(sep2 + 1);
    }

    return {
        nick,
        user,
        host,
    };
}

function splitOnce(input, separator) {
    if (typeof input !== 'string' || typeof separator !== 'string') {
        throw new TypeError('input and separator must be strings');
    }

    let splitPos;

    if (separator === '') {
        // special handling required for empty string as separator

        // cannot match '' at start, so start searching after first character
        splitPos = input.indexOf(separator, 1);
        if (splitPos === input.length) {
            // cannot match '' at end, so if that's all we found, act like we found nothing
            splitPos = -1;
        }
    } else {
        // normal non-zero-length separator
        splitPos = input.indexOf(separator);
    }

    // no separator found
    if (splitPos < 0) {
        return [input];
    }

    // the normal case: split around first instance of separator
    return [
        input.slice(0, splitPos),
        input.slice(splitPos + separator.length),
    ];
}
