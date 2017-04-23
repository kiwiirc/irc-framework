var _ = require('lodash');
var Helpers = require('../../helpers');

var handlers = {
    RPL_CHANNELMODEIS: function(command) {
        var channel = command.params[1];
        var modes = this.parseModeList.call(this, command.params[2], command.params.slice(3));

        this.emit('channel info', {
            channel: channel,
            modes: modes
        });
    },


    RPL_CREATIONTIME: function(command) {
        var channel = command.params[1];

        this.emit('channel info', {
            channel: channel,
            created_at: parseInt(command.params[2], 10)
        });
    },


    RPL_CHANNEL_URL: function(command) {
        var channel = command.params[1];

        this.emit('channel info', {
            channel: channel,
            url: command.params[command.params.length - 1]
        });
    },


    RPL_NAMEREPLY: function(command) {
        var that = this;
        var members = command.params[command.params.length - 1].split(' ');
        var cache = this.cache('names.' + command.params[2]);

        if (!cache.members) {
            cache.members = [];
        }

        _.each(members, function(member) {
            var j = 0;
            var modes = [];
            var user = null;

            // If we have prefixes, strip them from the nick and keep them separate
            if (that.network.options.PREFIX) {
                for (j = 0; j < that.network.options.PREFIX.length; j++) {
                    if (member[0] === that.network.options.PREFIX[j].symbol) {
                        modes.push(that.network.options.PREFIX[j].mode);
                        member = member.substring(1);
                    }
                }
            }

            // We may have a full user mask if the userhost-in-names CAP is enabled
            user = Helpers.parseMask(member);

            cache.members.push({
                nick: user.nick,
                ident: user.user,
                hostname: user.host,
                modes: modes
            });
        });
    },


    RPL_ENDOFNAMES: function(command) {
        var cache = this.cache('names.' + command.params[1]);
        this.emit('userlist', {
            channel: command.params[1],
            users: cache.members || []
        });
        cache.destroy();
    },


    RPL_BANLIST: function(command) {
        var cache = this.cache('banlist.' + command.params[1]);
        if (!cache.bans) {
            cache.bans = [];
        }

        cache.bans.push({
            channel: command.params[1],
            banned: command.params[2],
            banned_by: command.params[3],
            banned_at: command.params[4]
        });
    },


    RPL_ENDOFBANLIST: function(command) {
        var cache = this.cache('banlist.' + command.params[1]);
        this.emit('banlist', {
            channel: command.params[1],
            bans: cache.bans || []
        });

        cache.destroy();
    },


    RPL_TOPIC: function(command) {
        this.emit('topic', {
            channel: command.params[1],
            topic: command.params[command.params.length - 1]
        });
    },


    RPL_NOTOPIC: function(command) {
        this.emit('topic', {
            channel: command.params[1],
            topic: ''
        });
    },


    RPL_TOPICWHOTIME: function(command) {
        var parsed = Helpers.parseMask(command.params[2]);
        this.emit('topicsetby', {
            nick: parsed.nick,
            user: parsed.user,
            host: parsed.host,
            channel: command.params[1],
            when: command.params[3]
        });
    },


    JOIN: function(command) {
        var channel;
        var gecos_idx = 1;
        var data = {};

        if (typeof command.params[0] === 'string' && command.params[0] !== '') {
            channel = command.params[0];
        }

        if (this.network.cap.isEnabled('extended-join')) {
            data.account = command.params[1] === '*' ? false : command.params[1];
            gecos_idx = 2;
        }

        data.nick = command.nick;
        data.ident = command.ident;
        data.hostname = command.hostname;
        data.gecos = command.params[gecos_idx] || '';
        data.channel = channel;
        data.time = command.getServerTime();

        this.emit('join', data);
    },


    PART: function(command) {
        var time = command.getServerTime();

        this.emit('part', {
            nick: command.nick,
            ident: command.ident,
            hostname: command.hostname,
            channel: command.params[0],
            message: command.params[command.params.length - 1] || '',
            time: time
        });
    },


    KICK: function(command) {
        var time = command.getServerTime();

        this.emit('kick', {
            kicked: command.params[1],
            nick: command.nick,
            ident: command.ident,
            hostname: command.hostname,
            channel: command.params[0],
            message: command.params[command.params.length - 1] || '',
            time: time
        });
    },


    QUIT: function(command) {
        var time = command.getServerTime();

        this.emit('quit', {
            nick: command.nick,
            ident: command.ident,
            hostname: command.hostname,
            message: command.params[command.params.length - 1] || '',
            time: time
        });
    },


    TOPIC: function(command) {
        // If we don't have an associated channel, no need to continue
        if (!command.params[0]) {
            return;
        }

        // Check if we have a server-time
        var time = command.getServerTime();

        var channel = command.params[0];
        var topic = command.params[command.params.length - 1] || '';

        this.emit('topic', {
            nick: command.nick,
            channel: channel,
            topic: topic,
            time: time
        });
    },


    INVITE: function(command) {
        var time = command.getServerTime();

        this.emit('invite', {
            nick: command.nick,
            ident: command.ident,
            hostname: command.hostname,
            invited: command.params[0],
            channel: command.params[1],
            time: time
        });
    },


    RPL_INVITING: function(command) {
        this.emit('invited', {
            nick: command.params[0],
            channel: command.params[1]
        });
    }
};

module.exports = function AddCommandHandlers(command_controller) {
    _.each(handlers, function(handler, handler_command) {
        command_controller.addHandler(handler_command, handler);
    });
};
