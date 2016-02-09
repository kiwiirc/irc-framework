var _ = require('lodash');

var handlers = {
    NICK: function(command) {
        var time;

        // Check if we have a server-time
        time = command.getServerTime();

        this.emit('nick', {
            nick: command.nick,
            ident: command.ident,
            hostname: command.hostname,
            newnick: command.params[0],
            time: time
        });
    },


    AWAY: function(command) {
        var time;

        // Check if we have a server-time
        time = command.getServerTime();

        this.emit('away', {
            nick: command.nick,
            msg: command.params[command.params.length - 1],
            time: time
        });
    },


    ERR_NICKNAMEINUSE: function(command) {
        this.emit('nick in use', {
            nick: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },

    ERR_ERRONEUSNICKNAME: function(command) {
        this.emit('nick invalid', {
            nick: command.params[1],
            reason: command.params[command.params.length - 1]
        });
    },


    RPL_ENDOFWHOIS: function(command) {
        var nick = command.params[1];
        var cache = this.cache('whois.' + nick);

        if (!cache.nick) {
            cache.nick = nick;
            cache.error = 'not_found';
        }

        this.emit('whois', cache);
        cache.destroy();
    },

    RPL_AWAY: function(command) {
        var nick = command.params[1];
        var cache = this.cache('whois.' + nick);
        cache.away = command.params[command.params.length - 1] || 'is away';
    },

    RPL_WHOISUSER: function(command) {
        var nick = command.params[1];
        var cache = this.cache('whois.' + nick);
        cache.nick = command.params[1];
        cache.user = command.params[2];
        cache.host = command.params[3];
    },

    RPL_WHOISHELPOP: function(command) {
        var nick = command.params[1];
        var cache = this.cache('whois.' + nick);
        cache.helpop = command.params[command.params.length - 1];
    },

    RPL_WHOISBOT: function(command) {
        var nick = command.params[1];
        var cache = this.cache('whois.' + nick);
        cache.bot = command.params[command.params.length - 1];
    },

    RPL_WHOISSERVER: function(command) {
        var nick = command.params[1];
        var cache = this.cache('whois.' + nick);
        cache.server = command.params[2];
        cache.server_info = command.params[command.params.length - 1];
    },

    RPL_WHOISOPERATOR: function(command) {
        var nick = command.params[1];
        var cache = this.cache('whois.' + nick);
        cache.operator = command.params[command.params.length - 1];
    },

    RPL_WHOISCHANNELS:       function(command) {
        var nick = command.params[1];
        var cache = this.cache('whois.' + nick);
        cache.channels = command.params[command.params.length - 1];
    },

    RPL_WHOISMODES: function(command) {
        var nick = command.params[1];
        var cache = this.cache('whois.' + nick);
        cache.modes = command.params[command.params.length - 1];
    },

    RPL_WHOISIDLE: function(command) {
        var nick = command.params[1];
        var cache = this.cache('whois.' + nick);
        cache.idle = command.params[2];
        if (command.params[3]) {
            cache.logon = command.params[3];
        }
    },

    RPL_WHOISREGNICK: function(command) {
        var nick = command.params[1];
        var cache = this.cache('whois.' + nick);
        cache.registered_nick = command.params[command.params.length - 1];
    },

    RPL_WHOISHOST: function(command) {
        var nick = command.params[1];
        var cache = this.cache('whois.' + nick);
        cache.host = command.params[command.params.length - 1];
    },

    RPL_WHOISSECURE: function(command) {
        var nick = command.params[1];
        var cache = this.cache('whois.' + nick);
        cache.secure = true;
    },

    RPL_WHOISACCOUNT: function(command) {
        var nick = command.params[1];
        var cache = this.cache('whois.' + nick);
        cache.account = command.params[2];
    },

    RPL_WHOISSPECIAL: function(command) {
        var nick = command.params[1];
        var cache = this.cache('whois.' + nick);
        cache.special = command.params[command.params.length - 1];
    },

    RPL_WHOISACTUALLY: function(command) {
        var nick = command.params[1];
        var cache = this.cache('whois.' + nick);
        cache.actuallhost = command.params[command.params.length - 1];
    },

    RPL_WHOWASUSER: function(command) {
        this.emit('whowas', {
            nick: command.params[1],
            ident: command.params[2],
            host: command.params[3],
            real_name: command.params[command.params.length - 1]
        });
    },

    RPL_ENDOFWHOWAS: function() {
        // noop
    },

    ERR_WASNOSUCHNICK: function(command) {
        this.emit('whowas', {
            nick: command.params[1],
            error: 'no_such_nick'
        });
    },

    RPL_UMODEIS: function(command) {
        // this.connection.umodes = the modes
        console.log('IMPLEMENT ME: umodes setting on connection');
    }
};

module.exports = function AddCommandHandlers(command_controller) {
    _.each(handlers, function(handler, handler_command) {
        command_controller.addHandler(handler_command, handler);
    });
};
