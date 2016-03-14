var _ = require('lodash');

var handlers = {
    RPL_LISTSTART: function() {
        var cache = this.cache('chanlist');
        cache.channels = [];
        this.emit('channel list start');
    },

    RPL_LISTEND: function() {
        var cache = this.cache('chanlist');
        if (cache.channels.length) {
            this.emit('channel list', cache.channels);
            cache.channels = [];
        }

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

        if (cache.channels.length >= 50) {
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
