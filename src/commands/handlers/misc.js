'use strict';

const _ = {
    each: require('lodash/each'),
    clone: require('lodash/clone'),
    map: require('lodash/map'),
};
const Helpers = require('../../helpers');
const IrcCommand = require('../command');

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

    RPL_OMOTD: function(command, handler) {
        const cache = handler.cache('oper motd');
        cache.motd += command.params[command.params.length - 1] + '\n';
    },

    RPL_OMOTDSTART: function(command, handler) {
        const cache = handler.cache('oper motd');
        cache.motd = '';
    },

    RPL_ENDOFOMOTD: function(command, handler) {
        const cache = handler.cache('oper motd');
        handler.emit('motd', {
            motd: cache.motd,
            tags: command.tags
        });
        cache.destroy();
    },

    ERR_NOOPERMOTD: function(command, handler) {
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
        const { parsedFlags, unparsedFlags } = Helpers.parseWhoFlags(params[6], handler.network.options);

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
            num_hops_away: hops_away,
            channel: params[1],
            tags: command.tags,
            unparsed_flags: unparsedFlags,
            ...parsedFlags,
        });
    },

    RPL_WHOSPCRPL: function(command, handler) {
        const cache = handler.cache('who');
        if (!cache.members) {
            cache.members = [];
            cache.type = 'whox';
        }

        const client = handler.client;
        const params = command.params;

        if (cache.token === 0) {
            // Token validation has already been attempted but failed,
            // ignore this event as it will not be emitted
            return;
        }

        if (!cache.token) {
            const token = parseInt(params[1], 10) || 0;
            if (token && params.length === 12 && client.whox_token.validate(token)) {
                // Token is valid, store it in the cache
                cache.token = token;
            } else {
                // This event does not have a valid token so did not come from irc-fw,
                // ignore it as the response order may differ
                cache.token = 0;
                return;
            }
        }

        const { parsedFlags, unparsedFlags } = Helpers.parseWhoFlags(params[7], handler.network.options);

        // Some ircd's use n/a for no level, use undefined to represent no level
        const op_level = /^[0-9]+$/.test(params[10]) ? parseInt(params[10], 10) : undefined;

        cache.members.push({
            nick: params[6],
            ident: params[3],
            hostname: params[4],
            server: params[5],
            op_level: op_level,
            real_name: params[11],
            account: params[9] === '0' ? '' : params[9],
            num_hops_away: parseInt(params[8], 10),
            channel: params[2],
            tags: command.tags,
            unparsed_flags: unparsedFlags,
            ...parsedFlags,
        });
    },

    RPL_ENDOFWHO: function(command, handler) {
        const cache = handler.cache('who');

        if (cache.type === 'whox' && !cache.token) {
            // Dont emit wholist for whox requests without a token
            // they did not come from irc-fw
            cache.destroy();
            return;
        }

        handler.emit('wholist', {
            target: command.params[1],
            users: cache.members || [],
            tags: command.tags
        });
        cache.destroy();
    },

    PING: function(command, handler) {
        handler.connection.write('PONG ' + command.params[command.params.length - 1]);

        const time = command.getServerTime();
        handler.emit('ping', {
            message: command.params[1],
            time: time,
            tags: command.tags
        });
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
            tags: command.tags,
            batch: command.batch
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

    RPL_INFO: function(command, handler) {
        const cache = handler.cache('info');
        if (!cache.info) {
            cache.info = '';
        }
        cache.info += command.params[command.params.length - 1] + '\n';
    },

    RPL_ENDOFINFO: function(command, handler) {
        const cache = handler.cache('info');
        handler.emit('info', {
            info: cache.info,
            tags: command.tags
        });
        cache.destroy();
    },

    RPL_HELPSTART: function(command, handler) {
        const cache = handler.cache('help');
        cache.help = command.params[command.params.length - 1] + '\n';
    },

    RPL_HELPTXT: function(command, handler) {
        const cache = handler.cache('help');
        cache.help += command.params[command.params.length - 1] + '\n';
    },

    RPL_ENDOFHELP: function(command, handler) {
        const cache = handler.cache('help');
        handler.emit('help', {
            help: cache.help,
            tags: command.tags
        });
        cache.destroy();
    },

    FAIL: standardReply,

    WARN: standardReply,

    NOTE: standardReply,

    ACK: function(command, handler) {
        const label = command.getTag('label');
        if (label) {
            handler.client._resolvePendingLabel(label, {
                type: 'ack',
            });
        }
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

            // If the batch start has a label tag, store it for resolution
            // when the batch ends (per labeled-response spec, the label is
            // on the BATCH + opener)
            const label = command.getTag('label');
            if (label) {
                cache.label = label;
            }

            // https://ircv3.net/specs/extensions/multiline#message-tags-spec
            if (cache.type === 'draft/multiline') {
                cache.tags = command.tags;
                cache.prefix = command.prefix;
                cache.nick = command.nick;
                cache.ident = command.ident;
                cache.hostname = command.hostname;
            }

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
            commands: cache.commands,
            label: cache.label || null,
        };

        // Destroy the cache object before executing each command. If one
        // errors out then we don't have the cache object stuck in memory.
        cache.destroy();

        // Resolve the pending labeled-response if this batch was labeled
        if (emit_obj.label) {
            handler.client._resolvePendingLabel(emit_obj.label, {
                type: 'batch',
                batchType: emit_obj.type,
                commands: emit_obj.commands,
            });
        }

        handler.emit('batch start', emit_obj);
        handler.emit('batch start ' + emit_obj.type, emit_obj);
        if (cache.type === 'draft/multiline') {
            handleMultilineBatch(emit_obj, cache, handler);
        } else {
            emit_obj.commands.forEach((c) => {
                c.batch = {
                    id: batch_id,
                    type: cache.type,
                    params: cache.params
                };
                if (emit_obj.label) {
                    c.label = emit_obj.label;
                }
                handler.executeCommand(c);
            });
        }

        handler.emit('batch end', emit_obj);
        handler.emit('batch end ' + emit_obj.type, emit_obj);
    }
};

