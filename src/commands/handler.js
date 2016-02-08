var _ = require('lodash'),
    irc_numerics = require('./numerics'),
    IrcCommand = require('./command'),
    util = require('util'),
    stream = require('stream');


module.exports = IrcCommandHandler;


function IrcCommandHandler(connection, network_info) {
    stream.Writable.call(this, { objectMode : true });

    // Adds an 'all' event to .emit()
    this.addAllEventName();

    this.connection = connection;
    this.network = network_info;
    this.handlers = [];

    this.request_extra_caps = [];

    require('./handlers/registration')(this);
    require('./handlers/channel')(this);
    require('./handlers/user')(this);
    require('./handlers/messaging')(this);
    require('./handlers/misc')(this);
}

util.inherits(IrcCommandHandler, stream.Writable);


IrcCommandHandler.prototype._write = function(chunk, encoding, callback) {
    this.dispatch(new IrcCommand(chunk.command.toUpperCase(), chunk));
    callback();
};


IrcCommandHandler.prototype.dispatch = function (irc_command) {
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


IrcCommandHandler.prototype.requestExtraCaps = function(cap) {
    this.request_extra_caps = this.request_extra_caps.concat(cap);
};


IrcCommandHandler.prototype.addHandler = function (command, handler) {
    if (typeof handler !== 'function') {
        return false;
    }
    this.handlers[command] = handler;
};


IrcCommandHandler.prototype.emitUnknownCommand = function (command) {
    this.emit(command.command, {
        command: command.command,
        params: command.params
    });
};


// Adds an 'all' event to .emit()
IrcCommandHandler.prototype.addAllEventName = function() {
    var original_emit = this.emit;
    this.emit = function() {
        var args = Array.prototype.slice.call(arguments, 0);
        original_emit.apply(this, ['all'].concat(args));
        original_emit.apply(this, args);
    };
};


/**
 * Convert a mode string such as '+k pass', or '-i' to a readable
 * format.
 * [ { mode: '+k', param: 'pass' } ]
 * [ { mode: '-i', param: null } ]
 */
IrcCommandHandler.prototype.parseModeList = function (mode_string, mode_params) {
    var chanmodes = this.network.options.CHANMODES || [],
        prefixes = this.network.options.PREFIX || [],
        always_param = (chanmodes[0] || '').concat((chanmodes[1] || '')),
        modes = [],
        has_param, i, j, add;

    prefixes = _.reduce(prefixes, function (list, prefix) {
        list.push(prefix.mode);
        return list;
    }, []);
    always_param = always_param.split('').concat(prefixes);

    has_param = function (mode, add) {
        if (_.find(always_param, function (m) {
            return m === mode;
        })) {
            return true;
        } else if (add && _.find((chanmodes[2] || '').split(''), function (m) {
            return m === mode;
        })) {
            return true;
        } else {
            return false;
        }
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
                if (has_param(mode_string[i], add)) {
                    modes.push({mode: (add ? '+' : '-') + mode_string[i], param: mode_params[j]});
                    j++;
                } else {
                    modes.push({mode: (add ? '+' : '-') + mode_string[i], param: null});
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
    return function() {
        console.log('removing cache', id);
        delete cache[id];
    };
}


IrcCommandHandler.prototype.cache = function(id) {
    var cache;

    this._caches = this._caches || Object.create(null);
    cache = this._caches[id];

    if (!cache) {
        console.log('creating cache', id);
        cache = Object.defineProperty({}, 'destroy', {
            enumerable: false,
            configurable: false,
            value: destroyCacheFn(this._caches, id)
        });
        this._caches[id] = cache;
    }

    return cache;
};
