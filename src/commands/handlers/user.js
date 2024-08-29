'use strict';

const _ = {
    each: require('lodash/each'),
    map: require('lodash/map'),
};
const Helpers = require('../../helpers');

const handlers = {
    NICK: function(command, handler) {
        // Check if we have a server-time
        const time = command.getServerTime();

        handler.emit('nick', {
            nick: command.nick,
            ident: command.ident,
            hostname: command.hostname,
            new_nick: command.params[0],
            time: time,
            tags: command.tags,
            batch: command.batch
        });
    },

    ACCOUNT: function(command, handler) {
        // Check if we have a server-time
        const time = command.getServerTime();

        const account = command.params[0] === '*' ?
            false :
            command.params[0];

        handler.emit('account', {
            nick: command.nick,
            ident: command.ident,
            hostname: command.hostname,
            account: account,
            time: time,
            tags: command.tags
        });
    },

    // If the chghost CAP is enabled and 'enable_chghost' option is true
    CHGHOST: function(command, handler) {
        // Check if we have a server-time
        const time = command.getServerTime();

        handler.emit('user updated', {
            nick: command.nick,
            ident: command.ident,
            hostname: command.hostname,
            new_ident: command.params[0],
            new_hostname: command.params[1],
            time: time,
            tags: command.tags,
            batch: command.batch
        });
    },

    SETNAME: function(command, handler) {
        // Check if we have a server-time
        const time = command.getServerTime();

        handler.emit('user updated', {
            nick: command.nick,
            ident: command.ident,
            hostname: command.hostname,
            new_gecos: command.params[0],
            time: time,
            tags: command.tags,
            batch: command.batch
        });
    },

    AWAY: function(command, handler) {
        // Check if we have a server-time
        const time = command.getServerTime();
        const message = command.params[command.params.length - 1] || '';
        if (message === '') { // back
            handler.emit('back', {
                self: false,
                nick: command.nick,
                message: '',
                time: time,
                tags: command.tags
            });
        } else {
            handler.emit('away', {
                self: false,
                nick: command.nick,
                message: message,
                time: time,
                tags: command.tags
            });
        }
    },

    RPL_NOWAWAY: function(command, handler) {
        // Check if we have a server-time
        const time = command.getServerTime();

        handler.emit('away', {
            self: true,
            nick: command.params[0],
            message: command.params[1] || '',
            time: time,
            tags: command.tags
        });
    },

    RPL_UNAWAY: function(command, handler) {
        // Check if we have a server-time
        const time = command.getServerTime();

        handler.emit('back', {
            self: true,
            nick: command.params[0],
            message: command.params[1] || '', // example: "<nick> is now back."
            time: time,
            tags: command.tags
        });
    },

    RPL_ISON: function(command, handler) {
        handler.emit('users online', {
            nicks: (command.params[command.params.length - 1] || '').split(' '),
            tags: command.tags
        });
    },

    ERR_NICKNAMEINUSE: function(command, handler) {
        handler.emit('nick in use', {
            nick: command.params[1],
            reason: command.params[command.params.length - 1],
            tags: command.tags
        });
    },

    ERR_ERRONEOUSNICKNAME: function(command, handler) {
        handler.emit('nick invalid', {
            nick: command.params[1],
            reason: command.params[command.params.length - 1],
            tags: command.tags
        });
    },

    RPL_ENDOFWHOIS: function(command, handler) {
        const cache_key = command.params[1].toLowerCase();
        const cache = handler.cache('whois.' + cache_key);

        if (!cache.nick) {
            cache.nick = command.params[1];
            cache.error = 'not_found';
        }

        handler.emit('whois', cache);
        cache.destroy();
    },

    RPL_AWAY: function(command, handler) {
        const cache_key = 'whois.' + command.params[1].toLowerCase();
        const message = command.params[command.params.length - 1] || 'is away';

        // RPL_AWAY may come as a response to PRIVMSG, and not be a part of whois
        // If so, emit away event separately for it
        if (!handler.hasCache(cache_key)) {
            // Check if we have a server-time
            const time = command.getServerTime();

            handler.emit('away', {
                self: false,
                nick: command.params[1],
                message: message,
                time: time,
                tags: command.tags
            });

            return;
        }

        const cache = handler.cache(cache_key);
        cache.away = message;
    },

    RPL_WHOISUSER: function(command, handler) {
        const cache_key = command.params[1].toLowerCase();
        const cache = handler.cache('whois.' + cache_key);
        cache.nick = command.params[1];
        cache.ident = command.params[2];
        cache.hostname = command.params[3];
        cache.real_name = command.params[5];
    },

    RPL_WHOISHELPOP: function(command, handler) {
        const cache_key = command.params[1].toLowerCase();
        const cache = handler.cache('whois.' + cache_key);
        cache.helpop = command.params[command.params.length - 1];
    },

    RPL_WHOISBOT: function(command, handler) {
        const cache_key = command.params[1].toLowerCase();
        const cache = handler.cache('whois.' + cache_key);
        cache.bot = command.params[command.params.length - 1];
    },

    RPL_WHOISSERVER: function(command, handler) {
        const cache_key = command.params[1].toLowerCase();
        const cache = handler.cache('whois.' + cache_key);
        cache.server = command.params[2];
        cache.server_info = command.params[command.params.length - 1];
    },

    RPL_WHOISOPERATOR: function(command, handler) {
        const cache_key = command.params[1].toLowerCase();
        const cache = handler.cache('whois.' + cache_key);
        cache.operator = command.params[command.params.length - 1];
    },

    RPL_WHOISCHANNELS: function(command, handler) {
        const cache_key = command.params[1].toLowerCase();
        const cache = handler.cache('whois.' + cache_key);
        if (cache.channels) {
            cache.channels += ' ' + command.params[command.params.length - 1];
        } else {
            cache.channels = command.params[command.params.length - 1];
        }
    },

    RPL_WHOISMODES: function(command, handler) {
        const cache_key = command.params[1].toLowerCase();
        const cache = handler.cache('whois.' + cache_key);
        cache.modes = command.params[command.params.length - 1];
    },

    RPL_WHOISIDLE: function(command, handler) {
        const cache_key = command.params[1].toLowerCase();
        const cache = handler.cache('whois.' + cache_key);
        cache.idle = command.params[2];
        if (command.params[3]) {
            cache.logon = command.params[3];
        }
    },

    RPL_WHOISREGNICK: function(command, handler) {
        const cache_key = command.params[1].toLowerCase();
        const cache = handler.cache('whois.' + cache_key);
        cache.registered_nick = command.params[command.params.length - 1];
    },

    RPL_WHOISHOST: function(command, handler) {
        const cache_key = command.params[1].toLowerCase();
        const cache = handler.cache('whois.' + cache_key);

        const last_param = command.params[command.params.length - 1];
        // <source> 378 <target> <nick> :is connecting from <user>@<host> <ip>
        const match = last_param.match(/.*@([^ ]+) ([^ ]+).*$/); // https://regex101.com/r/AQz7RE/2

        if (!match) {
            return;
        }

        cache.actual_ip = match[2];
        cache.actual_hostname = match[1];
    },

    RPL_WHOISSECURE: function(command, handler) {
        const cache_key = command.params[1].toLowerCase();
        const cache = handler.cache('whois.' + cache_key);
        cache.secure = true;
    },

    RPL_WHOISCERTFP: function(command, handler) {
        const cache_key = command.params[1].toLowerCase();
        const cache = handler.cache('whois.' + cache_key);
        const certfp = command.params[command.params.length - 1];
        cache.certfp = cache.certfp || certfp;
        cache.certfps = cache.certfps || [];
        cache.certfps.push(certfp);
    },

    RPL_WHOISACCOUNT: function(command, handler) {
        const cache_key = command.params[1].toLowerCase();
        const cache = handler.cache('whois.' + cache_key);
        cache.account = command.params[2];
    },

    RPL_WHOISSPECIAL: function(command, handler) {
        const cache_key = command.params[1].toLowerCase();
        const cache = handler.cache('whois.' + cache_key);
        cache.special = cache.special || [];
        cache.special.push(command.params[command.params.length - 1]);
    },

    RPL_WHOISCOUNTRY: function(command, handler) {
        const cache_key = command.params[1].toLowerCase();
        const cache = handler.cache('whois.' + cache_key);
        cache.country = command.params[command.params.length - 1];
        if (command.params.length === 4) {
            cache.country_code = command.params[2];
        }
    },

    RPL_WHOISASN: function(command, handler) {
        const cache_key = command.params[1].toLowerCase();
        const cache = handler.cache('whois.' + cache_key);
        cache.asn = command.params[command.params.length - 1];
    },

    RPL_WHOISACTUALLY: function(command, handler) {
        const cache_key = command.params[1].toLowerCase();
        const cache = handler.cache('whois.' + cache_key);

        // <source> 338 <target> <nick> [<user>@]<host> <ip> :Actual user@host, Actual IP
        const user_host = command.params[command.params.length - 3] || '';
        const mask_sep = user_host.indexOf('@');
        const user = user_host.substring(0, mask_sep) || undefined;
        const host = user_host.substring(mask_sep + 1);
        const ip = command.params[command.params.length - 2];

        // UnrealIRCd uses this numeric for something else resulting in ip+host
        // to be empty, so ignore this is that's the case
        if (ip && host) {
            cache.actual_ip = ip;
            cache.actual_username = user;
            cache.actual_hostname = host;
        }
    },

    RPL_WHOWASUSER: function(command, handler) {
        const cache_key = command.params[1].toLowerCase();
        let whois_cache = handler.cache('whois.' + cache_key);

        // multiple RPL_WHOWASUSER replies are received prior to the RPL_ENDOFWHOWAS command
        // one for each timestamp the server is aware of, from newest to oldest.
        // They are optionally interleaved with various other numerics such as RPL_WHOISACTUALLY etc.
        // Hence if we already find something we are receiving older data and need to make sure that we
        // store anything already in the cache into its own entry
        const whowas_cache = handler.cache('whowas.' + cache_key);
        if (!whowas_cache.whowas) {
            // this will get populated by the next RPL_WHOWASUSER or RPL_ENDOFWHOWAS
            whowas_cache.whowas = [];
        } else {
            // push the previous event prior to modifying anything
            whowas_cache.whowas.push(whois_cache);
            // ensure we are starting with a clean cache for the next data
            whois_cache.destroy();
            whois_cache = handler.cache('whois.' + cache_key);
        }

        whois_cache.nick = command.params[1];
        whois_cache.ident = command.params[2];
        whois_cache.hostname = command.params[3];
        whois_cache.real_name = command.params[command.params.length - 1];
    },

    RPL_ENDOFWHOWAS: function(command, handler) {
        // Because the WHOIS and WHOWAS numerics clash with eachother,
        // a cache key will have more than what is just in RPL_WHOWASUSER.
        // This is why we borrow from the whois.* cache key ID.
        //
        // This exposes some fields (that may or may not be set).
        // Valid keys that should always be set: nick, ident, hostname, real_name
        // Valid optional keys: actual_ip, actual_hostname, account, server,
        //   server_info, actual_username
        // More optional fields MAY exist, depending on the type of ircd.
        const cache_key = command.params[1].toLowerCase();
        const whois_cache = handler.cache('whois.' + cache_key);
        const whowas_cache = handler.cache('whowas.' + cache_key);

        // after all prior RPL_WHOWASUSER pushed newer events onto the history stack
        // push the last one to complete the set (server returns from newest to oldest)
        whowas_cache.whowas = whowas_cache.whowas || [];
        if (!whois_cache.error) {
            whowas_cache.whowas.push(whois_cache);
            Object.assign(whowas_cache, whowas_cache.whowas[0]);
        } else {
            Object.assign(whowas_cache, whois_cache);
        }

        handler.emit('whowas', whowas_cache);
        whois_cache.destroy();
        whowas_cache.destroy();
    },

    ERR_WASNOSUCHNICK: function(command, handler) {
        const cache_key = command.params[1].toLowerCase();
        const cache = handler.cache('whois.' + cache_key);

        cache.nick = command.params[1];
        cache.error = 'no_such_nick';
    },

    RPL_UMODEIS: function(command, handler) {
        const nick = command.params[0];
        const raw_modes = command.params[1];
        handler.emit('user info', {
            nick: nick,
            raw_modes: raw_modes,
            tags: command.tags
        });
    },

    RPL_HOSTCLOAKING: function(command, handler) {
        handler.emit('displayed host', {
            nick: command.params[0],
            hostname: command.params[1],
            tags: command.tags
        });
    },

    RPL_MONONLINE: function(command, handler) {
        const users = (command.params[command.params.length - 1] || '').split(',');
        const parsed = _.map(users, user => Helpers.parseMask(user).nick);

        handler.emit('users online', {
            nicks: parsed,
            tags: command.tags
        });
    },

    RPL_MONOFFLINE: function(command, handler) {
        const users = (command.params[command.params.length - 1] || '').split(',');

        handler.emit('users offline', {
            nicks: users,
            tags: command.tags
        });
    },

    RPL_MONLIST: function(command, handler) {
        const cache = handler.cache('monitorList.' + command.params[0]);
        if (!cache.nicks) {
            cache.nicks = [];
        }

        const users = command.params[command.params.length - 1].split(',');

        cache.nicks.push(...users);
    },

    RPL_ENDOFMONLIST: function(command, handler) {
        const cache = handler.cache('monitorList.' + command.params[0]);
        handler.emit('monitorList', {
            nicks: cache.nicks || []
        });

        cache.destroy();
    }
};

module.exports = function AddCommandHandlers(command_controller) {
    _.each(handlers, function(handler, handler_command) {
        command_controller.addHandler(handler_command, handler);
    });
};
