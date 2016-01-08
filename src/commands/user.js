var handlers = {
    NICK: function NICK(client, command, next) {
        var time;

        // Check if we have a server-time
        time = command.getServerTime();

        client.emit('nick', {
            nick: command.nick,
            ident: command.ident,
            hostname: command.hostname,
            newnick: command.params[0],
            time: time
        });

        next();
    },


    AWAY: function AWAY(client, command, next) {
        var time;

        // Check if we have a server-time
        time = command.getServerTime();

        client.emit('away', {
            nick: command.nick,
            msg: command.params[command.params.length - 1],
            time: time
        });

        next();
    },


    '433': function ERR_NICKNAMEINUSE(client, command, next) {
        client.emit('nick in use', {
            nick: command.params[1],
            reason: command.params[command.params.length - 1]
        });

        next();
    },

    '432': function ERR_ERRONEUSNICKNAME(client, command, next) {
        client.emit('nick invalid', {
            nick: command.params[1],
            reason: command.params[command.params.length - 1]
        });

        next();
    },


    '318': function RPL_ENDOFWHOIS(client, command, next) {
        var nick = command.params[1];
        var cache = client.cache('whois.' + nick);

        if (!cache.nick) {
            cache.nick = nick;
            cache.error = 'not_found';
        }

        client.emit('whois', cache);
        cache.destroy();

        next();
    },

    '301': function RPL_AWAY(client, command, next) {
        var nick = command.params[1];
        var cache = client.cache('whois.' + nick);
        cache.away = command.params[command.params.length - 1] || 'is away';

        next();
    },

    '311': function RPL_WHOISUSER(client, command, next) {
        var nick = command.params[1];
        var cache = client.cache('whois.' + nick);
        cache.nick = command.params[1];
        cache.user = command.params[2];
        cache.host = command.params[3];

        next();
    },

    '310': function RPL_WHOISHELPOP(client, command, next) {
        var nick = command.params[1];
        var cache = client.cache('whois.' + nick);
        cache.helpop = command.params[command.params.length - 1];

        next();
    },

    '335': function RPL_WHOISBOT(client, command, next) {
        var nick = command.params[1];
        var cache = client.cache('whois.' + nick);
        cache.bot = command.params[command.params.length - 1];

        next();
    },

    '312': function RPL_WHOISSERVER(client, command, next) {
        var nick = command.params[1];
        var cache = client.cache('whois.' + nick);
        cache.server = command.params[2];
        cache.server_info = command.params[command.params.length - 1];

        next();
    },

    '313': function RPL_WHOISOPERATOR(client, command, next) {
        var nick = command.params[1];
        var cache = client.cache('whois.' + nick);
        cache.operator = command.params[command.params.length - 1];

        next();
    },

    '319': function RPL_WHOISCHANNELS(client, command, next) {
        var nick = command.params[1];
        var cache = client.cache('whois.' + nick);
        cache.channels = command.params[command.params.length - 1];

        next();
    },

    '379': function RPL_WHOISMODES(client, command, next) {
        var nick = command.params[1];
        var cache = client.cache('whois.' + nick);
        cache.modes = command.params[command.params.length - 1];

        next();
    },

    '217': function RPL_WHOISIDLE(client, command, next) {
        var nick = command.params[1];
        var cache = client.cache('whois.' + nick);
        cache.idle = command.params[2];
        if (command.params[3]) {
            cache.logon = command.params[3];
        }

        next();
    },

    '307': function RPL_WHOISREGNICK(client, command, next) {
        var nick = command.params[1];
        var cache = client.cache('whois.' + nick);
        cache.registered_nick = command.params[command.params.length - 1];

        next();
    },

    '378': function RPL_WHOISHOST(client, command, next) {
        var nick = command.params[1];
        var cache = client.cache('whois.' + nick);
        cache.host = command.params[command.params.length - 1];

        next();
    },

    '671': function RPL_WHOISSECURE(client, command, next) {
        var nick = command.params[1];
        var cache = client.cache('whois.' + nick);
        cache.secure = true;

        next();
    },

    '330': function RPL_WHOISACCOUNT(client, command, next) {
        var nick = command.params[1];
        var cache = client.cache('whois.' + nick);
        cache.account = command.params[2];

        next();
    },

    '320': function RPL_WHOISSPECIAL(client, command, next) {
        var nick = command.params[1];
        var cache = client.cache('whois.' + nick);
        cache.special = command.params[command.params.length - 1];

        next();
    },

    '338': function RPL_WHOISACTUALLY(client, command, next) {
        var nick = command.params[1];
        var cache = client.cache('whois.' + nick);
        cache.actuallhost = command.params[command.params.length - 1];

        next();
    },

    '314': function RPL_WHOWASUSER(client, command, next) {
        client.emit('whowas', {
            nick: command.params[1],
            ident: command.params[2],
            host: command.params[3],
            real_name: command.params[command.params.length - 1]
        });

        next();
    },

    '369': function RPL_ENDOFWHOWAS(client, command, next) {
        // noop
        next();
    },

    '406': function ERR_WASNOSUCHNICK(client, command, next) {
        client.emit('whowas', {
            nick: command.params[1],
            error: 'no_such_nick'
        });

        next();
    },

    '221': function RPL_UMODEIS(client, command, next) {
        //client.umodes = the modes
        console.log('IMPLEMENT ME: umodes setting on irc_connection');
        next();
    }
};

module.exports = handlers;
