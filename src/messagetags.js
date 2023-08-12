'use strict';

const Helpers = require('./helpers');

module.exports.decodeValue = decodeValue;
module.exports.encodeValue = encodeValue;
module.exports.decode = decode;
module.exports.encode = encode;
module.exports.parseDenylist = parseDenylist;
module.exports.isBlocked = isBlocked;

const tokens_map = {
    '\\\\': '\\',
    '\\:': ';',
    '\\s': ' ',
    '\\n': '\n',
    '\\r': '\r',
    '\\': '', // remove invalid backslashes
};

const token_lookup = /\\\\|\\:|\\s|\\n|\\r|\\/gi;

function decodeValue(value) {
    return value.replace(token_lookup, m => tokens_map[m] || '');
}

const vals_map = {
    '\\': '\\\\',
    ';': '\\:',
    ' ': '\\s',
    '\n': '\\n',
    '\r': '\\r',
};

const val_lookup = /\\|;| |\n|\r/gi;

function encodeValue(value) {
    return value.replace(val_lookup, m => vals_map[m] || '');
}

function decode(tag_str) {
    const tags = Object.create(null);

    tag_str.split(';').forEach(tag => {
        const parts = Helpers.splitOnce(tag, '=');
        const key = parts[0].toLowerCase();
        let value = parts[1] || '';

        if (!key) {
            return;
        }

        value = decodeValue(value);
        tags[key] = value;
    });

    return tags;
}

function encode(tags, separator = ';') {
    const parts = Object.keys(tags).map(key => {
        const val = tags[key];

        if (typeof val === 'boolean') {
            return key;
        }

        return key + '=' + encodeValue(val.toString());
    });

    return parts.join(separator);
}

// Parses a raw CLIENTTAGDENY= denylist
// into a { allBlockedByDefault: boolean, explicitlyAccepted: string[], explicitlyDenied: string[] }
// structure.
function parseDenylist(raw) {
    const denylist = {
        allBlockedByDefault: false,
        explicitlyAccepted: [],
        explicitlyDenied: []
    };
    const parts = raw.split(',');

    for (let idx = 0; idx < parts.length; idx++) {
        const tag = parts[idx];
        if (tag === '') {
            continue;
        }

        if (tag === '*') {
            denylist.allBlockedByDefault = true;
            continue;
        }

        if (tag[0] === '-') {
            denylist.explicitlyAccepted.push(tag.slice(1));
        } else {
            denylist.explicitlyDenied.push(tag);
        }
    }

    return denylist;
}

// Takes a parsed denylist and returns whether tag is allowed
// according to current denial policies.
function isBlocked(denylist, tag) {
    if (denylist.allBlockedByDefault) {
        return !denylist.explicitlyAccepted.includes(tag);
    } else {
        return denylist.explicitlyDenied.includes(tag);
    }
}
