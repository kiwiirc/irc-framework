'use strict';

const _ = {
    each: require('lodash/each'),
    find: require('lodash/find'),
};
const util = require('util');

const handlers = {
    NOTICE: function(command, handler) {
        const time = command.getServerTime();
        const message = command.params[command.params.length - 1];
        let target = command.params[0];
        let target_group;

        if ((message.charAt(0) === '\x01') && (message.charAt(message.length - 1) === '\x01')) {
            // It's a CTCP response
            handler.emit('ctcp response', {
                nick: command.nick,
                ident: command.ident,
                hostname: command.hostname,
                target: target,
                type: (message.substring(1, message.length - 1).split(' ') || [null])[0],
                message: message.substring(1, message.length - 1),
                time: time,
                account: command.getTag('account'),
                tags: command.tags
            });
        } else {
            const parsed_target = handler.network.extractTargetGroup(target);
            if (parsed_target) {
                target = parsed_target.target;
                target_group = parsed_target.target_group;
            }

            handler.emit('notice', {
                from_server: !command.nick,
                nick: command.nick,
                ident: command.ident,
                hostname: command.hostname,
                target: target,
                group: target_group,
                message: message,
                tags: command.tags,
                time: time,
                account: command.getTag('account'),
                batch: command.batch
            });
        }
    },

    PRIVMSG: function(command, handler) {
        const time = command.getServerTime();
        const message = command.params[command.params.length - 1];
        let target = command.params[0];
        let target_group;

        const parsed_target = handler.network.extractTargetGroup(target);
        if (parsed_target) {
            target = parsed_target.target;
            target_group = parsed_target.target_group;
        }

        if ((message.charAt(0) === '\x01') && (message.charAt(message.length - 1) === '\x01')) {
            // CTCP request
            const ctcp_command = message.slice(1, -1).split(' ')[0].toUpperCase();
            if (ctcp_command === 'ACTION') {
                handler.emit('action', {
                    from_server: !command.nick,
                    nick: command.nick,
                    ident: command.ident,
                    hostname: command.hostname,
                    target: target,
                    group: target_group,
                    message: message.substring(8, message.length - 1),
                    tags: command.tags,
                    time: time,
                    account: command.getTag('account'),
                    batch: command.batch
                });
            } else if (ctcp_command === 'VERSION' && handler.connection.options.version) {
                handler.connection.write(util.format(
                    'NOTICE %s :\x01VERSION %s\x01',
                    command.nick,
                    handler.connection.options.version
                ));
            } else {
                handler.emit('ctcp request', {
                    from_server: !command.nick,
                    nick: command.nick,
                    ident: command.ident,
                    hostname: command.hostname,
                    target: target,
                    group: target_group,
                    type: ctcp_command || null,
                    message: message.substring(1, message.length - 1),
                    time: time,
                    account: command.getTag('account'),
                    tags: command.tags
                });
            }
        } else {
            handler.emit('privmsg', {
                from_server: !command.nick,
                nick: command.nick,
                ident: command.ident,
                hostname: command.hostname,
                target: target,
                group: target_group,
                message: message,
                tags: command.tags,
                time: time,
                account: command.getTag('account'),
                batch: command.batch
            });
        }
    },
    TAGMSG: function(command, handler) {
        const time = command.getServerTime();
        const target = command.params[0];
        handler.emit('tagmsg', {
            from_server: !command.nick,
            nick: command.nick,
            ident: command.ident,
            hostname: command.hostname,
            target: target,
            tags: command.tags,
            time: time,
            account: command.getTag('account'),
            batch: command.batch
        });
    },

    RPL_WALLOPS: function(command, handler) {
        handler.emit('wallops', {
            from_server: false,
            nick: command.nick,
            ident: command.ident,
            hostname: command.hostname,
            message: command.params[command.params.length - 1],
            account: command.getTag('account'),
            tags: command.tags
        });
    }
};

module.exports = function AddCommandHandlers(command_controller) {
    _.each(handlers, function(handler, handler_command) {
        command_controller.addHandler(handler_command, handler);
    });
};
