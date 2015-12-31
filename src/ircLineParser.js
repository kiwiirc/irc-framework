var _ = require('lodash'),
    parseISO8601 = require('./parseiso8601');

/**
 * The regex that parses a line of data from the IRCd
 * Deviates from the RFC a little to support the '/' character now used in some
 * IRCds
 */
var parse_regex = /^(?:@([^ ]+) )?(?::((?:(?:([^\s!@]+)(?:!([^\s@]+))?)@)?(\S+)) )?((?:[a-zA-Z]+)|(?:[0-9]{3}))(?: ([^:].*?))?(?: :(.*))?$/i;

function parseIrcLine(line) {
    var msg,
        i,
        tags = [],
        tag,
        params;

    // Parse the complete line, removing any carriage returns
    msg = parse_regex.exec(line.replace(/^\r+|\r+$/, ''));

    if (!msg) {
        // The line was not parsed correctly, must be malformed
        console.log('Malformed IRC line: %s', line.replace(/^\r+|\r+$/, ''));
        return;
    }

    // Extract any tags (msg[1])
    if (msg[1]) {
        tags = msg[1].split(';');

        for (i = 0; i < tags.length; i++) {
            tag = tags[i].split('=');
            tags[i] = {tag: tag[0], value: tag[1]};
        }
    }

    params = msg[7] ? msg[7].split(/ +/) : [];

    if (typeof msg[8] !== 'undefined') {
        params.push(msg[8].trimRight());
    }

    return new Message(tags, msg[2], msg[3] || msg[2], msg[4] || '', msg[5] || '', msg[6], params);
}

module.exports = parseIrcLine;

function Message(tags, prefix, nick, ident, hostname, command, params) {
    this.tags = tags;
    this.prefix = prefix;
    this.nick = nick;
    this.ident = ident;
    this.hostname = hostname;
    this.command = command;
    this.params = params;
}

Message.prototype.getServerTime = function () {
    var time;

    // No tags? No times.
    if (!this.tags || this.tags.length === 0) {
        return;
    }

    time = _.find(this.tags, function (tag) {
        return tag.tag === 'time';
    });

    if (time) {
        time = time.value;
    }

    // Convert the time value to a unixtimestamp
    if (typeof time === 'string') {
        if (time.indexOf('T') > -1) {
            time = parseISO8601(time);

        } else if(time.match(/^[0-9.]+$/)) {
            // A string formatted unix timestamp
            time = new Date(time * 1000);
        }

        time = time.getTime();

    } else if (typeof time === 'number') {
        time = new Date(time * 1000);
        time = time.getTime();
    }

    return time;
};
