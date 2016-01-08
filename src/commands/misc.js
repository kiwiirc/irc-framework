var _ = require('lodash'),
    parseModeList = require('../parsemodelist');

var handlers = {
    '321': function RPL_LISTSTART(client, command, next) {
        var cache = client.cache('chanlist');
        cache.channels = [];
        client.emit('channel list start');

        next();
    },

    '323': function RPL_LISTEND(client, command, next) {
        var cache = client.cache('chanlist');
        cache.destroy();
        client.emit('channel list end');

        next();
    },

    '322': function RPL_LIST(client, command, next) {
        var cache = client.cache('chanlist');
        cache.channels.push({
            channel: command.params[1],
            num_users: parseInt(command.params[2], 10),
            topic: command.params[3] || ''
        });

        if (cache.channels >= 50) {
            client.emit('channel list', cache.channels);
            cache.channels = [];
        }

        next();
    },



    '372': function RPL_MOTD(client, command, next) {
        var cache = client.cache('motd');
        cache.motd += command.params[command.params.length - 1] + '\n';

        next();
    },

    '375': function RPL_MOTDSTART(client, command, next) {
        var cache = client.cache('motd');
        cache.motd = '';

        next();
    },

    '376': function RPL_ENDOFMOTD(client, command, next) {
        var cache = client.cache('motd');
        client.emit('motd', {
            motd: cache.motd
        });
        cache.destroy();

        next();
    },

    '422': function ERR_NOMOTD(client, command, next) {
        var params = _.clone(command.params);
        params.shift();
        client.emit('motd', {
            error: command.params[command.params.length - 1]
        });

        next();
    },



    '352': function RPL_WHOREPLY(client, command, next) {
        // For the time being, NOOP this command so they don't get passed
        // down to the client. Waste of bandwidth since we do not use it yet
        // TODO: Impliment RPL_WHOREPLY
        next();
    },

    '369': function RPL_ENDOFWHO(client, command, next) {
        // For the time being, NOOP this command so they don't get passed
        // down to the client. Waste of bandwidth since we do not use it yet
        // TODO: Impliment RPL_ENDOFWHO
        next();
    },


    PING: function PING(client, command, next) {
        client.write('PONG ' + command.params[command.params.length - 1]);

        next();
    },


    MODE: function MODE(client, command, next) {
        var modes = [], time;

        // Check if we have a server-time
        time = command.getServerTime();

        // Get a JSON representation of the modes
        modes = parseModeList(client.ircd_options.CHANMODES || [], client.ircd_options.PREFIX || [], command.params[1], command.params.slice(2));

        client.emit('mode', {
            target: command.params[0],
            nick: command.nick || command.prefix || '',
            modes: modes,
            time: time
        });

        next();
    },


    ERROR: function ERROR(client, command, next) {
        client.emit('error', {
            reason: command.params[command.params.length - 1]
        });

        next();
    },

    '464': function ERR_PASSWDMISMATCH(client, command, next) {
        client.emit('server ' + client.irc_host.hostname + ' password_mismatch', {});
        next();
    },

    '470': function ERR_LINKCHANNEL(client, command, next) {
        client.emit('server ' + client.irc_host.hostname + ' channel_redirect', {
            from: command.params[1],
            to: command.params[2]
        });

        next();
    },

    '401': function ERR_NOSUCHNICK(client, command, next) {
        client.emit('server ' + client.irc_host.hostname + ' no_such_nick', {
            nick: command.params[1],
            reason: command.params[command.params.length - 1]
        });

        next();
    },

    '404': function ERR_CANNOTSENDTOCHAN(client, command, next) {
        client.emit('server ' + client.irc_host.hostname + ' cannot_send_to_channel', {
            channel: command.params[1],
            reason: command.params[command.params.length - 1]
        });

        next();
    },

    '405': function ERR_TOOMANYCHANNELS(client, command, next) {
        client.emit('server ' + client.irc_host.hostname + ' too_many_channels', {
            channel: command.params[1],
            reason: command.params[command.params.length - 1]
        });

        next();
    },

    '441': function ERR_USERNOTINCHANNEL(client, command, next) {
        client.emit('server ' + client.irc_host.hostname + ' user_not_in_channel', {
            nick: command.params[0],
            channel: command.params[1],
            reason: command.params[command.params.length - 1]
        });

        next();
    },

    '442': function ERR_NOTONCHANNEL(client, command, next) {
        client.emit('server ' + client.irc_host.hostname + ' not_on_channel', {
            channel: command.params[1],
            reason: command.params[command.params.length - 1]
        });

        next();
    },

    '443': function ERR_USERONCHANNEL(client, command, next) {
        client.emit('server ' + client.irc_host.hostname + ' user_on_channel', {
            nick: command.params[1],
            channel: command.params[2]
        });

        next();
    },

    '471': function ERR_CHANNELISFULL(client, command, next) {
        client.emit('server ' + client.irc_host.hostname + ' channel_is_full', {
            channel: command.params[1],
            reason: command.params[command.params.length - 1]
        });

        next();
    },

    '473': function ERR_INVITEONLYCHAN(client, command, next) {
        client.emit('server ' + client.irc_host.hostname + ' invite_only_channel', {
            channel: command.params[1],
            reason: command.params[command.params.length - 1]
        });

        next();
    },

    '474': function ERR_BANNEDFROMCHAN(client, command, next) {
        client.emit('server ' + client.irc_host.hostname + ' banned_from_channel', {
            channel: command.params[1],
            reason: command.params[command.params.length - 1]
        });

        next();
    },

    '475': function ERR_BADCHANNELKEY(client, command, next) {
        client.emit('server ' + client.irc_host.hostname + ' bad_channel_key', {
            channel: command.params[1],
            reason: command.params[command.params.length - 1]
        });

        next();
    },

    '482': function ERR_CHANOPRIVSNEEDED(client, command, next) {
        client.emit('server ' + client.irc_host.hostname + ' chanop_privs_needed', {
            channel: command.params[1],
            reason: command.params[command.params.length - 1]
        });

        next();
    },

    '364': function RPL_LINKS(client, command, next) {
        var cache = client.cache('links');
        cache.links = cache.links || [];
        cache.links.push({
            address: command.params[1],
            access_via: command.params[2],
            hops: parseInt(command.params[3].split(' ')[0]),
            description: command.params[3].split(' ').splice(1).join(' ')
        });

        next();
    },

    '365': function RPL_ENDOFLINKS(client, command, next) {
        var cache = client.cache('links');
        client.emit('server links', {
            links: cache.links
        });

        cache.destroy();

        next();
    }
};

module.exports = handlers;
