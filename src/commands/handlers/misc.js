var _ = require('lodash');

var handlers = {
    RPL_LISTSTART: function() {
        var cache = this.cache('chanlist');
        cache.channels = [];
        this.emit('channel list start');
    },

    RPL_LISTEND: function() {
        var cache = this.cache('chanlist');
        cache.destroy();
        this.emit('channel list end');
    },

    RPL_LIST: function(command) {
        var cache = this.cache('chanlist');
        cache.channels.push({
            channel: command.params[1],
            num_users: parseInt(command.params[2], 10),
            topic: command.params[3] || ''
        });

        if (cache.channels >= 50) {
            this.emit('channel list', cache.channels);
            cache.channels = [];
        }
    },



    RPL_MOTD: function(command) {
        var cache = this.cache('motd');
        cache.motd += command.params[command.params.length - 1] + '\n';
    },

    RPL_MOTDSTART: function() {
        var cache = this.cache('motd');
        cache.motd = '';
    },

    RPL_ENDOFMOTD: function() {
        var cache = this.cache('motd');
        this.emit('motd', {
            motd: cache.motd
        });
        cache.destroy();
    },

    ERR_NOMOTD: function(command) {
        var params = _.clone(command.params);
        params.shift();
        this.emit('motd', {
            error: command.params[command.params.length - 1]
        });
    },



    RPL_WHOREPLY: function() {
        // For the time being, NOOP this command so they don't get passed
        // down to the client. Waste of bandwidth since we do not use it yet
        // TODO: Impliment RPL_WHOREPLY
    },

    RPL_ENDOFWHO: function() {
        // For the time being, NOOP this command so they don't get passed
        // down to the client. Waste of bandwidth since we do not use it yet
        // TODO: Impliment RPL_ENDOFWHO
    },


    PING: function(command) {
        this.connection.write('PONG ' + command.params[command.params.length - 1]);
    },


    MODE: function(command) {
        // Check if we have a server-time
        var time = command.getServerTime();

        // Get a JSON representation of the modes
        var modes = this.parseModeList(command.params[1], command.params.slice(2));

        this.emit('mode', {
            target: command.params[0],
            nick: command.nick || command.prefix || '',
            modes: modes,
            time: time
        });
    },


    ERROR: function(command) {
        this.emit('error', {
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_PASSWDMISMATCH: function() {
        this.emit('server password_mismatch', {});
    },

    ERR_LINKCHANNEL: function(command) {
        this.emit('server channel_redirect', {
            from: command.params[1],
            to: command.params[2]
        });
    },

    ERR_NOSUCHNICK: function(command) {
        this.emit('server no_such_nick', {
            nick: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_CANNOTSENDTOCHAN: function(command) {
        this.emit('server cannot_send_to_channel', {
            channel: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_TOOMANYCHANNELS: function(command) {
        this.emit('server too_many_channels', {
            channel: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_USERNOTINCHANNEL: function(command) {
        this.emit('server user_not_in_channel', {
            nick: command.params[0],
            channel: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_NOTONCHANNEL: function(command) {
        this.emit('server not_on_channel', {
            channel: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_USERONCHANNEL: function(command) {
        this.emit('server user_on_channel', {
            nick: command.params[1],
            channel: command.params[2]
        });
    },

    ERR_CHANNELISFULL: function(command) {
        this.emit('server channel_is_full', {
            channel: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_INVITEONLYCHAN: function(command) {
        this.emit('server invite_only_channel', {
            channel: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_BANNEDFROMCHAN: function(command) {
        this.emit('server banned_from_channel', {
            channel: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_BADCHANNELKEY: function(command) {
        this.emit('server bad_channel_key', {
            channel: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_CHANOPRIVSNEEDED: function(command) {
        this.emit('server chanop_privs_needed', {
            channel: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    RPL_LINKS: function(command) {
        var cache = this.cache('links');
        cache.links = cache.links || [];
        cache.links.push({
            address: command.params[1],
            access_via: command.params[2],
            hops: parseInt(command.params[3].split(' ')[0]),
            description: command.params[3].split(' ').splice(1).join(' ')
        });
    },

    RPL_ENDOFLINKS: function(command) {
        var cache = this.cache('links');
        this.emit('server links', {
            links: cache.links
        });

        cache.destroy();
    }
};

module.exports = function AddCommandHandlers(command_controller) {
    _.each(handlers, function(handler, handler_command) {
        command_controller.addHandler(handler_command, handler);
    });
};
