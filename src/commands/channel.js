var _ = require('lodash'),
    parseModeList = require('../parsemodelist');

var handlers = {
    '324': function RPL_CHANNELMODEIS(client, command, next) {
        var channel = command.params[1],
            modes = parseModeList(client.ircd_options.CHANMODES || [], client.ircd_options.PREFIX || [], command.params[2], command.params.slice(3));

        client.emit('channel info', {
            channel: channel,
            modes: modes
        });

        next();
    },


    '329': function RPL_CREATIONTIME(client, command, next) {
        var channel = command.params[1];

        client.emit('channel info', {
            channel: channel,
            created_at: parseInt(command.params[2], 10)
        });

        next();
    },


    '328': function RPL_CHANNEL_URL(client, command, next) {
        var channel = command.params[1];

        client.emit('channel info', {
            channel: channel,
            url: command.params[command.params.length - 1]
        });

        next();
    },


    '353': function RPL_NAMEREPLY(client, command, next) {
        var that = this;
        var members = command.params[command.params.length - 1].split(' ');
        var cache = client.cache('names.' + command.params[2]);

        if (!cache.members) {
            cache.members = [];
        }
        
        _.each(members, function (member) {
            var i = 0,
                j = 0,
                modes = [];

            // Make sure we have some prefixes already
            if (that.irc_connection.ircd_options.PREFIX) {
                for (j = 0; j < that.irc_connection.ircd_options.PREFIX.length; j++) {
                    if (member.charAt(i) === that.irc_connection.ircd_options.PREFIX[j].symbol) {
                        modes.push(that.irc_connection.ircd_options.PREFIX[j].mode);
                        i++;
                    }
                }
            }

            cache.members.push({nick: member, modes: modes});
        });

        next();
    },


    '366': function RPL_ENDOFNAMES(client, command, next) {
        var cache = client.cache('names.' + command.params[1]);
        client.emit('userlist', {
            channel: command.params[1],
            users: cache.members
        });
        cache.destroy();

        next();
    },


    '367': function RPL_BANLIST(client, command, next) {
        var cache = client.cache('banlist.' + command.params[1]);
        if (!cache.bans) {
            cache.bans = [];
        }

        cache.bans.push({
            channel: command.params[1],
            banned: command.params[2],
            banned_by: command.params[3],
            banned_at: command.params[4]
        });

        next();
    },


    '368': function RPL_ENDOFBANLIST(client, command, next) {
        var cache = client.cache('banlist.' + command.params[1]);
        client.emit('banlist', {
            channel: command.params[1],
            bans: cache.bans
        });

        cache.destroy();

        next();
    },


    '332': function RPL_TOPIC(client, command, next) {
        client.emit('topic', {
            channel: command.params[1],
            topic: command.params[command.params.length - 1]
        });

        next();
    },


    '331': function RPL_NOTOPIC(client, command, next) {
        client.emit('topic', {
            channel: command.params[1],
            topic: ''
        });

        next();
    },


    '333': function RPL_TOPICWHOTIME(client, command, next) {
        client.emit('topicsetby', {
            nick: command.params[2],
            channel: command.params[1],
            when: command.params[3]
        });

        next();
    },


    JOIN: function JOIN(client, command, next) {
        var channel, time;
        if (typeof command.params[0] === 'string' && command.params[0] !== '') {
            channel = command.params[0];
        }

        // Check if we have a server-time
        time = command.getServerTime();

        var data = {
            nick: command.nick,
            ident: command.ident,
            hostname: command.hostname,
            gecos: command.params[command.params - 1],
            channel: channel,
            time: time
        };

        if (client.cap.enabled.indexOf('extended-join') > -1) {
            data.account = command.params[1] === '*' ? false : command.params[1];
        }
        
        client.emit('join', data);

        next();
    },


    PART: function PART(client, command, next) {
        var time, channel, message;

        // Check if we have a server-time
        time = command.getServerTime();

        channel = command.params[0];
        if (command.params.length > 1) {
            message = command.params[command.params.length - 1];
        }

        client.emit('part', {
            nick: command.nick,
            ident: command.ident,
            hostname: command.hostname,
            channel: channel,
            message: message,
            time: time
        });

        next();
    },


    KICK: function KICK(client, command, next) {
        var time;

        // Check if we have a server-time
        time = command.getServerTime();

        client.emit('kick', {
            kicked: command.params[1],
            nick: command.nick,
            ident: command.ident,
            hostname: command.hostname,
            channel: command.params[0],
            message: command.params[command.params.length - 1],
            time: time
        });

        next();
    },


    QUIT: function QUIT(client, command, next) {
        var time;

        // Check if we have a server-time
        time = command.getServerTime();

        client.emit('quit', {
            nick: command.nick,
            ident: command.ident,
            hostname: command.hostname,
            message: command.params[command.params.length - 1],
            time: time
        });

        next();
    },


    TOPIC: function QUIT(client, command, next) {
        var time;

        // If we don't have an associated channel, no need to continue
        if (!command.params[0]) {
            return;
        }

        // Check if we have a server-time
        time = command.getServerTime();

        var channel = command.params[0],
            topic = command.params[command.params.length - 1] || '';

        client.emit('topic', {
            nick: command.nick,
            channel: channel,
            topic: topic,
            time: time
        });

        next();
    },


    '341': function RPL_INVITING(client, command, next) {
        client.emit('invited', {
            nick: command.params[0],
            channel: command.params[1]
        });

        next();
    },
};

module.exports = handlers;
