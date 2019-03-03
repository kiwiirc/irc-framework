'use strict';

var _ = {
    clone: require('lodash/clone'),
};

const numberRegex = /^[0-9.]{1,}$/;

module.exports = class IrcCommand {
    constructor(command, data) {
        this.command = command += '';
        this.params = _.clone(data.params);
        this.tags = _.clone(data.tags);

        this.prefix = data.prefix;
        this.nick = data.nick;
        this.ident = data.ident;
        this.hostname = data.hostname;
    }

    getTag(tag_name) {
        return this.tags[tag_name.toLowerCase()];
    }

    getServerTime() {
        const timeTag = this.getTag('time');
        let time;

        // Explicitly return undefined if theres no time
        // or the value is an empty string
        if (!timeTag) {
            return time;
        }

        // If parsing fails for some odd reason, also fallback to
        // undefined, instead of returning NaN
        time = Date.parse(timeTag) || undefined;

        // Support for znc.in/server-time unix timestamps
        if (!time && numberRegex.test(timeTag)) {
            return new Date(timeTag * 1000).getTime();
        }

        return time;
    }
};
