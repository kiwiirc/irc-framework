'use strict';

const _ = {
    each: require('lodash/each'),
    clone: require('lodash/clone'),
    map: require('lodash/map'),
};

const handlers = {
    RPL_LISTSTART: function(command, handler) {
        const cache = getChanListCache(handler);
        cache.channels = [];
        handler.emit('channel list start');
    },

    RPL_LISTEND: function(command, handler) {
        const cache = getChanListCache(handler);
        if (cache.channels.length) {
            handler.emit('channel list', cache.channels);
            cache.channels = [];
        }

        cache.destroy();
        handler.emit('channel list end');
    },

    RPL_LIST: function(command, handler) {
        const cache = getChanListCache(handler);
        cache.channels.push({
            channel: command.params[1],
            num_users: parseInt(command.params[2], 10),
            topic: command.params[3] || '',
            tags: command.tags
        });

        if (cache.channels.length >= 50) {
            handler.emit('channel list', cache.channels);
            cache.channels = [];
        }
    },

    RPL_MOTD: function(command, handler) {
        const cache = handler.cache('motd');
        cache.motd += command.params[command.params.length - 1] + '\n';
    },

    RPL_MOTDSTART: function(command, handler) {
        const cache = handler.cache('motd');
        cache.motd = '';
    },

    RPL_ENDOFMOTD: function(command, handler) {
        const cache = handler.cache('motd');
        handler.emit('motd', {
            motd: cache.motd,
            tags: command.tags
        });
        cache.destroy();
    },

    ERR_NOMOTD: function(command, handler) {
        const params = _.clone(command.params);
        params.shift();
        handler.emit('motd', {
            error: command.params[command.params.length - 1],
            tags: command.tags
        });
    },

    RPL_WHOREPLY: function(command, handler) {
        const cache = handler.cache('who');
        if (!cache.members) {
            cache.members = [];
        }

        const params = command.params;
        // G = Gone, H = Here
        const is_away = params[6][0].toUpperCase() === 'G';

        // get user channel modes
        const net_prefixes = handler.network.options.PREFIX;
        // filter PREFIX array against the prefix's in who reply returning matched PREFIX objects
        const chan_prefixes = net_prefixes.filter(f => params[6].indexOf(f.symbol) > -1);
        // use _.map to return an array of mode strings from matched PREFIX objects
        const chan_modes = _.map(chan_prefixes, 'mode');

        let hops_away = 0;
        let realname = params[7];

        // The realname should be in the format of "<num hops> <real name>"
        const space_idx = realname.indexOf(' ');
        if (space_idx > -1) {
            hops_away = parseInt(realname.substr(0, space_idx), 10);
            realname = realname.substr(space_idx + 1);
        }

        cache.members.push({
            nick: params[5],
            ident: params[2],
            hostname: params[3],
            server: params[4],
            real_name: realname,
            away: is_away,
            num_hops_away: hops_away,
            channel: params[1],
            channel_modes: chan_modes,
            tags: command.tags
        });
    },

    RPL_WHOSPCRPL: function(command, handler) {
        const cache = handler.cache('who');
        if (!cache.members) {
            cache.members = [];
        }
        const params = command.params;

        // G = Gone, H = Here
        const is_away = params[6][0].toUpperCase() === 'G';

        // get user channel modes
        const net_prefixes = handler.network.options.PREFIX;
        // filter PREFIX array against the prefix's in who reply returning matched PREFIX objects
        const chan_prefixes = net_prefixes.filter(f => params[6].indexOf(f.symbol) > -1);
        // use _.map to return an array of mode strings from matched PREFIX objects
        const chan_modes = _.map(chan_prefixes, 'mode');

        // Some ircd's use n/a for no level, unify them all to 0 for no level
        const op_level = !/^[0-9]+$/.test(params[9]) ? 0 : parseInt(params[9], 10);

        cache.members.push({
            nick: params[5],
            ident: params[2],
            hostname: params[3],
            server: params[4],
            op_level: op_level,
            real_name: params[10],
            account: params[8] === '0' ? '' : params[8],
            away: is_away,
            num_hops_away: parseInt(params[7], 10),
            channel: params[1],
            channel_modes: chan_modes,
            tags: command.tags
        });
    },

    RPL_ENDOFWHO: function(command, handler) {
        const cache = handler.cache('who');
        handler.emit('wholist', {
            target: command.params[1],
            users: cache.members || []
        });
        cache.destroy();
    },

    PING: function(command, handler) {
        handler.connection.write('PONG ' + command.params[command.params.length - 1]);
    },

    PONG: function(command, handler) {
        const time = command.getServerTime();

        if (time) {
            handler.network.addServerTimeOffset(time);
        }

        handler.emit('pong', {
            message: command.params[1],
            time: time,
            tags: command.tags
        });
    },

    MODE: function(command, handler) {
        // Check if we have a server-time
        const time = command.getServerTime();

        // Get a JSON representation of the modes
        const raw_modes = command.params[1];
        const raw_params = command.params.slice(2);
        const modes = handler.parseModeList(raw_modes, raw_params);

        handler.emit('mode', {
            target: command.params[0],
            nick: command.nick || command.prefix || '',
            modes: modes,
            time: time,
            raw_modes: raw_modes,
            raw_params: raw_params,
            tags: command.tags
        });
    },

    RPL_LINKS: function(command, handler) {
        const cache = handler.cache('links');
        cache.links = cache.links || [];
        cache.links.push({
            address: command.params[1],
            access_via: command.params[2],
            hops: parseInt(command.params[3].split(' ')[0]),
            description: command.params[3].split(' ').splice(1).join(' '),
            tags: command.tags
        });
    },

    RPL_ENDOFLINKS: function(command, handler) {
        const cache = handler.cache('links');
        handler.emit('server links', {
            links: cache.links
        });

        cache.destroy();
    },

    BATCH: function(command, handler) {
        const batch_start = command.params[0].substr(0, 1) === '+';
        const batch_id = command.params[0].substr(1);
        const cache_key = 'batch.' + batch_id;

        if (!batch_id) {
            return;
        }

        if (batch_start) {
            const cache = handler.cache(cache_key);
            cache.commands = [];
            cache.type = command.params[1];
            cache.params = command.params.slice(2);

            return;
        }

        if (!handler.hasCache(cache_key)) {
            // If we don't have this batch ID in cache, it either means that the
            // server hasn't sent the starting batch command or that the server
            // has already sent the end batch command.
            return;
        }

        const cache = handler.cache(cache_key);
        const emit_obj = {
            id: batch_id,
            type: cache.type,
            params: cache.params,
            commands: cache.commands
        };

        // Destroy the cache object before executing each command. If one
        // errors out then we don't have the cache object stuck in memory.
        cache.destroy();

        handler.emit('batch start', emit_obj);
        handler.emit('batch start ' + emit_obj.type, emit_obj);
        emit_obj.commands.forEach(c => handler.executeCommand(c));
        handler.emit('batch end', emit_obj);
        handler.emit('batch end ' + emit_obj.type, emit_obj);
    }
};

module.exports = function AddCommandHandlers(command_controller) {
    _.each(handlers, function(handler, handler_command) {
        command_controller.addHandler(handler_command, handler);
    });
};

function getChanListCache(handler) {
    const cache = handler.cache('chanlist');

    // fix some IRC networks
    if (!cache.channels) {
        cache.channels = [];
    }

    return cache;
}
