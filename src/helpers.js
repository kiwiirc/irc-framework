'use strict';

const _ = {
    map: require('lodash/map'),
};

const Helper = {
    parseMask: parseMask,
    parseWhoFlags: parseWhoFlags,
    splitOnce: splitOnce,
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
        nick: nick,
        user: user,
        host: host,
    };
}

function parseWhoFlags(flagsParam, networkOptions) {
    // https://modern.ircdocs.horse/#rplwhoreply-352
    // unrealircd https://github.com/unrealircd/unrealircd/blob/8536778/doc/conf/help/help.conf#L429

    const unparsedFlags = flagsParam.split('');

    // Add function to check for flags existence and remove it if existing
    Object.defineProperty(unparsedFlags, 'hasThenRemove', {
        value: (flag) => {
            const flagIdx = unparsedFlags.indexOf(flag);
            if (flagIdx > -1) {
                unparsedFlags.splice(flagIdx, 1);
                return true;
            }
            return false;
        }
    });

    // away is always the first character, G = Gone, H = Here
    const is_away = unparsedFlags.shift().toUpperCase() === 'G';

    // operator flag is option but would always be the second character
    const is_operator = unparsedFlags[0] === '*' && !!unparsedFlags.shift();

    // the flags object to be returned
    const flags = {
        away: is_away,
        operator: is_operator,
        registered: unparsedFlags.hasThenRemove('r'),
        secure: unparsedFlags.hasThenRemove('s'),
    };

    // add bot mode if its flag is supported by the ircd
    const bot_mode_token = networkOptions.BOT;
    if (bot_mode_token) {
        flags.bot = unparsedFlags.hasThenRemove(bot_mode_token);
    }

    // filter PREFIX array against the prefix's in who reply returning matched PREFIX objects
    const chan_prefixes = networkOptions.PREFIX.filter(f => unparsedFlags.hasThenRemove(f.symbol));
    // use _.map to return an array of mode strings from matched PREFIX objects
    flags.channel_modes = _.map(chan_prefixes, 'mode');

    // store any remaining flags in case they are useful
    flags.unparsed = unparsedFlags;

    return flags;
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