function standardReply(command, handler) {
    const [cmd, code, ...context] = command.params;
    const description = context.pop();
    handler.emit('standard reply', {
        type: command.command,
        command: cmd,
        code,
        context,
        description,
        tags: command.tags,
    });
}

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

// https://ircv3.net/specs/extensions/multiline
function handleMultilineBatch(emit_obj, cache, handler) {
    const lines = emit_obj.commands;

    if (lines.length === 0) {
        return;
    }

    // Use same command (PRIVMSG or NOTICE) and target for all lines
    const first = lines[0];
    const lineCommand = first.command;
    if (lineCommand !== 'PRIVMSG' && lineCommand !== 'NOTICE') {
        return;
    }

    const target = first.params[0];

    let allBlank = true;
    for (let i = 0; i < lines.length; i++) {
        const c = lines[i];
        if (c.command !== lineCommand) {
            return;
        }
        if (c.params[0] !== target) {
            return;
        }
        const msg = c.params[c.params.length - 1];
        const isBlank = msg === '';
        if (!isBlank) {
            allBlank = false;
        }
        if (isBlank && c.tags && c.tags['draft/multiline-concat'] !== undefined) {
            // https://ircv3.net/specs/extensions/multiline#batch-types
            // "Clients MUST NOT send blank lines with the draft/multiline-concat tag.""
            return;
        }
    }

    if (allBlank) {
        return;
    }

    let combined = '';
    for (let i = 0; i < lines.length; i++) {
        const c = lines[i];
        const msg = c.params[c.params.length - 1];
        if (i === 0) {
            combined = msg;
        } else if (c.tags && c.tags['draft/multiline-concat'] !== undefined) {
            combined += msg;
        } else {
            combined += '\n' + msg;
        }
    }

    const tmp = new IrcCommand(lineCommand, {
        params: [target, combined],
        tags: cache.tags || Object.create(null),
        prefix: cache.prefix !== undefined ? cache.prefix : first.prefix,
        nick: cache.nick !== undefined ? cache.nick : first.nick,
        ident: cache.ident !== undefined ? cache.ident : first.ident,
        hostname: cache.hostname !== undefined ? cache.hostname : first.hostname,
    });
    tmp.batch = {
        id: emit_obj.id,
        type: emit_obj.type,
        params: emit_obj.params,
    };
    tmp.multiline = true;

    handler.executeCommand(tmp);
}
