'use strict';

/*

Generic IRC events. Simply passing selected IRC params into javascript objects

Example
    ERROR: {              IRC Command to match
        event: 'error',   Event name to trigger on the client instance
        reason: -1        Property on the triggered event, and which IRC param to should contain
    },
*/

const generics = {
    ERROR: {
        event: 'irc error',
        error: 'irc',
        reason: -1
    },

    ERR_PASSWDMISMATCH: {
        event: 'irc error',
        error: 'password_mismatch'
    },

    ERR_LINKCHANNEL: {
        event: 'channel_redirect',
        from: 1,
        to: 2
    },

    ERR_NOSUCHNICK: {
        event: 'irc error',
        error: 'no_such_nick',
        nick: 1,
        reason: -1
    },

    ERR_NOSUCHSERVER: {
        event: 'irc error',
        error: 'no_such_server',
        server: 1,
        reason: -1
    },

    ERR_CANNOTSENDTOCHAN: {
        event: 'irc error',
        error: 'cannot_send_to_channel',
        channel: 1,
        reason: -1
    },

    ERR_CANNOTSENDTOUSER: {
        event: 'irc error',
        error: 'cannot_send_to_user',
        nick: 1,
        reason: -1
    },

    ERR_TOOMANYCHANNELS: {
        event: 'irc error',
        error: 'too_many_channels',
        channel: 1,
        reason: -1
    },

    ERR_USERNOTINCHANNEL: {
        event: 'irc error',
        error: 'user_not_in_channel',
        nick: 0,
        channel: 1,
        reason: -1
    },

    ERR_NOTONCHANNEL: {
        event: 'irc error',
        error: 'not_on_channel',
        channel: 1,
        reason: -1
    },

    ERR_USERONCHANNEL: {
        event: 'irc error',
        error: 'user_on_channel',
        nick: 1,
        channel: 2
    },

    ERR_CHANNELISFULL: {
        event: 'irc error',
        error: 'channel_is_full',
        channel: 1,
        reason: -1
    },

    ERR_INVITEONLYCHAN: {
        event: 'irc error',
        error: 'invite_only_channel',
        channel: 1,
        reason: -1
    },

    ERR_BANNEDFROMCHAN: {
        event: 'irc error',
        error: 'banned_from_channel',
        channel: 1,
        reason: -1
    },
    ERR_BADCHANNELKEY: {
        event: 'irc error',
        error: 'bad_channel_key',
        channel: 1,
        reason: -1
    },

    ERR_CHANOPRIVSNEEDED: {
        event: 'irc error',
        error: 'chanop_privs_needed',
        channel: 1,
        reason: -1
    },

    ERR_UNKNOWNCOMMAND: {
        event: 'irc error',
        error: 'unknown_command',
        command: 1,
        reason: -1
    },

    ERR_YOUREBANNEDCREEP: {
        event: 'irc error',
        error: 'banned_from_network',
        reason: -1,
    },

    ERR_MONLISTFULL: {
        event: 'irc error',
        error: 'monitor_list_full',
        reason: -1
    },
};

const generic_keys = Object.keys(generics);

module.exports = function AddCommandHandlers(command_controller) {
    generic_keys.forEach(function(generic_command) {
        const generic = generics[generic_command];

        command_controller.addHandler(generic_command, function(command, handler) {
            const event_obj = {};
            const event_keys = Object.keys(generic);
            let val;

            for (let i = 0; i < event_keys.length; i++) {
                if (event_keys[i] === 'event') {
                    continue;
                }

                val = generic[event_keys[i]];
                if (typeof val === 'string') {
                    event_obj[event_keys[i]] = val;
                } else if (val >= 0) {
                    event_obj[event_keys[i]] = command.params[val];
                } else if (val < 0) {
                    event_obj[event_keys[i]] = command.params[command.params.length + val];
                }
            }

            if (event_obj.channel) {
                // Extract the group from any errors targetted towards channels with a statusmsg prefix
                // Eg. @#channel
                const parsed = handler.network.extractTargetGroup(event_obj.channel);
                if (parsed) {
                    event_obj.channel = parsed.target;
                    event_obj.target_group = parsed.target_group;
                }
            }

            handler.emit(generic.event, event_obj);
        });
    });
};
