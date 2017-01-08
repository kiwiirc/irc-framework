var _ = require('lodash');

module.exports = IrcCommand;


function IrcCommand(command, data) {
    this.command = command += '';
    this.params = _.clone(data.params);
    this.tags = _.clone(data.tags);

    this.prefix = data.prefix;
    this.nick = data.nick;
    this.ident = data.ident;
    this.hostname = data.hostname;
}


IrcCommand.prototype.getTag = function(tag_name) {
    return this.tags[tag_name.toLowerCase()];
};


IrcCommand.prototype.getServerTime = function() {
    var time = this.getTag('time');

    // Convert the time value to a unixtimestamp
    if (typeof time === 'string') {
        if (time.indexOf('T') > -1) {
            time = parseISO8601(time);

        } else if (time.match(/^[0-9.]+$/)) {
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





// Code based on http://anentropic.wordpress.com/2009/06/25/javascript-iso8601-parser-and-pretty-dates/#comment-154
function parseISO8601(str) {
    if (Date.prototype.toISOString) {
        return new Date(str);
    }

    var parts = str.split('T');
    var dateParts = parts[0].split('-');
    var timeParts = parts[1].split('Z');
    var timeSubParts = timeParts[0].split(':');
    var timeSecParts = timeSubParts[2].split('.');
    var timeHours = Number(timeSubParts[0]);
    var _date = new Date();

    _date.setUTCFullYear(Number(dateParts[0]));
    _date.setUTCDate(1);
    _date.setUTCMonth(Number(dateParts[1]) - 1);
    _date.setUTCDate(Number(dateParts[2]));
    _date.setUTCHours(Number(timeHours));
    _date.setUTCMinutes(Number(timeSubParts[1]));
    _date.setUTCSeconds(Number(timeSecParts[0]));
    if (timeSecParts[1]) {
        _date.setUTCMilliseconds(Number(timeSecParts[1]));
    }
}
