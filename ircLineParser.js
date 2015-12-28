module.exports = parseIrcLine;
/**
 * The regex that parses a line of data from the IRCd
 * Deviates from the RFC a little to support the '/' character now used in some
 * IRCds
 */
var parse_regex = /^(?:(?:(?:@([^ ]+) )?):(?:([^\s!]+)|([^\s!]+)!([^\s@]+)@?([^\s]+)?) )?(\S+)(?: (?!:)(.+?))?(?: :(.*))?$/i;

function parseIrcLine(line) {
    var msg,
        i,
        tags = [],
        tag,
        msg_obj;

    // Parse the complete line, removing any carriage returns
    msg = parse_regex.exec(line.replace(/^\r+|\r+$/, ''));

    if (!msg) {
        // The line was not parsed correctly, must be malformed
        log('Malformed IRC line: %s', line.replace(/^\r+|\r+$/, ''));
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

    msg_obj = {
        tags:       tags,
        prefix:     msg[2],
        nick:       msg[3] || msg[2],  // Nick will be in the prefix slot if a full user mask is not used
        ident:      msg[4] || '',
        hostname:   msg[5] || '',
        command:    msg[6],
        params:     msg[7] ? msg[7].split(/ +/) : []
    };

    if (msg[8]) {
        msg_obj.params.push(msg[8].trimRight());
    }

    return msg_obj;
}