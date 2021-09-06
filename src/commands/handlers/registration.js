'use strict';

const Helpers = require('../../helpers');

const _ = {
    intersection: require('lodash/intersection'),
    difference: require('lodash/difference'),
    each: require('lodash/each'),
    uniq: require('lodash/uniq'),
};

const handlers = {
    RPL_WELCOME: function(command, handler) {
        const nick = command.params[0];

        // Get the server name so we know which messages are by the server in future
        handler.network.server = command.prefix;

        handler.network.cap.negotiating = false;

        // We can't use the time given here as ZNC actually replays the time when it first connects
        // to an IRC server, not now(). Send a PING so that we can get a reliable time from PONG
        if (handler.network.cap.isEnabled('server-time')) {
            // Ping to try get a server-time in its response as soon as possible
            handler.connection.write('PING ' + Date.now());
        }

        handler.emit('registered', {
            nick: nick,
            tags: command.tags
        });
    },

    RPL_YOURHOST: function(command, handler) {
        // Your host is ircd.network.org, running version InspIRCd-2.0
        const param = command.params[1] || '';
        const m = param.match(/running version (.*)$/);
        if (!m) {
            handler.network.ircd = '';
        } else {
            handler.network.ircd = m[1];
        }
    },

    RPL_ISUPPORT: function(command, handler) {
        const options = command.params;
        let i;
        let option;
        let matches;
        let j;

        for (i = 1; i < options.length; i++) {
            option = Helpers.splitOnce(options[i], '=');
            option[0] = option[0].toUpperCase();

            handler.network.options[option[0]] = (typeof option[1] !== 'undefined') ? option[1] : true;

            if (option[0] === 'PREFIX') {
                matches = /\(([^)]*)\)(.*)/.exec(option[1]);
                if (matches && matches.length === 3) {
                    handler.network.options.PREFIX = [];
                    for (j = 0; j < matches[2].length; j++) {
                        handler.network.options.PREFIX.push({
                            symbol: matches[2].charAt(j),
                            mode: matches[1].charAt(j)
                        });
                    }
                } else if (option[1] === '') {
                    handler.network.options.PREFIX = [];
                }
            } else if (option[0] === 'CHANTYPES') {
                handler.network.options.CHANTYPES = handler.network.options.CHANTYPES.split('');
            } else if (option[0] === 'STATUSMSG') {
                handler.network.options.STATUSMSG = handler.network.options.STATUSMSG.split('');
            } else if (option[0] === 'CHANMODES') {
                handler.network.options.CHANMODES = option[1].split(',');
            } else if (option[0] === 'CASEMAPPING') {
                handler.network.options.CASEMAPPING = option[1];
            } else if (option[0] === 'NETWORK') {
                handler.network.name = option[1];
            } else if (option[0] === 'NAMESX' && !handler.network.cap.isEnabled('multi-prefix')) {
                // Tell the server to send us all user modes in NAMES reply, not just
                // the highest one
                handler.connection.write('PROTOCTL NAMESX');
            }
        }

        handler.emit('server options', {
            options: handler.network.options,
            cap: handler.network.cap.enabled,
            tags: command.tags
        });
    },

    CAP: function(command, handler) {
        let request_caps = [];
        const capability_values = Object.create(null);

        // TODO: capability modifiers
        // i.e. - for disable, ~ for requires ACK, = for sticky
        const capabilities = command.params[command.params.length - 1]
            .replace(/(?:^| )[-~=]/, '')
            .split(' ')
            .map(function(cap) {
                // CAPs in 3.2 may be in the form of CAP=VAL. So seperate those out
                const sep = cap.indexOf('=');
                if (sep === -1) {
                    capability_values[cap] = '';
                    return cap;
                }

                const cap_name = cap.substr(0, sep);
                const cap_value = cap.substr(sep + 1);

                capability_values[cap_name] = cap_value;
                return cap_name;
            });

        // Which capabilities we want to enable
        let want = [
            'cap-notify',
            'batch',
            'multi-prefix',
            'message-tags',
            'draft/message-tags-0.2',
            'away-notify',
            'invite-notify',
            'account-notify',
            'account-tag',
            'server-time',
            'userhost-in-names',
            'extended-join',
            'znc.in/server-time-iso',
            'znc.in/server-time'
        ];

        // Optional CAPs depending on settings
        const saslAuth = getSaslAuth(handler);
        if (saslAuth || handler.connection.options.sasl_mechanism === 'EXTERNAL') {
            want.push('sasl');
        }
        if (handler.connection.options.enable_chghost) {
            want.push('chghost');
        }
        if (handler.connection.options.enable_setname) {
            want.push('setname');
        }
        if (handler.connection.options.enable_echomessage) {
            want.push('echo-message');
        }

        want = _.uniq(want.concat(handler.request_extra_caps));

        switch (command.params[1]) {
        case 'LS':
            // Compute which of the available capabilities we want and request them
            request_caps = _.intersection(capabilities, want);
            if (request_caps.length > 0) {
                handler.network.cap.requested = handler.network.cap.requested.concat(request_caps);
            }

            // CAP 3.2 multline support. Only send our CAP requests on the last CAP LS
            // line which will not have * set for params[2]
            if (command.params[2] !== '*') {
                if (handler.network.cap.requested.length > 0) {
                    handler.network.cap.negotiating = true;
                    handler.connection.write('CAP REQ :' + handler.network.cap.requested.join(' '));
                } else {
                    handler.connection.write('CAP END');
                    handler.network.cap.negotiating = false;
                }
            }
            break;
        case 'ACK':
            if (capabilities.length > 0) {
                // Update list of enabled capabilities
                handler.network.cap.enabled = _.uniq(handler.network.cap.enabled.concat(capabilities));

                // Update list of capabilities we would like to have but that aren't enabled
                handler.network.cap.requested = _.difference(
                    handler.network.cap.requested,
                    capabilities
                );
            }
            if (handler.network.cap.negotiating) {
                if (handler.network.cap.isEnabled('sasl')) {
                    if (typeof handler.connection.options.sasl_mechanism === 'string') {
                        handler.connection.write('AUTHENTICATE ' + handler.connection.options.sasl_mechanism);
                    } else {
                        handler.connection.write('AUTHENTICATE PLAIN');
                    }
                } else if (handler.network.cap.requested.length === 0) {
                    // If all of our requested CAPs have been handled, end CAP negotiation
                    handler.connection.write('CAP END');
                    handler.network.cap.negotiating = false;
                }
            }
            break;
        case 'NAK':
            if (capabilities.length > 0) {
                handler.network.cap.requested = _.difference(
                    handler.network.cap.requested,
                    capabilities
                );
            }

            // If all of our requested CAPs have been handled, end CAP negotiation
            if (handler.network.cap.negotiating && handler.network.cap.requested.length === 0) {
                handler.connection.write('CAP END');
                handler.network.cap.negotiating = false;
            }
            break;
        case 'LIST':
            // should we do anything here?
            break;
        case 'NEW':
            // Request any new CAPs that we want but haven't already enabled
            request_caps = [];
            for (let i = 0; i < capabilities.length; i++) {
                const cap = capabilities[i];
                if (
                    want.indexOf(cap) > -1 &&
                        request_caps.indexOf(cap) === -1 &&
                        !handler.network.cap.isEnabled(cap)
                ) {
                    handler.network.cap.requested.push(cap);
                    request_caps.push(cap);
                }
            }

            handler.connection.write('CAP REQ :' + request_caps.join(' '));
            break;
        case 'DEL':
            // Update list of enabled capabilities
            handler.network.cap.enabled = _.difference(
                handler.network.cap.enabled,
                capabilities
            );
            break;
        }

        handler.emit('cap ' + command.params[1].toLowerCase(), {
            command: command.params[1],
            capabilities: capability_values,
        });
    },

    AUTHENTICATE: function(command, handler) {
        if (command.params[0] !== '+') {
            if (handler.network.cap.negotiating) {
                handler.connection.write('CAP END');
                handler.network.cap.negotiating = false;
            }

            return;
        }

        // Send blank authenticate for EXTERNAL mechanism
        if (handler.connection.options.sasl_mechanism === 'EXTERNAL') {
            handler.connection.write('AUTHENTICATE +');
            return;
        }

        const saslAuth = getSaslAuth(handler);
        const auth_str = saslAuth.account + '\0' +
            saslAuth.account + '\0' +
            saslAuth.password;
        const b = Buffer.from(auth_str, 'utf8');
        let b64 = b.toString('base64');

        while (b64.length >= 400) {
            handler.connection.write('AUTHENTICATE ' + b64.slice(0, 399));
            b64 = b64.slice(399);
        }
        if (b64.length > 0) {
            handler.connection.write('AUTHENTICATE ' + b64);
        } else {
            handler.connection.write('AUTHENTICATE +');
        }
    },

    RPL_LOGGEDIN: function(command, handler) {
        if (handler.network.cap.negotiating === true) {
            handler.connection.write('CAP END');
            handler.network.cap.negotiating = false;
        }

        const mask = Helpers.parseMask(command.params[1]);

        // Check if we have a server-time
        const time = command.getServerTime();

        handler.emit('loggedin', {
            nick: command.params[0],
            ident: mask.user,
            hostname: mask.host,
            account: command.params[2],
            time: time,
            tags: command.tags
        });

        handler.emit('account', {
            nick: command.params[0],
            ident: mask.user,
            hostname: mask.host,
            account: command.params[2],
            time: time,
            tags: command.tags
        });
    },

    RPL_LOGGEDOUT: function(command, handler) {
        const mask = Helpers.parseMask(command.params[1]);

        // Check if we have a server-time
        const time = command.getServerTime();

        handler.emit('loggedout', {
            nick: command.params[0],
            ident: mask.user,
            hostname: mask.host,
            account: false,
            time: time,
            tags: command.tags
        });

        handler.emit('account', {
            nick: command.params[0],
            ident: mask.user,
            hostname: mask.host,
            account: false,
            time: time,
            tags: command.tags
        });
    },

    RPL_SASLLOGGEDIN: function(command, handler) {
        if (handler.network.cap.negotiating === true) {
            handler.connection.write('CAP END');
            handler.network.cap.negotiating = false;
        }
    },

    ERR_SASLNOTAUTHORISED: function(command, handler) {
        if (handler.network.cap.negotiating) {
            handler.connection.write('CAP END');
            handler.network.cap.negotiating = false;
        }
    },

    ERR_SASLABORTED: function(command, handler) {
        if (handler.network.cap.negotiating) {
            handler.connection.write('CAP END');
            handler.network.cap.negotiating = false;
        }
    },

    ERR_SASLALREADYAUTHED: function(command, handler) {
        // noop
    }
};

/**
 * Only use the nick+password combo if an account has not been specifically given.
 * If an account:{account,password} has been given, use it for SASL auth.
 */
function getSaslAuth(handler) {
    const options = handler.connection.options;
    if (options.account && options.account.account) {
        // An account username has been given, use it for SASL auth
        return {
            account: options.account.account,
            password: options.account.password || '',
        };
    } else if (options.account) {
        // An account object existed but without auth credentials
        return null;
    } else if (options.password) {
        // No account credentials found but we have a server password. Also use it for SASL
        // for ease of use
        return {
            account: options.nick,
            password: options.password,
        };
    }

    return null;
}

module.exports = function AddCommandHandlers(command_controller) {
    _.each(handlers, function(handler, handler_command) {
        command_controller.addHandler(handler_command, handler);
    });
};
