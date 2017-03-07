var _ = require('lodash');

var handlers = {
	RPL_WELCOME: function(command) {
        var nick =  command.params[0];

        // Get the server name so we know which messages are by the server in future
        this.network.server = command.prefix;

        this.network.cap.negotiating = false;
        this.emit('registered', {
            nick: nick
        });
    },


    RPL_ISUPPORT: function(command) {
        var options = command.params;
        var i;
        var option;
        var matches;
        var j;

        for (i = 1; i < options.length; i++) {
            option = options[i].split('=', 2);
            option[0] = option[0].toUpperCase();

            this.network.options[option[0]] = (typeof option[1] !== 'undefined') ? option[1] : true;

            if (option[0] === 'PREFIX') {
                matches = /\(([^)]*)\)(.*)/.exec(option[1]);
                if (matches && matches.length === 3) {
                    this.network.options.PREFIX = [];
                    for (j = 0; j < matches[2].length; j++) {
                        this.network.options.PREFIX.push({
                            symbol: matches[2].charAt(j),
                            mode: matches[1].charAt(j)
                        });
                    }
                }
            } else if (option[0] === 'CHANTYPES') {
                this.network.options.CHANTYPES = this.network.options.CHANTYPES.split('');
            } else if (option[0] === 'CHANMODES') {
                this.network.options.CHANMODES = option[1].split(',');
            } else if (option[0] === 'NETWORK') {
                this.network.name = option[1];
            } else if (option[0] === 'NAMESX' && !this.network.cap.isEnabled('multi-prefix')) {
                // Tell the server to send us all user modes in NAMES reply, not just
                // the highest one
                this.connection.write('PROTOCTL NAMESX');
            }
        }

        this.emit('server options', {
            options: this.network.options,
            cap: this.network.cap.enabled
        });
    },


    CAP: function(command) {
        var request_caps = [];
        var capability_values = Object.create(null);

        // TODO: capability modifiers
        // i.e. - for disable, ~ for requires ACK, = for sticky
        var capabilities = command.params[command.params.length - 1]
            .replace(/(?:^| )[\-~=]/, '')
            .split(' ')
            .map(function(cap) {
                // CAPs in 3.2 may be in the form of CAP=VAL. So seperate those out
                var sep = cap.indexOf('=');
                if (sep === -1) {
                    return cap;
                }

                var cap_name = cap.substr(0, sep);
                var cap_value = cap.substr(sep + 1);

                capability_values[cap_name] = cap_value;
                return cap_name;
            });

        // Which capabilities we want to enable
        var want = [
            'batch',
            'multi-prefix',
            'away-notify',
            'invite-notify',
            'account-notify',
            'account-tag',
            'server-time',
            'userhost-in-names',
            'extended-join',
            'znc.in/server-time-iso',
            'znc.in/server-time',
            'twitch.tv/membership'
        ];

        // Optional CAPs depending on settings
        if (this.connection.options.password) {
            want.push('sasl');
        }
        if (this.connection.options.enable_chghost) {
            want.push('chghost');
        }
        if (this.connection.options.enable_echomessage) {
            want.push('echo-message');
        }

        want = _(want)
            .concat(this.request_extra_caps)
            .uniq()
            .value();

        switch (command.params[1]) {
            case 'LS':
                // Compute which of the available capabilities we want and request them
                request_caps = _.intersection(capabilities, want);
                if (request_caps.length > 0) {
                    this.network.cap.requested = this.network.cap.requested.concat(request_caps);
                }

                // CAP 3.2 multline support. Only send our CAP requests on the last CAP LS
                // line which will not have * set for params[2]
                if (command.params[2] !== '*') {
                    if (request_caps.length > 0) {
                        this.connection.write('CAP REQ :' + request_caps.join(' '));
                    } else {
                        this.connection.write('CAP END');
                        this.network.cap.negotiating = false;
                    }
                }
                break;
            case 'ACK':
                if (capabilities.length > 0) {
                    // Update list of enabled capabilities
                    this.network.cap.enabled = capabilities;
                    // Update list of capabilities we would like to have but that aren't enabled
                    this.network.cap.requested = _.difference(
                        this.network.cap.requested,
                        capabilities
                    );
                }
                if (this.network.cap.enabled.length > 0) {
                    if (this.network.cap.isEnabled('sasl')) {
                        this.connection.write('AUTHENTICATE PLAIN');
                    } else {
                        this.connection.write('CAP END');
                        this.network.cap.negotiating = false;
                    }
                }
                break;
            case 'NAK':
                if (capabilities.length > 0) {
                    this.network.cap.requested = _.difference(
                        this.network.cap.requested,
                        capabilities
                    );
                }
                if (this.network.cap.requested.length > 0) {
                    this.connection.write('CAP END');
                    this.network.cap.negotiating = false;
                }
                break;
            case 'LIST':
                // should we do anything here?
                break;
            case 'NEW':
                // Not supported yet
                break;
            case 'DEL':
                // Not supported yet
                break;
        }
    },


    AUTHENTICATE: function(command) {
        var auth_str = this.connection.options.nick + '\0' +
            this.connection.options.nick + '\0' +
            this.connection.options.password;
        var b = new Buffer(auth_str, 'utf8');
        var b64 = b.toString('base64');

        if (command.params[0] === '+') {
            while (b64.length >= 400) {
                this.connection.write('AUTHENTICATE ' + b64.slice(0, 399));
                b64 = b64.slice(399);
            }
            if (b64.length > 0) {
                this.connection.write('AUTHENTICATE ' + b64);
            } else {
                this.connection.write('AUTHENTICATE +');
            }
        } else {
            this.connection.write('CAP END');
            this.network.cap.negotiating = false;
        }
    },


    RPL_SASLAUTHENTICATED: function() {
        this.connection.write('CAP END');
        this.network.cap.negotiating = false;
    },


    RPL_SASLLOGGEDIN: function() {
        if (this.network.cap.negotiating === true) {
            this.connection.write('CAP END');
            this.network.cap.negotiating = false;
        }
    },

    ERR_SASLNOTAUTHORISED: function() {
        this.connection.write('CAP END');
        this.network.cap.negotiating = false;
    },


    ERR_SASLABORTED: function() {
        this.connection.write('CAP END');
        this.network.cap.negotiating = false;
    },


    ERR_SASLALREADYAUTHED: function() {
        // noop
    }
};

module.exports = function AddCommandHandlers(command_controller) {
    _.each(handlers, function(handler, handler_command) {
        command_controller.addHandler(handler_command, handler);
    });
};
