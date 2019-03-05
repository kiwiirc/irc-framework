'use strict';

const Helpers = require('./helpers');

module.exports.decodeValue = decodeValue;
module.exports.encodeValue = encodeValue;
module.exports.decode = decode;
module.exports.encode = encode;

const tokens_map = {
    '\\\\': '\\',
    '\\:':  ';',
    '\\s':  ' ',
    '\\n':  '\n',
    '\\r':  '\r',
    '\\': '', // remove invalid backslashes
};

const token_lookup = /\\\\|\\:|\\s|\\n|\\r|\\/gi;

function decodeValue(value) {
    return value.replace(token_lookup, m => tokens_map[m] || '');
}

const vals_map = {
    '\\': '\\\\',
    ';':  '\\:',
    ' ':  '\\s',
    '\n': '\\n',
    '\r': '\\r',
};

const val_lookup = /\\|;| |\n|\r/gi;

function encodeValue(value) {
    return value.replace(val_lookup, m => vals_map[m] || '');
}

function decode(tag_str) {
    let tags = Object.create(null);

    tag_str.split(';').forEach(tag => {
        let parts = Helpers.splitOnce(tag, '=');
        let key = parts[0].toLowerCase();
        let value = parts[1] || '';

        if (!key) {
            return;
        }

        value = decodeValue(value);
        tags[key] = value;
    });

    return tags;
}

function encode(tags) {
    let parts = Object.keys(tags).map(key => {
        let val = tags[key];

        if (typeof val === 'boolean') {
            return key;
        }

        return key + '=' + encodeValue(val.toString());
    });

    return parts.join(';');
}
