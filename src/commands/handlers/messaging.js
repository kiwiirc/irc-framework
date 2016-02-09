var _ = require('lodash');
var util = require('util');

var handlers = {
    NOTICE: function(command) {
        var time = command.getServerTime();
        var msg = command.params[command.params.length - 1];
        var target = command.params[0];
        var target_group;

        if ((msg.charAt(0) === '\01') && (msg.charAt(msg.length - 1) === '\01')) {
            // It's a CTCP response
            this.emit('ctcp response', {
                nick: command.nick,
                ident: command.ident,
                hostname: command.hostname,
                target: target,
                msg: msg.substring(1, msg.length - 1),
                time: time
            });
        } else {
            // Support '@#channel' formats
            _.find(this.network.options.PREFIX, function(prefix) {
                if (prefix.symbol === target[0]) {
                    target_group = target[0];
                    target = target.substring(1);
                }

                return true;
            });

            this.emit('notice', {
                from_server: command.prefix === this.network.server ? true : false,
                nick: command.nick || undefined,
                ident: command.ident,
                hostname: command.hostname,
                target: target,
                group: target_group,
                msg: msg,
                time: time
            });
        }
    },


    PRIVMSG: function(command) {
        var time = command.getServerTime();
        var msg = command.params[command.params.length - 1];

        if ((msg.charAt(0) === '\01') && (msg.charAt(msg.length - 1) === '\01')) {
            // CTCP request
            if (msg.substr(1, 6) === 'ACTION') {

                this.emit('action', {
                    nick: command.nick,
                    ident: command.ident,
                    hostname: command.hostname,
                    target: command.params[0],
                    msg: msg.substring(8, msg.length - 1),
                    time: time
                });

            } else if (msg.substr(1, 7) === 'VERSION') {
                this.connection.write(util.format(
                    'NOTICE %s :\01VERSION %s\01',
                    command.nick,
                    'node.js irc-framework'
                ));

            } else if (msg.substr(1, 6) === 'SOURCE') {
                this.connection.write(util.format(
                    'NOTICE %s :\01SOURCE %s\01',
                    command.nick,
                    'https://www.kiwiirc.com/'
                ));

            } else if (msg.substr(1, 10) === 'CLIENTINFO') {
                this.connection.write(util.format(
                    'NOTICE %s :\01CLIENTINFO SOURCE VERSION\01',
                    command.nick
                ));

            } else {
                this.emit('ctcp request', {
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
            this.emit('privmsg', {
                nick: command.nick,
                ident: command.ident,
                hostname: command.hostname,
                target: command.params[0],
                msg: msg,
                time: time
            });
        }
    },


    RPL_WALLOPS: function(command) {
        this.emit('wallops', {
            from_server: false,
            nick: command.nick,
            ident: command.ident,
            hostname: command.hostname,
            msg: command.params[command.params.length - 1]
        });
    }
};

module.exports = function AddCommandHandlers(command_controller) {
    _.each(handlers, function(handler, handler_command) {
        command_controller.addHandler(handler_command, handler);
    });
};
