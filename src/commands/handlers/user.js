'use strict';

var _ = {
    each: require('lodash/each'),
};

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
            new_hostname: command.params[1],
            time: time
        });
    },

    AWAY: function(command) {
        var time;

        // Check if we have a server-time
        time = command.getServerTime();
        const message = command.params[command.params.length - 1] || '';
        if (message === '') { // back
            this.emit('back', {
                self: false,
                nick: command.nick,
                message: '',
                time: time
            });
        } else {
            this.emit('away', {
                self: false,
                nick: command.nick,
                message: message,
                time: time
            });
        }
    },

    RPL_NOWAWAY: function(command) {
        var time;

        // Check if we have a server-time
        time = command.getServerTime();

        this.emit('away', {
            self: true,
            nick: command.nick,
            message: command.params[command.params.length - 1],
            time: time
        });
    },

    RPL_UNAWAY: function(command) {
        var time;

        // Check if we have a server-time
        time = command.getServerTime();

        this.emit('back', {
            self: true,
            nick: command.nick,
            message: command.params[command.params.length - 1] || '', // example: "<nick> is now back."
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

    ERR_ERRONEOUSNICKNAME: function(command) {
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
        var cache_key = 'whois.' + command.params[1].toLowerCase();
        var message = command.params[command.params.length - 1] || 'is away';

        // RPL_AWAY may come as a response to PRIVMSG, and not be a part of whois
        // If so, emit away event separately for it
        if (!this.hasCache(cache_key)) {
            // Check if we have a server-time
            var time = command.getServerTime();

            this.emit('away', {
                self: false,
                nick: command.params[1],
                message: message,
                time: time
            });

            return;
        }

        var cache = this.cache(cache_key);
        cache.away = message;
    },

    RPL_WHOISUSER: function(command) {
        var cache_key = command.params[1].toLowerCase();
        var cache = this.cache('whois.' + cache_key);
        cache.nick = command.params[1];
        cache.ident = command.params[2];
        cache.hostname = command.params[3];
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

    RPL_WHOISCHANNELS: function(command) {
        var cache_key = command.params[1].toLowerCase();
        var cache = this.cache('whois.' + cache_key);
        if (cache.channels) {
            cache.channels += ' ' + command.params[command.params.length - 1];
        } else {
            cache.channels = command.params[command.params.length - 1];
        }
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
        var cache_key = command.params[1].toLowerCase();
        var cache = this.cache('whois.' + cache_key);

        var last_param = command.params[command.params.length - 1];
        // <source> 378 <target> <nick> :is connecting from <user>@<host> <ip>
        var match = last_param.match(/.*@([^ ]+) ([^ ]+).*$/);  // https://regex101.com/r/AQz7RE/2

        if (!match) {
            return;
        }

        cache.actual_ip = match[2];
        cache.actual_hostname = match[1];
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

    RPL_WHOISCOUNTRY: function(command) {
        var cache_key = command.params[1].toLowerCase();
        var cache = this.cache('whois.' + cache_key);
        cache.country = command.params[command.params.length - 1];
    },

    RPL_WHOISACTUALLY: function(command) {
        var cache_key = command.params[1].toLowerCase();
        var cache = this.cache('whois.' + cache_key);

        // <source> 338 <target> <nick> <user>@<host> <ip> :Actual user@host, Actual IP
        var user_host = command.params[command.params.length - 3] || '';
        var host = user_host.substring(user_host.indexOf("@") + 1);
        var ip = command.params[command.params.length - 2];

        // UnrealIRCd uses this numeric for something else resulting in ip+host
        // to be empty, so ignore this is that's the case
        if (ip && host) {
            cache.actual_ip = ip;
            cache.actual_hostname = host;
        }
    },

    RPL_WHOWASUSER: function(command) {
        var cache_key = command.params[1].toLowerCase();
        var cache = this.cache('whois.' + cache_key);

        cache.nick = command.params[1];
        cache.ident = command.params[2];
        cache.hostname = command.params[3];
        cache.real_name = command.params[command.params.length - 1];
    },

    RPL_ENDOFWHOWAS: function(command) {
        // Because the WHOIS and WHOWAS numerics clash with eachother,
        // a cache key will have more than what is just in RPL_WHOWASUSER.
        // This is why we borrow from the whois.* cache key ID.
        //
        // This exposes some fields (that may or may not be set).
        // Valid keys that should always be set: nick, ident, hostname, real_name
        // Valid optional keys: actual_ip, actual_hostname, account, server,
        //   server_info
        // More optional fields MAY exist, depending on the type of ircd.
        var cache_key = command.params[1].toLowerCase();
        var cache = this.cache('whois.' + cache_key);

        // Should, in theory, never happen.
        if (!cache.nick) {
            cache.nick = command.params[1];
            cache.error = 'no_such_nick';
        }

        this.emit('whowas', cache);
        cache.destroy();
    },

    ERR_WASNOSUCHNICK: function(command) {
        var cache_key = command.params[1].toLowerCase();
        var cache = this.cache('whois.' + cache_key);

        cache.nick = command.params[1];
        cache.error = 'no_such_nick';
    },

    RPL_UMODEIS: function(command) {
        // this.connection.umodes = the modes
        // TODO: this
    },

    RPL_HOSTCLOAKING: function(command) {
        this.emit('displayed host', {
            nick: command.params[0],
            hostname: command.params[1]
        });
    }
};

module.exports = function AddCommandHandlers(command_controller) {
    _.each(handlers, function(handler, handler_command) {
        command_controller.addHandler(handler_command, handler);
    });
};
