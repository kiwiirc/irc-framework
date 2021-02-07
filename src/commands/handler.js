var _ = require('lodash');
var irc_numerics = require('./numerics');
var IrcCommand = require('./command');
var Cap = require('./cap');
var util = require('util');
var stream = require('stream');

module.exports = IrcCommandHandler;

function IrcCommandHandler(connection, network_info) {
  stream.Writable.call(this, {objectMode : true});

  // Adds an 'all' event to .emit()
  this.addAllEventName();

  this.connection = connection;
  this.network = network_info;
  this.handlers = [];

  this.wanted_caps = [
    new Cap.Wanted('multi-prefix'), new Cap.Wanted('away-notify'),
    new Cap.Wanted('server-time'), new Cap.Wanted('extended-join'),
    new Cap.Wanted('znc.in/server-time-iso'),
    new Cap.Wanted('znc.in/server-time'), new Cap.Wanted('twitch.tv/membership')
  ];
  this.request_extra_caps = [];

  require('./handlers/registration')(this);
  require('./handlers/channel')(this);
  require('./handlers/user')(this);
  require('./handlers/messaging')(this);
  require('./handlers/misc')(this);
  require('./handlers/generics')(this);
}

util.inherits(IrcCommandHandler, stream.Writable);

IrcCommandHandler.prototype._write = function(chunk, encoding, callback) {
  this.dispatch(new IrcCommand(chunk.command.toUpperCase(), chunk));
  callback();
};

IrcCommandHandler.prototype.dispatch = function(irc_command) {
  var command_name = irc_command.command;

  // Check if we have a numeric->command name- mapping for this command
  if (irc_numerics[irc_command.command.toUpperCase()]) {
    command_name = irc_numerics[irc_command.command.toUpperCase()];
  }

  if (this.handlers[command_name]) {
    this.handlers[command_name].call(this, irc_command);
  } else {
    this.emitUnknownCommand(irc_command);
  }
};

IrcCommandHandler.prototype.requestExtraCaps = function(
    cap) { this.request_extra_caps = this.request_extra_caps.concat(cap); };

IrcCommandHandler.prototype.addHandler = function(command, handler) {
  if (typeof handler !== 'function') {
    return false;
  }
  this.handlers[command] = handler;
};

IrcCommandHandler.prototype.emitUnknownCommand = function(command) {
  this.emit(command.command,
            {command : command.command, params : command.params});
};

// Adds an 'all' event to .emit()
IrcCommandHandler.prototype.addAllEventName = function() {
  var original_emit = this.emit;
  this.emit = function() {
    var args = Array.prototype.slice.call(arguments, 0);
    original_emit.apply(this, [ 'all' ].concat(args));
    original_emit.apply(this, args);
  };
};

/**
 * Convert a mode string such as '+k pass', or '-i' to a readable
 * format.
 * [ { mode: '+k', param: 'pass' } ]
 * [ { mode: '-i', param: null } ]
 */
IrcCommandHandler.prototype.parseModeList = function(mode_string, mode_params) {
  var chanmodes = this.network.options.CHANMODES || [];
  var prefixes = this.network.options.PREFIX || [];
  var always_param = (chanmodes[0] || '').concat((chanmodes[1] || ''));
  var modes = [];
  var hasParam;
  var i;
  var j;
  var add;

  prefixes = _.reduce(prefixes, function(list, prefix) {
    list.push(prefix.mode);
    return list;
  }, []);
  always_param = always_param.split('').concat(prefixes);

  hasParam = function(mode, add) {
    var matchMode = function(m) { return m === mode; };

    if (_.find(always_param, matchMode)) {
      return true;
    }

    if (add && _.find((chanmodes[2] || '').split(''), matchMode)) {
      return true;
    }

    return false;
  };

  j = 0;
  for (i = 0; i < mode_string.length; i++) {
    switch (mode_string[i]) {
    case '+':
      add = true;
      break;
    case '-':
      add = false;
      break;
    default:
      if (hasParam(mode_string[i], add)) {
        modes.push({
          mode : (add ? '+' : '-') + mode_string[i],
          param : mode_params[j]
        });
        j++;
      } else {
        modes.push({mode : (add ? '+' : '-') + mode_string[i], param : null});
      }
    }
  }

  return modes;
};

/**
 * Cache object for commands buffering data before emitting them
 * eg.
 * var cache = this.cache('userlist');
 * cache.nicks = [];
 * cache.destroy();
 */
function destroyCacheFn(cache, id) {
  return function() { delete cache[id]; };
}

IrcCommandHandler.prototype.cache = function(id) {
  var cache;

  this._caches = this._caches || Object.create(null);
  cache = this._caches[id];

  if (!cache) {
    cache = Object.defineProperty({}, 'destroy', {
      enumerable : false,
      configurable : false,
      value : destroyCacheFn(this._caches, id)
    });
    this._caches[id] = cache;
  }

  return cache;
};
