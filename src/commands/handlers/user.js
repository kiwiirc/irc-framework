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
            new_nick: command.params[0],
            time: time
        });
    },

    ACCOUNT: function(command) {
        var time;

        // Check if we have a server-time
        time = command.getServerTime();

        var account = command.params[0] === '*' ?
            false :
            command.params[0];

        this.emit('account', {
            nick: command.nick,
            ident: command.ident,
            hostname: command.hostname,
            account: account,
            time: time
        });        
    },

    // If the chghost CAP is enabled and 'enable_chghost' option is true
    CHGHOST: function(command) {
        var time;

        // Check if we have a server-time
        time = command.getServerTime();

        this.emit('user updated', {
            nick: command.nick,
            ident: command.ident,
            hostname: command.hostname,
            new_ident: command.params[0],
            new_host: command.params[0],
            time: time
        });
    },

    AWAY: function(command) {
        var time;

        // Check if we have a server-time
        time = command.getServerTime();

        this.emit('away', {
            nick: command.nick,
            message: command.params[command.params.length - 1],
            time: time
        });
    },

    RPL_ISON: function(command) {
        this.emit('users online', {
            nicks: (command.params[command.params.length - 1] || '').split(' '),
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
        var cache_key = command.params[1].toLowerCase();
        var cache = this.cache('whois.' + cache_key);

        if (!cache.nick) {
            cache.nick = command.params[1];
            cache.error = 'not_found';
        }

        this.emit('whois', cache);
        cache.destroy();
    },

    RPL_AWAY: function(command) {
        var cache_key = command.params[1].toLowerCase();
        var cache = this.cache('whois.' + cache_key);
        cache.away = command.params[command.params.length - 1] || 'is away';
    },

    RPL_WHOISUSER: function(command) {
        var cache_key = command.params[1].toLowerCase();
        var cache = this.cache('whois.' + cache_key);
        cache.nick = command.params[1];
        cache.user = command.params[2];
        cache.host = command.params[3];
        cache.real_name = command.params[5];
    },

    RPL_WHOISHELPOP: function(command) {
        var cache_key = command.params[1].toLowerCase();
        var cache = this.cache('whois.' + cache_key);
        cache.helpop = command.params[command.params.length - 1];
    },

    RPL_WHOISBOT: function(command) {
        var cache_key = command.params[1].toLowerCase();
        var cache = this.cache('whois.' + cache_key);
        cache.bot = command.params[command.params.length - 1];
    },

    RPL_WHOISSERVER: function(command) {
        var cache_key = command.params[1].toLowerCase();
        var cache = this.cache('whois.' + cache_key);
        cache.server = command.params[2];
        cache.server_info = command.params[command.params.length - 1];
    },

    RPL_WHOISOPERATOR: function(command) {
        var cache_key = command.params[1].toLowerCase();
        var cache = this.cache('whois.' + cache_key);
        cache.operator = command.params[command.params.length - 1];
    },

    RPL_WHOISCHANNELS:       function(command) {
        var cache_key = command.params[1].toLowerCase();
        var cache = this.cache('whois.' + cache_key);
        cache.channels = command.params[command.params.length - 1];
    },

    RPL_WHOISMODES: function(command) {
        var cache_key = command.params[1].toLowerCase();
        var cache = this.cache('whois.' + cache_key);
        cache.modes = command.params[command.params.length - 1];
    },

    RPL_WHOISIDLE: function(command) {
        var cache_key = command.params[1].toLowerCase();
        var cache = this.cache('whois.' + cache_key);
        cache.idle = command.params[2];
        if (command.params[3]) {
            cache.logon = command.params[3];
        }
    },

    RPL_WHOISREGNICK: function(command) {
        var cache_key = command.params[1].toLowerCase();
        var cache = this.cache('whois.' + cache_key);
        cache.registered_nick = command.params[command.params.length - 1];
    },

    RPL_WHOISHOST: function(command) {
        // Ignore this command as we get the host from RPL_WHOISUSER and it contains junk
        // anyway
    },

    RPL_WHOISSECURE: function(command) {
        var cache_key = command.params[1].toLowerCase();
        var cache = this.cache('whois.' + cache_key);
        cache.secure = true;
    },

    RPL_WHOISACCOUNT: function(command) {
        var cache_key = command.params[1].toLowerCase();
        var cache = this.cache('whois.' + cache_key);
        cache.account = command.params[2];
    },

    RPL_WHOISSPECIAL: function(command) {
        var cache_key = command.params[1].toLowerCase();
        var cache = this.cache('whois.' + cache_key);
        cache.special = command.params[command.params.length - 1];
    },

    RPL_WHOISACTUALLY: function(command) {
        var cache_key = command.params[1].toLowerCase();
        var cache = this.cache('whois.' + cache_key);
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
        // TODO: this
    },

    RPL_HOSTCLOACKING: function(command) {
        this.emit('displayed host', {
            nick: command.params[0],
            host: command.params[1]
        });
    }
};

module.exports = function AddCommandHandlers(command_controller) {
    _.each(handlers, function(handler, handler_command) {
        command_controller.addHandler(handler_command, handler);
    });
};
