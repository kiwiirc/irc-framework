var _ = require('lodash');

var handlers = {
    NOTICE: function NOTICE(client, command, next) {
        var time,
            msg,
            target, target_group;

        // Check if we have a server-time
        time = command.getServerTime();

        target = command.params[0];

        msg = command.params[command.params.length - 1];
        if ((msg.charAt(0) === String.fromCharCode(1)) && (msg.charAt(msg.length - 1) === String.fromCharCode(1))) {
            // It's a CTCP response
            client.emit('ctcp response', {
                nick: command.nick,
                ident: command.ident,
                hostname: command.hostname,
                target: target,
                msg: msg.substring(1, msg.length - 1),
                time: time
            });
        } else {
            // Support '@#channel' formats
            _.find(client.ircd_options.PREFIX, function(prefix) {
                if (prefix.symbol === target[0]) {
                    target_group = target[0];
                    target = target.substring(1);
                }

                return true;
            });

            client.emit('notice', {
                from_server: command.prefix === client.server_name ? true : false,
                nick: command.nick || undefined,
                ident: command.ident,
                hostname: command.hostname,
                target: target,
                group: target_group,
                msg: msg,
                time: time
            });
        }

        next();
    },


    PRIVMSG: function PRIVMSG(client, command, next) {
        var time, msg, version_string;

        // Check if we have a server-time
        time = command.getServerTime();

        msg = command.params[command.params.length - 1];
        if ((msg.charAt(0) === String.fromCharCode(1)) && (msg.charAt(msg.length - 1) === String.fromCharCode(1))) {
            //CTCP request
            if (msg.substr(1, 6) === 'ACTION') {

                client.emit('action', {
                    nick: command.nick,
                    ident: command.ident,
                    hostname: command.hostname,
                    target: command.params[0],
                    msg: msg.substring(8, msg.length - 1),
                    time: time
                });

            } else if (msg.substr(1, 7) === 'VERSION') {
                version_string = 'node.js irc-framework';
                client.write('NOTICE ' + command.nick + ' :' + String.fromCharCode(1) + 'VERSION ' + version_string + String.fromCharCode(1));

            } else if (msg.substr(1, 6) === 'SOURCE') {
                client.write('NOTICE ' + command.nick + ' :' + String.fromCharCode(1) + 'SOURCE http://www.kiwiirc.com/' + String.fromCharCode(1));

            } else if (msg.substr(1, 10) === 'CLIENTINFO') {
                client.write('NOTICE ' + command.nick + ' :' + String.fromCharCode(1) + 'CLIENTINFO SOURCE VERSION TIME' + String.fromCharCode(1));

            } else {
                client.emit('ctcp request', {
                    nick: command.nick,
                    ident: command.ident,
                    hostname: command.hostname,
                    target: command.params[0],
                    type: (msg.substring(1, msg.length - 1).split(' ') || [null])[0],
                    msg: msg.substring(1, msg.length - 1),
                    time: time
                });
            }
        } else {
            client.emit('privmsg', {
                nick: command.nick,
                ident: command.ident,
                hostname: command.hostname,
                target: command.params[0],
                msg: msg,
                time: time
            });
        }

        next();
    },


    WALLOPS: function RPL_WALLOPS(client, command, next) {
        client.emit('wallops', {
            from_server: false,
            nick: command.nick,
            ident: command.ident,
            hostname: command.hostname,
            msg: command.params[command.params.length - 1]
        });

        next();
    },
};

module.exports = handlers;
