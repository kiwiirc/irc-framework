var _ = require('lodash'),
    irc_numerics = require('./numerics'),
    util = require('util'),
    stream = require('stream');


function IrcCommandsHandler (connection) {
    stream.Writable.call(this, { objectMode : true });

    this.connection = connection;
    this.handlers = [];

    require('./commands/registration')(this);
    require('./commands/channel')(this);
    require('./commands/user')(this);
    require('./commands/messaging')(this);
    require('./commands/misc')(this);
}

util.inherits(IrcCommandsHandler, stream.Writable);

IrcCommandsHandler.prototype._write = function(chunk, encoding, callback) {
    this.dispatch(new IrcCommand(chunk.command.toUpperCase(), chunk));
    callback();
};

IrcCommandsHandler.prototype.dispatch = function (irc_command) {
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


IrcCommandsHandler.prototype.addHandler = function (command, handler) {
    if (typeof handler !== 'function') {
        return false;
    }
    this.handlers[command] = handler;
};


IrcCommandsHandler.prototype.emitUnknownCommand = function (command) {
    this.emit(command.command, {
        command: command.command,
        params: command.params
    });
};


IrcCommandsHandler.prototype.emitGenericNotice = function (command, msg, is_error) {
    // Default to being an error
    if (typeof is_error !== 'boolean') {
        is_error = true;
    }

    this.emit('notice', {
        from_server: true,
        nick: command.prefix,
        ident: '',
        hostname: '',
        target: command.params[0],
        msg: msg,
        numeric: parseInt(command.command, 10)
    });
};


IrcCommandsHandler.prototype.emit = function() {
    this.connection.emit.apply(this.connection, ['all'].concat(Array.prototype.slice.call(arguments,0)));
    this.connection.emit.apply(this.connection, arguments);
};


/**
 * Convert a mode string such as '+k pass', or '-i' to a readable
 * format.
 * [ { mode: '+k', param: 'pass' } ]
 * [ { mode: '-i', param: null } ]
 */
IrcCommandsHandler.prototype.parseModeList = function (mode_string, mode_params) {
    var chanmodes = this.connection.network.options.CHANMODES || [],
        prefixes = this.connection.network.options.PREFIX || [],
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
 */
function destroyCacheFn(cache, id) {
    return function() {
        console.log('removing cache', id);
        delete cache[id];
    };
}
IrcCommandsHandler.prototype.cache = function(id) {
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



function IrcCommand(command, data) {
    this.command = command += '';
    this.params = _.clone(data.params);
    this.tags = _.clone(data.tags);

    this.prefix = data.prefix;
    this.nick = data.nick;
    this.ident = data.ident;
    this.hostname = data.hostname;
}


IrcCommand.prototype.getServerTime = function() {
    var time;

    // No tags? No times.
    if (!this.tags || this.tags.length === 0) {
        return;
    }

    time = _.find(this.tags, function (tag) {
        return tag.tag === 'time';
    });

    if (time) {
        time = time.value;
    }

    // Convert the time value to a unixtimestamp
    if (typeof time === 'string') {
        if (time.indexOf('T') > -1) {
            time = parseISO8601(time);

        } else if(time.match(/^[0-9.]+$/)) {
            // A string formatted unix timestamp
            time = new Date(time * 1000);
        }

        time = time.getTime();

    } else if (typeof time === 'number') {
        time = new Date(time * 1000);
        time = time.getTime();
    }

    return time;
};





// Code based on http://anentropic.wordpress.com/2009/06/25/javascript-iso8601-parser-and-pretty-dates/#comment-154
function parseISO8601(str) {
    if (Date.prototype.toISOString) {
        return new Date(str);
    } else {
        var parts = str.split('T'),
            dateParts = parts[0].split('-'),
            timeParts = parts[1].split('Z'),
            timeSubParts = timeParts[0].split(':'),
            timeSecParts = timeSubParts[2].split('.'),
            timeHours = Number(timeSubParts[0]),
            _date = new Date();

        _date.setUTCFullYear(Number(dateParts[0]));
        _date.setUTCDate(1);
        _date.setUTCMonth(Number(dateParts[1])-1);
        _date.setUTCDate(Number(dateParts[2]));
        _date.setUTCHours(Number(timeHours));
        _date.setUTCMinutes(Number(timeSubParts[1]));
        _date.setUTCSeconds(Number(timeSecParts[0]));
        if (timeSecParts[1]) {
            _date.setUTCMilliseconds(Number(timeSecParts[1]));
        }

        return _date;
    }
}


module.exports.Handler = IrcCommandsHandler;
module.exports.Command = IrcCommand;
