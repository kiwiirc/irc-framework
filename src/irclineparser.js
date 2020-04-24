'use strict';

const MessageTags = require('./messagetags');
const IrcMessage = require('./ircmessage');
const helpers = require('./helpers');

module.exports = parseIrcLine;

const newline_regex = /^[\r\n]+|[\r\n]+$/g;

function parseIrcLine(input_) {
    const input = input_.replace(newline_regex, '');
    let cPos = 0;
    let inParams = false;

    const nextToken = () => {
        // Fast forward to somewhere with actual data
        while (input[cPos] === ' ' && cPos < input.length) {
            cPos++;
        }

        if (cPos === input.length) {
            // If reading the params then return null to indicate no more params available.
            // The trailing parameter may be empty but should still be included as an empty string.
            return inParams ? null : '';
        }

        let end = input.indexOf(' ', cPos);
        if (end === -1) {
            // No more spaces means were on the last token
            end = input.length;
        }

        if (inParams && input[cPos] === ':' && input[cPos - 1] === ' ') {
            // If a parameter start with : then we're in the last parameter which may incude spaces
            cPos++;
            end = input.length;
        }

        const token = input.substring(cPos, end);
        cPos = end;

        // Fast forward our current position so we can peek what's next via input[cPos]
        while (input[cPos] === ' ' && cPos < input.length) {
            cPos++;
        }

        return token;
    };

    const ret = new IrcMessage();

    if (input[cPos] === '@') {
        ret.tags = MessageTags.decode(nextToken().substr(1));
    }

    if (input[cPos] === ':') {
        ret.prefix = nextToken().substr(1);
        const mask = helpers.parseMask(ret.prefix);
        ret.nick = mask.nick;
        ret.ident = mask.user;
        ret.hostname = mask.host;
    }

    ret.command = nextToken().toUpperCase();

    inParams = true;

    let token = nextToken();
    while (token !== null) {
        ret.params.push(token);
        token = nextToken();
    }

    return ret;
}
