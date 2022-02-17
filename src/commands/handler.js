'use strict';

const _ = {
    reduce: require('lodash/reduce'),
    find: require('lodash/find'),
    uniq: require('lodash/uniq'),
};
const EventEmitter = require('eventemitter3');
const irc_numerics = require('./numerics');
const IrcCommand = require('./command');

module.exports = class IrcCommandHandler extends EventEmitter {
    constructor(client) {
        super();

        // Adds an 'all' event to .emit()
        this.addAllEventName();

        this.client = client;
        this.connection = client.connection;
        this.network = client.network;
        this.handlers = [];

        this.request_extra_caps = [];

        this.resetCache();

        require('./handlers/registration')(this);
        require('./handlers/channel')(this);
        require('./handlers/user')(this);
        require('./handlers/messaging')(this);
        require('./handlers/misc')(this);
        require('./handlers/generics')(this);
    }

    dispatch(message) {
        const irc_command = new IrcCommand(message.command.toUpperCase(), message);

        // Batched commands will be collected and executed as a transaction
        const batch_id = irc_command.getTag('batch');
        if (batch_id) {
            const cache_key = 'batch.' + batch_id;
            if (this.hasCache(cache_key)) {
                const cache = this.cache(cache_key);
                cache.commands.push(irc_command);
            } else {
                // If we don't have this batch ID in cache, it either means that the
                // server hasn't sent the starting batch command or that the server
                // has already sent the end batch command.
            }
        } else {
            this.executeCommand(irc_command);
        }
    }

    executeCommand(irc_command) {
        let command_name = irc_command.command;

        // Check if we have a numeric->command name- mapping for this command
        if (irc_numerics[irc_command.command.toUpperCase()]) {
            command_name = irc_numerics[irc_command.command.toUpperCase()];
        }

        if (this.handlers[command_name]) {
            this.handlers[command_name](irc_command, this);
        } else {
            this.emitUnknownCommand(irc_command);
        }
    }

    requestExtraCaps(cap) {
        this.request_extra_caps = _.uniq(this.request_extra_caps.concat(cap));
    }

    addHandler(command, handler) {
        if (typeof handler !== 'function') {
            return false;
        }
        this.handlers[command] = handler;
    }

    emitUnknownCommand(command) {
        this.emit('unknown command', command);
    }

    // Adds an 'all' event to .emit()
    addAllEventName() {
        const original_emit = this.emit;
        this.emit = function() {
            const args = Array.prototype.slice.call(arguments, 0);
            original_emit.apply(this, ['all'].concat(args));
            original_emit.apply(this, args);
        };
    }

    /**
 * Convert a mode string such as '+k pass', or '-i' to a readable
 * format.
 * [ { mode: '+k', param: 'pass' } ]
 * [ { mode: '-i', param: null } ]
 */
    parseModeList(mode_string, mode_params) {
        const chanmodes = this.network.options.CHANMODES || [];
        let prefixes = this.network.options.PREFIX || [];
        let always_param = (chanmodes[0] || '').concat((chanmodes[1] || ''));
        const modes = [];
        let i;
        let j;
        let add;

        if (!mode_string) {
            return modes;
        }

        prefixes = _.reduce(prefixes, function(list, prefix) {
            list.push(prefix.mode);
            return list;
        }, []);
        always_param = always_param.split('').concat(prefixes);

        const hasParam = function(mode, isAdd) {
            const matchMode = function(m) {
                return m === mode;
            };

            if (_.find(always_param, matchMode)) {
                return true;
            }

            if (isAdd && _.find((chanmodes[2] || '').split(''), matchMode)) {
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
                    modes.push({ mode: (add ? '+' : '-') + mode_string[i], param: mode_params[j] });
                    j++;
                } else {
                    modes.push({ mode: (add ? '+' : '-') + mode_string[i], param: null });
                }
            }
        }

        return modes;
    }

    /**
     * Cache object for commands buffering data before emitting them
     * eg.
     * var cache = this.cache('userlist');
     * cache.nicks = [];
     * cache.destroy();
     */
    cache(id) {
        let cache = this._caches[id];

        if (!cache) {
            const destroyCacheFn = (cacheToDestroy, idInCache) => {
                return function() {
                    delete cacheToDestroy[idInCache];
                };
            };

            // We don't want the destoryCache to be iterable
            cache = Object.defineProperty({}, 'destroy', {
                enumerable: false,
                configurable: false,
                value: destroyCacheFn(this._caches, id)
            });
            this._caches[id] = cache;
        }

        return cache;
    }

    hasCache(id) {
        return this._caches && Object.prototype.hasOwnProperty.call(this._caches, id);
    }

    resetCache() {
        this._caches = Object.create(null);
    }
};
