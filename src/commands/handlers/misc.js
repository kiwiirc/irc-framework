var _ = require('lodash');

var handlers = {
    RPL_LISTSTART: function() {
        var cache = getChanListCache(this);
        cache.channels = [];
        this.emit('channel list start');
    },

    RPL_LISTEND: function() {
        var cache = getChanListCache(this);
        if (cache.channels.length) {
            this.emit('channel list', cache.channels);
            cache.channels = [];
        }

        cache.destroy();
        this.emit('channel list end');
    },

    RPL_LIST: function(command) {
        var cache = getChanListCache(this);
        cache.channels.push({
            channel: command.params[1],
            num_users: parseInt(command.params[2], 10),
            topic: command.params[3] || ''
        });

        if (cache.channels.length >= 50) {
            this.emit('channel list', cache.channels);
            cache.channels = [];
        }
    },



    RPL_MOTD: function(command) {
        var cache = this.cache('motd');
        cache.motd += command.params[command.params.length - 1] + '\n';
    },

    RPL_MOTDSTART: function() {
        var cache = this.cache('motd');
        cache.motd = '';
    },

    RPL_ENDOFMOTD: function() {
        var cache = this.cache('motd');
        this.emit('motd', {
            motd: cache.motd
        });
        cache.destroy();
    },

    ERR_NOMOTD: function(command) {
        var params = _.clone(command.params);
        params.shift();
        this.emit('motd', {
            error: command.params[command.params.length - 1]
        });
    },



    RPL_WHOREPLY: function(command) {
        var cache = this.cache('who');
        if (!cache.members) {
            cache.members = [];
        }

        var params = command.params;
        // G = Gone, H = Here
        var is_away = params[6][0].toUpperCase() === 'G' ?
            true :
            false;
        var hops_away = 0;
        var realname = params[7];

        // The realname should be in the format of "<num hops> <real name>"
        var space_idx = realname.indexOf(' ');
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
            num_hops_away: hops_away
        });
    },


    RPL_ENDOFWHO: function(command) {
        var cache = this.cache('who');
        this.emit('wholist', {
            target: command.params[1],
            users: cache.members || []
        });
        cache.destroy();
    },


    PING: function(command) {
        this.connection.write('PONG ' + command.params[command.params.length - 1]);
    },


    PONG: function(command) {
        this.emit('pong', {
            message: command.params[1]
        });
    },


    MODE: function(command) {
        // Check if we have a server-time
        var time = command.getServerTime();

        // Get a JSON representation of the modes
        var modes = this.parseModeList(command.params[1], command.params.slice(2));

        this.emit('mode', {
            target: command.params[0],
            nick: command.nick || command.prefix || '',
            modes: modes,
            time: time
        });
    },


    RPL_LINKS: function(command) {
        var cache = this.cache('links');
        cache.links = cache.links || [];
        cache.links.push({
            address: command.params[1],
            access_via: command.params[2],
            hops: parseInt(command.params[3].split(' ')[0]),
            description: command.params[3].split(' ').splice(1).join(' ')
        });
    },

    RPL_ENDOFLINKS: function(command) {
        var cache = this.cache('links');
        this.emit('server links', {
            links: cache.links
        });

        cache.destroy();
    },

    BATCH: function(command) {
        var that = this;
        var batch_start = command.params[0].substr(0, 1) === '+';
        var batch_id = command.params[0].substr(1);
        var cache;
        var emit_obj;

        if (!batch_id) {
            return;
        }

        if (batch_start) {
            cache = this.cache('batch.' + batch_id);
            cache.commands = [];
            cache.type = command.params[1];
            cache.params = command.params.slice(2);

        } else {
            cache = this.cache('batch.' + batch_id);
            emit_obj = {
                id: batch_id,
                type: cache.type,
                params: cache.params,
                commands: cache.commands
            };

            // Destroy the cache object before executing each command. If one
            // errors out then we don't have the cache object stuck in memory.
            cache.destroy();


            this.emit('batch start', emit_obj);
            this.emit('batch start ' + emit_obj.type, emit_obj);
            emit_obj.commands.forEach(function(c) {
                that.executeCommand(c);
            });
            this.emit('batch end', emit_obj);
            this.emit('batch end ' + emit_obj.type, emit_obj);
        }
    }
};

module.exports = function AddCommandHandlers(command_controller) {
    _.each(handlers, function(handler, handler_command) {
        command_controller.addHandler(handler_command, handler);
    });
};

function getChanListCache(that) {
    var cache = that.cache('chanlist');

    // fix some IRC networks 
    if (!cache.channels) {
        cache.channels = [];
    }

    return cache;
}
