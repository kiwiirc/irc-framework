'use strict';

var MessageTags = require('./messagetags');
var IrcMessage = require('./ircmessage');

module.exports = parseIrcLine;

/**
 * The regex that parses a line of data from the IRCd
 * Deviates from the RFC a little to support the '/' character now used in some
 * IRCds
 */
var parse_regex = /^(?:@([^ ]+) )?(?::((?:(?:([^\s!@]+)(?:!([^\s@]+))?)@)?(\S+)) )?((?:[a-zA-Z]+)|(?:[0-9]{3}))(?: ([^:].*?))?(?: :(.*))?$/i;
var newline_regex = /^[\r\n]+|[\r\n]+$/g;

function parseIrcLine(line) {
    // Parse the complete line, removing any carriage returns
    let matches = parse_regex.exec(line.replace(newline_regex, ''));
    if (!matches) {
        // The line was not parsed correctly, must be malformed
        return;
    }

    let msg = new IrcMessage();

    if (matches[1]) {
        msg.tags = MessageTags.decode(matches[1]);
    }

    msg.prefix = matches[2] || '';
    // Nick will be in the prefix slot if a full user mask is not used
    msg.nick = matches[3] || matches[2] || '';
    msg.ident = matches[4] || '';
    msg.hostname = matches[5] || '';
    msg.command = matches[6] || '';
    msg.params = matches[7] ? matches[7].split(/ +/) : [];

    // Add the trailing param to the params list
    if (typeof matches[8] !== 'undefined') {
        msg.params.push(matches[8]);
    }

    return msg;
}
