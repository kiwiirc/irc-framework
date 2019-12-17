'use strict';

var _ = {
    each: require('lodash/each'),
};
var Helpers = require('../../helpers');

var handlers = {
    RPL_CHANNELMODEIS: function(command, handler) {
        var channel = command.params[1];
        var raw_modes = command.params[2];
        var raw_params = command.params.slice(3);
        var modes = handler.parseModeList(raw_modes, raw_params);

        handler.emit('channel info', {
            channel: channel,
            modes: modes,
            raw_modes: raw_modes,
            raw_params: raw_params,
            tags: command.tags
        });
    },


    RPL_CREATIONTIME: function(command, handler) {
        var channel = command.params[1];

        handler.emit('channel info', {
            channel: channel,
            created_at: parseInt(command.params[2], 10),
            tags: command.tags
        });
    },


    RPL_CHANNEL_URL: function(command, handler) {
        var channel = command.params[1];

        handler.emit('channel info', {
            channel: channel,
            url: command.params[command.params.length - 1],
            tags: command.tags
        });
    },


    RPL_NAMEREPLY: function(command, handler) {
        var members = command.params[command.params.length - 1].split(' ');
        var cache = handler.cache('names.' + command.params[2]);

        if (!cache.members) {
            cache.members = [];
        }

        _.each(members, function(member) {
            if (!member) {
                return;
            }
            var j = 0;
            var modes = [];
            var user = null;

            // If we have prefixes, strip them from the nick and keep them separate
            if (handler.network.options.PREFIX) {
                for (j = 0; j < handler.network.options.PREFIX.length; j++) {
                    if (member[0] === handler.network.options.PREFIX[j].symbol) {
                        modes.push(handler.network.options.PREFIX[j].mode);
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
                modes: modes,
                tags: command.tags
            });
        });
    },


    RPL_ENDOFNAMES: function(command, handler) {
        var cache = handler.cache('names.' + command.params[1]);
        handler.emit('userlist', {
            channel: command.params[1],
            users: cache.members || []
        });
        cache.destroy();
    },


    RPL_INVITELIST: function(command, handler) {
        var cache = handler.cache('inviteList.' + command.params[1]);
        if (!cache.invites) {
            cache.invites = [];
        }

        cache.invites.push({
            channel: command.params[1],
            invited: command.params[2],
            invited_by: command.params[3],
            invited_at: command.params[4],
            tags: command.tags
        });
    },


    RPL_ENDOFINVITELIST: function(command, handler) {
        var cache = handler.cache('inviteList.' + command.params[1]);
        handler.emit('inviteList', {
            channel: command.params[1],
            invites: cache.invites || []
        });

        cache.destroy();
    },


    RPL_BANLIST: function(command, handler) {
        var cache = handler.cache('banlist.' + command.params[1]);
        if (!cache.bans) {
            cache.bans = [];
        }

        cache.bans.push({
            channel: command.params[1],
            banned: command.params[2],
            banned_by: command.params[3],
            banned_at: command.params[4],
            tags: command.tags
        });
    },


    RPL_ENDOFBANLIST: function(command, handler) {
        var cache = handler.cache('banlist.' + command.params[1]);
        handler.emit('banlist', {
            channel: command.params[1],
            bans: cache.bans || []
        });

        cache.destroy();
    },


    RPL_TOPIC: function(command, handler) {
        handler.emit('topic', {
            channel: command.params[1],
            topic: command.params[command.params.length - 1],
            tags: command.tags
        });
    },


    RPL_NOTOPIC: function(command, handler) {
        handler.emit('topic', {
            channel: command.params[1],
            topic: '',
            tags: command.tags
        });
    },


    RPL_TOPICWHOTIME: function(command, handler) {
        var parsed = Helpers.parseMask(command.params[2]);
        handler.emit('topicsetby', {
            nick: parsed.nick,
            ident: parsed.user,
            hostname: parsed.host,
            channel: command.params[1],
            when: command.params[3],
            tags: command.tags
        });
    },


    JOIN: function(command, handler) {
        var channel;
        var gecos_idx = 1;
        var data = {};

        if (typeof command.params[0] === 'string' && command.params[0] !== '') {
            channel = command.params[0];
        }

        if (handler.network.cap.isEnabled('extended-join')) {
            data.account = command.params[1] === '*' ? false : command.params[1];
            gecos_idx = 2;
        }

        data.nick = command.nick;
        data.ident = command.ident;
        data.hostname = command.hostname;
        data.gecos = command.params[gecos_idx] || '';
        data.channel = channel;
        data.time = command.getServerTime();
        data.tags = command.tags;
        handler.emit('join', data);
    },


    PART: function(command, handler) {
        var time = command.getServerTime();

        handler.emit('part', {
            nick: command.nick,
            ident: command.ident,
            hostname: command.hostname,
            channel: command.params[0],
            message: command.params[command.params.length - 1] || '',
            time: time,
            tags: command.tags
        });
    },


    KICK: function(command, handler) {
        var time = command.getServerTime();

        handler.emit('kick', {
            kicked: command.params[1],
            nick: command.nick,
            ident: command.ident,
            hostname: command.hostname,
            channel: command.params[0],
            message: command.params[command.params.length - 1] || '',
            time: time,
            tags: command.tags
        });
    },


    QUIT: function(command, handler) {
        var time = command.getServerTime();

        handler.emit('quit', {
            nick: command.nick,
            ident: command.ident,
            hostname: command.hostname,
            message: command.params[command.params.length - 1] || '',
            time: time,
            tags: command.tags
        });
    },


    TOPIC: function(command, handler) {
        // If we don't have an associated channel, no need to continue
        if (!command.params[0]) {
            return;
        }

        // Check if we have a server-time
        var time = command.getServerTime();

        var channel = command.params[0];
        var topic = command.params[command.params.length - 1] || '';

        handler.emit('topic', {
            nick: command.nick,
            channel: channel,
            topic: topic,
            time: time,
            tags: command.tags
        });
    },


    INVITE: function(command, handler) {
        var time = command.getServerTime();

        handler.emit('invite', {
            nick: command.nick,
            ident: command.ident,
            hostname: command.hostname,
            invited: command.params[0],
            channel: command.params[1],
            time: time,
            tags: command.tags
        });
    },


    RPL_INVITING: function(command, handler) {
        handler.emit('invited', {
            nick: command.params[0],
            channel: command.params[1],
            tags: command.tags
        });
    }
};

module.exports = function AddCommandHandlers(command_controller) {
    _.each(handlers, function(handler, handler_command) {
        command_controller.addHandler(handler_command, handler);
    });
};
