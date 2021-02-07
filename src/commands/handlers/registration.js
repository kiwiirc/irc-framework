var _ = require('lodash'), Cap = require('../cap');

var handlers = {
  RPL_WELCOME : function(command) {
    var nick = command.params[0];

    // Get the server name so we know which messages are by the server in future
    this.network.server = command.prefix;

    this.network.cap.negotiating = false;
    this.emit('registered', {nick : nick});
  },

  RPL_ISUPPORT : function(command) {
    var options = command.params;
    var i;
    var option;
    var matches;
    var j;

    for (i = 1; i < options.length; i++) {
      option = options[i].split('=', 2);
      option[0] = option[0].toUpperCase();

      this.network.options[option[0]] =
          (typeof option[1] !== 'undefined') ? option[1] : true;

      if (option[0] === 'PREFIX') {
        matches = /\(([^)]*)\)(.*)/.exec(option[1]);
        if (matches && matches.length === 3) {
          this.network.options.PREFIX = [];
          for (j = 0; j < matches[2].length; j++) {
            this.network.options.PREFIX.push(
                {symbol : matches[2].charAt(j), mode : matches[1].charAt(j)});
          }
        }
      } else if (option[0] === 'CHANTYPES') {
        this.network.options.CHANTYPES =
            this.network.options.CHANTYPES.split('');
      } else if (option[0] === 'CHANMODES') {
        this.network.options.CHANMODES = option[1].split(',');
      } else if (option[0] === 'NETWORK') {
        this.network.name = option[1];
      } else if (option[0] === 'NAMESX' &&
                 !this.network.cap.isEnabled('multi-prefix')) {
        // Tell the server to send us all user modes in NAMES reply, not just
        // the highest one
        this.connection.write('PROTOCTL NAMESX');
      }
    }

    this.emit('server options',
              {options : this.network.options, cap : this.network.cap.enabled});
  },

  CAP : function(command) {
    var that = this, request_caps = [],
        capabilities =
            command.params[command.params.length - 1].split(' ').map(function(
                cap) { return new Cap(cap); }),
        want = _.chain(_.keys(this.wanted_caps))
                   .union(_.keys(this.request_extra_caps))
                   .map(function(key) {
                     return _.mergeWith(that.wanted_caps[key],
                                        that.request_extra_caps[key],
                                        function(wV, eV) {
                                          if (_.isArray(wV)) {
                                            return _(wV.concat(eV)).uniq();
                                          }
                                        });
                   })
                   .value();

    if (this.connection.password) {
      want.push(
          Cap.Wanted('sasl', [ 'PLAIN' ], function(cap_value, wanted_value) {
            return !!_.find(cap_value.split(','), wanted_value);
          }));
    }

    switch (command.params[1]) {
    case 'LS':
      request_caps = _(capabilities)
                         .intersectionWith(want, Cap.matches)
                         .difference(this.network.cap.enabled, 'name')
                         .value();

      if (request_caps.length > 0) {
        this.network.cap.requested = request_caps;
        this.connection.write(_(request_caps).reduce(function(memo, cap) {
          return memo +=
                 ((memo[memo.length - 1] === ':') ? '' : ' ') + cap.name;
        }, 'CAP REQ :'));
      } else if (this.network.cap.negotiating) {
        this.connection.write('CAP END');
        this.network.cap.negotiating = false;
      }

      break;
    case 'ACK':
      break;
    case 'NAK':
      break;
    case 'NEW':
      break;
    case 'DEL':
      break;
    }
  },

  /*CAP: function(command) {
      var request_caps = [];

      // TODO: capability modifiers
      // i.e. - for disable, ~ for requires ACK, = for sticky
      var capabilities = command.params[command.params.length - 1]
          .replace(/(?:^| )[\-~=]/, '')
          .split(' ');

      // Which capabilities we want to enable
      var want = [
          'multi-prefix',
          'away-notify',
          'server-time',
          'extended-join',
          'znc.in/server-time-iso',
          'znc.in/server-time',
          'twitch.tv/membership'
      ];
      want = _(want)
          .concat(this.request_extra_caps)
          .uniq()
          .value();

      if (this.connection.password) {
          want.push('sasl');
      }

      switch (command.params[1]) {
          case 'LS':
              // Compute which of the available capabilities we want and request
  them request_caps = _.intersection(capabilities, want); if
  (request_caps.length > 0) { this.network.cap.requested = request_caps;
                  this.connection.write('CAP REQ :' + request_caps.join(' '));
              } else {
                  this.connection.write('CAP END');
                  this.network.cap.negotiating = false;
              }
              break;
          case 'ACK':
              if (capabilities.length > 0) {
                  // Update list of enabled capabilities
                  this.network.cap.enabled = capabilities;
                  // Update list of capabilities we would like to have but that
  aren't enabled this.network.cap.requested = _.difference(
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
      }
  },*/

  AUTHENTICATE : function(command) {
    var auth_str = this.connection.nick + '\0' + this.connection.nick + '\0' +
                   this.connection.password;
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

  RPL_SASLAUTHENTICATED : function() {
    this.connection.write('CAP END');
    this.network.cap.negotiating = false;
  },

  RPL_SASLLOGGEDIN : function() {
    if (this.network.cap.negotiating === true) {
      this.connection.write('CAP END');
      this.network.cap.negotiating = false;
    }
  },

  ERR_SASLNOTAUTHORISED : function() {
    this.connection.write('CAP END');
    this.network.cap.negotiating = false;
  },

  ERR_SASLABORTED : function() {
    this.connection.write('CAP END');
    this.network.cap.negotiating = false;
  },

  ERR_SASLALREADYAUTHED : function() {
    // noop
  }
};

module.exports = function AddCommandHandlers(command_controller) {
  _.each(handlers, function(handler, handler_command) {
    command_controller.addHandler(handler_command, handler);
  });
};
