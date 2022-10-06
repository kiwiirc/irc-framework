'use strict';

const _ = {
    partial: require('lodash/partial'),
    filter: require('lodash/filter'),
    find: require('lodash/find'),
    each: require('lodash/each'),
    pull: require('lodash/pull'),
    extend: require('lodash/extend'),
};

const DuplexStream = require('stream').Duplex;

module.exports = class IrcChannel {
    constructor(irc_client, channel_name, key) {
        this.irc_client = irc_client;
        this.name = channel_name;

        // TODO: Proxy channel related events from irc_bot to this instance

        this.say = _.partial(irc_client.say.bind(irc_client), channel_name);
        this.notice = _.partial(irc_client.notice.bind(irc_client), channel_name);
        // this.action = _.partial(irc_client.action.bind(irc_client), channel_name);
        this.part = _.partial(irc_client.part.bind(irc_client), channel_name);
        this.join = _.partial(irc_client.join.bind(irc_client), channel_name);
        this.mode = _.partial(irc_client.mode.bind(irc_client), channel_name);
        this.banlist = _.partial(irc_client.banlist.bind(irc_client), channel_name);
        this.ban = _.partial(irc_client.ban.bind(irc_client), channel_name);
        this.unban = _.partial(irc_client.unban.bind(irc_client), channel_name);

        this.users = [];
        irc_client.on('userlist', (event) => {
            if (irc_client.caseCompare(event.channel, this.name)) {
                this.users = event.users;
            }
        });
        irc_client.on('join', (event) => {
            if (irc_client.caseCompare(event.channel, this.name)) {
                this.users.push(event);
            }
        });
        irc_client.on('part', (event) => {
            if (irc_client.caseCompare(event.channel, this.name)) {
                this.users = _.filter(this.users, function(o) {
                    return !irc_client.caseCompare(event.nick, o.nick);
                });
            }
        });
        irc_client.on('kick', (event) => {
            if (irc_client.caseCompare(event.channel, this.name)) {
                this.users = _.filter(this.users, function(o) {
                    return !irc_client.caseCompare(event.kicked, o.nick);
                });
            }
        });
        irc_client.on('quit', (event) => {
            this.users = _.filter(this.users, function(o) {
                return !irc_client.caseCompare(event.nick, o.nick);
            });
        });
        irc_client.on('nick', (event) => {
            _.find(this.users, function(o) {
                if (irc_client.caseCompare(event.nick, o.nick)) {
                    o.nick = event.new_nick;
                    return true;
                }
            });
        });
        irc_client.on('mode', (event) => {
            /* event will be something like:
            {
                target: '#prawnsalad',
                nick: 'ChanServ',
                modes: [ { mode: '+o', param: 'prawnsalad' } ],
                time: undefined
            }
            */

            if (!irc_client.caseCompare(event.target, this.name)) {
                return;
            }

            // There can be multiple modes set at once, loop through
            _.each(event.modes, mode => {
                // If this mode has a user prefix then we need to update the user object
                // eg. +o +h +v
                const user_prefix = _.find(irc_client.network.options.PREFIX, {
                    mode: mode.mode[1],
                });

                if (!user_prefix) {
                    // TODO : manage channel mode changes
                } else { // It's a user mode
                    // Find the user affected
                    const user = _.find(this.users, u =>
                        irc_client.caseCompare(u.nick, mode.param)
                    );

                    if (!user) {
                        return;
                    }

                    if (mode.mode[0] === '+') {
                        user.modes = user.modes || [];
                        user.modes.push(mode.mode[1]);
                    } else {
                        _.pull(user.modes, mode.mode[1]);
                    }
                }
            });
        });

        this.join(key);
    }

    /**
     * Relay messages between this channel to another
     * @param  {IrcChannel|String} target_chan Target channel
     * @param  {Object} opts        Extra options
     *
     * opts may contain the following properties:
     * one_way (false) Only relay messages to target_chan, not the reverse
     * replay_nicks (true) Include the sending nick as part of the relayed message
     */
    relay(target_chan, opts) {
        opts = _.extend({
            one_way: false,
            replay_nicks: true
        }, opts);

        if (typeof target_chan === 'string') {
            target_chan = this.irc_client.channel(target_chan);
        }
        const this_stream = this.stream(opts);
        const other_stream = target_chan.stream(opts);

        this_stream.pipe(other_stream);
        if (!opts.one_way) {
            other_stream.pipe(this_stream);
        }
    }

    stream(stream_opts) {
        const read_queue = [];
        let is_reading = false;

        const stream = new DuplexStream({
            objectMode: true,

            write: (chunk, encoding, next) => {
                // Support piping from one irc buffer to another
                if (typeof chunk === 'object' && typeof chunk.message === 'string') {
                    if (stream_opts.replay_nicks) {
                        chunk = '<' + chunk.nick + '> ' + chunk.message;
                    } else {
                        chunk = chunk.message;
                    }
                }

                this.say(chunk.toString());
                next();
            },

            read: () => {
                is_reading = true;

                while (read_queue.length > 0) {
                    const message = read_queue.shift();
                    if (stream.push(message) === false) {
                        is_reading = false;
                        break;
                    }
                }
            }
        });

        this.irc_client.on('privmsg', (event) => {
            if (this.irc_client.caseCompare(event.target, this.name)) {
                read_queue.push(event);

                if (is_reading) {
                    stream._read();
                }
            }
        });

        return stream;
    }

    updateUsers(cb) {
        const updateUserList = (event) => {
            if (this.irc_client.caseCompare(event.channel, this.name)) {
                this.irc_client.removeListener('userlist', updateUserList);
                if (typeof cb === 'function') { cb(this); }
            }
        };

        this.irc_client.on('userlist', updateUserList);
        this.irc_client.raw('NAMES', this.name);
    }
};
