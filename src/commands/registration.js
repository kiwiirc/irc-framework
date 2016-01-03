var _ = require('lodash');

var handlers = {
	RPL_WELCOME: function (command) {
        var nick =  command.params[0];

        // Get the server name so we know which messages are by the server in future
        this.connection.network.server = command.prefix;

        this.connection.network.cap.negotiating = false;
        this.emit('registered', {
            nick: nick
        });
    },


    RPL_ISUPPORT: function (command) {
        var options, i, option, matches, j;
        options = command.params;
        
        for (i = 1; i < options.length; i++) {
            option = options[i].split("=", 2);
            option[0] = option[0].toUpperCase();

            this.connection.network.options[option[0]] = (typeof option[1] !== 'undefined') ? option[1] : true;

            if (option[0] === 'PREFIX') {
                matches = /\(([^)]*)\)(.*)/.exec(option[1]);
                if ((matches) && (matches.length === 3)) {
                    this.connection.network.options.PREFIX = [];
                    for (j = 0; j < matches[2].length; j++) {
                        this.connection.network.options.PREFIX.push({symbol: matches[2].charAt(j), mode: matches[1].charAt(j)});
                    }
                }
            } else if (option[0] === 'CHANTYPES') {
                this.connection.network.options.CHANTYPES = this.connection.network.options.CHANTYPES.split('');
            } else if (option[0] === 'CHANMODES') {
                this.connection.network.options.CHANMODES = option[1].split(',');
            } else if (option[0] === 'NETWORK') {
                this.connection.network.name = option[1];
            } else if (option[0] === 'NAMESX' && !this.connection.network.cap.isEnabled('multi-prefix')) {
                // Tell the server to send us all user modes in NAMES reply, not jsut the highest one
                this.connection.write('PROTOCTL NAMESX');
            }
        }
        
        this.emit('server options', {
            options: this.connection.network.options,
            cap: this.connection.network.cap.enabled
        });
    },


    CAP: function (command) {
        // TODO: capability modifiers
        // i.e. - for disable, ~ for requires ACK, = for sticky
        var capabilities = command.params[command.params.length - 1].replace(/(?:^| )[\-~=]/, '').split(' ');
        var request;

        // Which capabilities we want to enable
        var want = ['multi-prefix', 'away-notify', 'server-time', 'extended-join', 'znc.in/server-time-iso', 'znc.in/server-time', 'twitch.tv/membership'];

        if (this.connection.password) {
            want.push('sasl');
        }

        switch (command.params[1]) {
            case 'LS':
                // Compute which of the available capabilities we want and request them
                request = _.intersection(capabilities, want);
                if (request.length > 0) {
                    this.connection.network.cap.requested = request;
                    this.connection.write('CAP REQ :' + request.join(' '));
                } else {
                    this.connection.write('CAP END');
                    this.connection.network.cap.negotiating = false;
                }
                break;
            case 'ACK':
                if (capabilities.length > 0) {
                    // Update list of enabled capabilities
                    this.connection.network.cap.enabled = capabilities;
                    // Update list of capabilities we would like to have but that aren't enabled
                    this.connection.network.cap.requested = _.difference(this.connection.network.cap.requested, capabilities);
                }
                if (this.connection.network.cap.enabled.length > 0) {
                    if (this.connection.network.cap.isEnabled('sasl')) {
                        this.connection.write('AUTHENTICATE PLAIN');
                    } else {
                        this.connection.write('CAP END');
                        this.connection.network.cap.negotiating = false;
                    }
                }
                break;
            case 'NAK':
                if (capabilities.length > 0) {
                    this.connection.network.cap.requested = _.difference(this.connection.network.cap.requested, capabilities);
                }
                if (this.connection.network.cap.requested.length > 0) {
                    this.connection.write('CAP END');
                    this.connection.network.cap.negotiating = false;
                }
                break;
            case 'LIST':
                // should we do anything here?
                break;
        }
    },


    AUTHENTICATE: function (command) {
        var b = new Buffer(this.connection.nick + "\0" + this.connection.nick + "\0" + this.connection.password, 'utf8');
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
            this.connection.network.cap.negotiating = false;
        }
    },


    RPL_SASLAUTHENTICATED: function () {
        this.connection.write('CAP END');
        this.connection.network.cap.negotiating = false;
    },


    RPL_SASLLOGGEDIN: function () {
        if (this.connection.network.cap.negotiating === true) {
            this.connection.write('CAP END');
            this.connection.network.cap.negotiating = false;
        }
    },

    ERR_SASLNOTAUTHORISED: function () {
        this.connection.write('CAP END');
        this.connection.network.cap.negotiating = false;
    },


    ERR_SASLABORTED: function () {
        this.connection.write('CAP END');
        this.connection.network.cap.negotiating = false;
    },


    ERR_SASLALREADYAUTHED: function () {
        // noop
    }
};

module.exports = function AddCommandHandlers(command_controller) {
    _.each(handlers, function(handler, handler_command) {
        command_controller.addHandler(handler_command, handler);
    });
};
