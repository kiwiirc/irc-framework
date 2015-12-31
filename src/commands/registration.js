var _ = require('lodash');

var handlers = {
	'001': function RPL_WELCOME(client, command, next) {
        var nick =  command.params[0];

        // Get the server name so we know which messages are by the server in future
        client.server_name = command.prefix;

        client.cap_negotiation = false;
        client.emit('registered', {
            nick: nick
        });

        next();
    },


    '005': function RPL_ISUPPORT(client, command, next) {
        var options, i, option, matches, j;
        options = command.params;
        for (i = 1; i < options.length; i++) {
            option = options[i].split("=", 2);
            option[0] = option[0].toUpperCase();
            client.ircd_options[option[0]] = (typeof option[1] !== 'undefined') ? option[1] : true;
            if (_.include(['NETWORK', 'PREFIX', 'CHANTYPES', 'CHANMODES', 'NAMESX'], option[0])) {
                if (option[0] === 'PREFIX') {
                    matches = /\(([^)]*)\)(.*)/.exec(option[1]);
                    if ((matches) && (matches.length === 3)) {
                        client.ircd_options.PREFIX = [];
                        for (j = 0; j < matches[2].length; j++) {
                            client.ircd_options.PREFIX.push({symbol: matches[2].charAt(j), mode: matches[1].charAt(j)});
                        }
                    }
                } else if (option[0] === 'CHANTYPES') {
                    client.ircd_options.CHANTYPES = client.ircd_options.CHANTYPES.split('');
                } else if (option[0] === 'CHANMODES') {
                    client.ircd_options.CHANMODES = option[1].split(',');
                } else if ((option[0] === 'NAMESX') && (!_.contains(client.cap.enabled, 'multi-prefix'))) {
                    client.write('PROTOCTL NAMESX');
                }
            }
        }
        client.emit('server options', {
            options: client.ircd_options,
            cap: client.cap.enabled
        });

        next();
    },


    CAP: function CAP(client, command, next) {
        // TODO: capability modifiers
        // i.e. - for disable, ~ for requires ACK, = for sticky
        var capabilities = command.params[command.params.length - 1].replace(/(?:^| )[\-~=]/, '').split(' ');
        var request;

        // Which capabilities we want to enable
        var want = ['multi-prefix', 'away-notify', 'server-time', 'extended-join', 'znc.in/server-time-iso', 'znc.in/server-time', 'twitch.tv/membership'];

        if (client.password) {
            want.push('sasl');
        }

        switch (command.params[1]) {
            case 'LS':
                // Compute which of the available capabilities we want and request them
                request = _.intersection(capabilities, want);
                if (request.length > 0) {
                    client.cap.requested = request;
                    client.write('CAP REQ :' + request.join(' '));
                } else {
                    client.write('CAP END');
                    client.cap_negotiation = false;
                }
                break;
            case 'ACK':
                if (capabilities.length > 0) {
                    // Update list of enabled capabilities
                    client.cap.enabled = capabilities;
                    // Update list of capabilities we would like to have but that aren't enabled
                    client.cap.requested = _.difference(client.cap.requested, capabilities);
                }
                if (client.cap.enabled.length > 0) {
                    if (_.contains(client.cap.enabled, 'sasl')) {
                        client.write('AUTHENTICATE PLAIN');
                    } else {
                        client.write('CAP END');
                        client.cap_negotiation = false;
                    }
                }
                break;
            case 'NAK':
                if (capabilities.length > 0) {
                    client.cap.requested = _.difference(client.cap.requested, capabilities);
                }
                if (client.cap.requested.length > 0) {
                    client.write('CAP END');
                    client.cap_negotiation = false;
                }
                break;
            case 'LIST':
                // should we do anything here?
                break;
        }

        next();
    },


    AUTHENTICATE: function AUTHENTICATE(client, command, next) {
        var b = new Buffer(client.nick + "\0" + client.nick + "\0" + client.password, 'utf8');
        var b64 = b.toString('base64');
        if (command.params[0] === '+') {
            while (b64.length >= 400) {
                client.write('AUTHENTICATE ' + b64.slice(0, 399));
                b64 = b64.slice(399);
            }
            if (b64.length > 0) {
                client.write('AUTHENTICATE ' + b64);
            } else {
                client.write('AUTHENTICATE +');
            }
        } else {
            client.write('CAP END');
            client.cap_negotiation = false;
        }

        next();
    },


    '900': function RPL_SASLAUTHENTICATED(client, command, next) {
        client.write('CAP END');
        client.cap_negotiation = false;
        next();
    },


    RPL_SASLLOGGEDIN: function RPL_SASLLOGGEDIN(client, command, next) {
        if (client.cap_negotiation === true) {
            client.write('CAP END');
            client.cap_negotiation = false;
        }

        next();
    },

    '904': function ERR_SASLNOTAUTHORISED(client, command, next) {
        client.write('CAP END');
        client.cap_negotiation = false;
        next();
    },


    '906': function ERR_SASLABORTED(client, command, next) {
        client.write('CAP END');
        client.cap_negotiation = false;
        next();
    },


    '907': function ERR_SASLALREADYAUTHED(client, command, next) {
        // noop
        next();
    }
};

module.exports = handlers;
