var EventEmitter = require('eventemitter3');
var _ = require('lodash');
var MiddlewareHandler = require('middleware-handler');
var IrcCommandHandler = require('./commands/').CommandHandler;
var Connection = require('./connection');
var NetworkInfo = require('./networkinfo');
var User = require('./user');
var Channel = require('./channel');

var default_transport = null;

module.exports = IrcClient;

function IrcClient(options) {
    EventEmitter.call(this);

    this.request_extra_caps = [];
    this.options = options || null;

    this.createStructure();
}

_.extend(IrcClient.prototype, EventEmitter.prototype);

IrcClient.setDefaultTransport = function(transport) {
    default_transport = transport;
};

IrcClient.prototype._applyDefaultOptions = function(user_options) {
    var defaults = {
        nick: 'ircbot',
        username: 'ircbot',
        gecos: 'ircbot',
        encoding: 'utf8',
        version: 'node.js irc-framework',
        enable_chghost: false,
        enable_echomessage: false,
        auto_reconnect: true,
        auto_reconnect_wait: 4000,
        auto_reconnect_max_retries: 3,
        ping_interval: 30,
        ping_timeout: 120,
        transport: default_transport
    };

    var props = Object.keys(defaults);
    for (var i = 0; i < props.length; i++) {
        if (typeof user_options[props[i]] === 'undefined') {
            user_options[ props[ i ] ] = defaults[ props[ i ] ];
        }
    }

    return user_options;
};


IrcClient.prototype.createStructure = function() {
    var client = this;

    // Provides middleware hooks for either raw IRC commands or the easier to use parsed commands
    client.raw_middleware = new MiddlewareHandler();
    client.parsed_middleware = new MiddlewareHandler();

    client.connection = new Connection(client.options);
    client.network = new NetworkInfo();
    client.user = new User();

    client.command_handler = new IrcCommandHandler(client.connection, client.network);

    client.addCommandHandlerListeners();

    // Proxy some connection events onto this client
    [
        'connecting',
        'reconnecting',
        'close',
        'socket close',
        'socket error',
        'raw socket connected',
        'debug',
        'raw'
    ].forEach(function(event_name) {
        client.connection.on(event_name, function() {
            var args = Array.prototype.slice.call(arguments);
            client.emit.apply(client, [event_name].concat(args));
        });
    });

    client.connection.on('socket connected', function() {
        client.emit('socket connected');
        client.registerToNetwork();
        client.startPeriodicPing();
    });

    // IRC command routing
    client.connection.on('message', function(message, raw_line) {
        client.raw_middleware.handle([message.command, message, raw_line, client], function(err) {
            if (err) {
                console.log(err.stack);
                return;
            }

            client.command_handler.dispatch(message);
        });
    });

    // Proxy the command handler events onto the client object, with some added sugar
    client.proxyIrcEvents();
};


IrcClient.prototype.requestCap = function(cap) {
    this.request_extra_caps = this.request_extra_caps.concat(cap);
};


IrcClient.prototype.use = function(middleware_fn) {
    middleware_fn(this, this.raw_middleware, this.parsed_middleware);
    return this;
};


IrcClient.prototype.connect = function(options) {
    var client = this;

    // Use the previous options object if we're calling .connect() again
    if (!options && !client.options) {
        throw new Error('Options object missing from IrcClient.connect()');
    } else if (!options) {
        options = client.options;
    } else {
        client.options = options;
    }

    client._applyDefaultOptions(options);

    if (client.connection && client.connection.connected) {
        client.connection.end();
    }

    client.user.nick = options.nick;
    client.user.username = options.username;
    client.user.gecos = options.gecos;

    client.command_handler.requestExtraCaps(client.request_extra_caps);

    // Everything is setup and prepared, start connecting
    client.connection.connect(options);
};


// Proxy the command handler events onto the client object, with some added sugar
// Events are handled in order:
// 1. Received from the command handler
// 2. Checked if any extra properties/methods are to be added to the event + re-emitted
// 3. Routed through middleware
// 4. Emitted from the client instance
IrcClient.prototype.proxyIrcEvents = function() {
    var client = this;

    this.command_handler.on('all', function(event_name, event_arg) {
        client.resetPingTimer();
        
        // Add a reply() function to selected message events
        if (['privmsg', 'notice', 'action'].indexOf(event_name) > -1) {
            event_arg.reply = function(message) {
                var dest = event_arg.target === client.user.nick ?
                    event_arg.nick :
                    event_arg.target;

                client.say(dest, message);
            };

            // These events with .reply() function are all messages. Emit it separately
            // TODO: Should this consider a notice a message?
            client.command_handler.emit('message', _.extend({type: event_name}, event_arg));
        }

        client.parsed_middleware.handle([event_name, event_arg, client], function(err) {
            if (err) {
                //console.error('Middleware error', err.stack);
                return;
            }

            client.emit(event_name, event_arg);
        });
    });
};


IrcClient.prototype.addCommandHandlerListeners = function() {
    var client = this;
    var commands = this.command_handler;

    commands.on('nick', function(event) {
        if (client.user.nick === event.nick) {
            client.user.nick = event.new_nick;
        }
    });

    commands.on('registered', function(event) {
        client.user.nick = event.nick;
        client.connection.registeredSuccessfully();
        client.emit('connected', event);
    });

    commands.on('displayed host', function(event) {
        if (client.user.nick === event.nick) {
            client.user.host = event.host;
        }
    });

    // Don't let IRC ERROR command kill the node.js process if unhandled
    commands.on('error', function(event) {
    });
};


IrcClient.prototype.registerToNetwork = function() {
    var webirc = this.options.webirc;

    if (webirc) {
        this.raw('WEBIRC', webirc.password, webirc.username, webirc.hostname, webirc.address);
    }

    this.raw('CAP LS 302');

    if (this.options.password) {
        this.raw('PASS', this.options.password);
    }

    this.raw('NICK', this.user.nick);
    this.raw('USER', this.user.username, 0, '*', this.user.gecos);
};


IrcClient.prototype.startPeriodicPing = function() {
    var that = this;
    var ping_timer = null;
    var timeout_timer = null;
    
    if(that.options.ping_interval <= 0 || that.options.ping_timeout <= 0) {
        return;
    }
    
    function scheduleNextPing() {
        ping_timer = that.connection.setTimeout(pingServer, that.options.ping_interval*1000);
    }
    
    function resetPingTimer() {
        if(ping_timer) {
            that.connection.clearTimeout(ping_timer);
        }
        
        if(timeout_timer) {
            that.connection.clearTimeout(timeout_timer);
        }
        
        scheduleNextPing();
    }
    
    function pingServer() {
        timeout_timer = that.connection.setTimeout(pingTimeout, that.options.ping_timeout*1000);
        that.ping();
    }
    
    function pingTimeout() {
        that.emit('ping timeout');
        var end_msg = that.rawString('QUIT', 'Ping timeout (' + that.options.ping_timeout + ' seconds)');
        that.connection.end(end_msg, true);
    }
    
    this.resetPingTimer = resetPingTimer;
    scheduleNextPing();
};


IrcClient.prototype.resetPingTimer = function() {};


Object.defineProperty(IrcClient.prototype, 'connected', {
    enumerable: true,
    get: function() {
        return this.connection && this.connection.connected;
    }
});




/**
 * Client API
 */
IrcClient.prototype.raw = function(input) {
    this.connection.write(this.rawString.apply(this, arguments));
};


IrcClient.prototype.rawString = function(input) {
    var args;

    if (input.constructor === Array) {
        args = input;
    } else {
        args = Array.prototype.slice.call(arguments, 0);
    }

    args = args.filter(function(item) {
        return (typeof item === 'number' || typeof item === 'string');
    });

    if (args.length > 1 && args[args.length - 1].match(/^:|\s/)) {
        args[args.length - 1] = ':' + args[args.length - 1];
    }

    return args.join(' ');
};


IrcClient.prototype.quit = function(message) {
    this.connection.end(this.rawString('QUIT', message));
};


IrcClient.prototype.ping = function(message) {
    this.raw('PING', message || '*');
};


IrcClient.prototype.changeNick = function(nick) {
    this.raw('NICK', nick);
};


IrcClient.prototype.say = function(target, message) {
    var that = this;

    // Maximum length of target + message we can send to the IRC server is 500 characters
    // but we need to leave extra room for the sender prefix so the entire message can
    // be sent from the IRCd to the target without being truncated.
    var blocks = truncateString(message, 350);

    blocks.forEach(function(block) {
        that.raw('PRIVMSG', target, block);
    });
};


IrcClient.prototype.notice = function(target, message) {
    var that = this;

    // Maximum length of target + message we can send to the IRC server is 500 characters
    // but we need to leave extra room for the sender prefix so the entire message can
    // be sent from the IRCd to the target without being truncated.
    var blocks = truncateString(message, 350);

    blocks.forEach(function(block) {
        that.raw('NOTICE', target, block);
    });
};


IrcClient.prototype.join = function(channel, key) {
    var raw = ['JOIN', channel];
    if (key) {
        raw.push(key);
    }
    this.raw(raw);
};


IrcClient.prototype.part = function(channel, message) {
    var raw = ['PART', channel];
    if (message) {
        raw.push(message);
    }
    this.raw(raw);
};

IrcClient.prototype.mode = function(channel, mode, extra_args) {
    var raw = ['MODE', channel, mode];

    if (extra_args) {
        raw.push(extra_args);
    }

    this.raw(raw);
};

IrcClient.prototype.banlist = function(channel, cb) {
    var client = this;
    var raw = ['MODE', channel, 'b'];

    this.on('banlist', function onBanlist(event) {
        if (event.channel.toLowerCase() === channel.toLowerCase()) {
            client.removeListener('banlist', onBanlist);
            if (typeof cb === 'function') {
                cb(event);
            }
        }
    });

    this.raw(raw);
};

IrcClient.prototype.ban = function(channel, mask) {
    var raw = ['MODE', channel, '+b', mask];
    this.raw(raw);
};

IrcClient.prototype.unban = function(channel, mask) {
    var raw = ['MODE', channel, '-b', mask];
    this.raw(raw);
};

IrcClient.prototype.setTopic = function(channel, newTopic) {
    this.raw('TOPIC', channel, newTopic);
};


IrcClient.prototype.ctcpRequest = function(target, type /*, paramN*/) {
    var params = Array.prototype.slice.call(arguments, 1);

    // make sure the CTCP type is uppercased
    params[0] = params[0].toUpperCase();

    this.raw(
        'PRIVMSG',
        target,
        String.fromCharCode(1) + params.join(' ') + String.fromCharCode(1)
    );
};


IrcClient.prototype.ctcpResponse = function(target, type /*, paramN*/) {
    var params = Array.prototype.slice.call(arguments, 1);

    // make sure the CTCP type is uppercased
    params[0] = params[0].toUpperCase();

    this.raw(
        'NOTICE',
        target,
        String.fromCharCode(1) + params.join(' ') + String.fromCharCode(1)
    );
};


IrcClient.prototype.action = function(target, message) {
    var that = this;

    // Maximum length of target + message we can send to the IRC server is 500 characters
    // but we need to leave extra room for the sender prefix so the entire message can
    // be sent from the IRCd to the target without being truncated.
    var blocks = truncateString(message, 350);

    blocks.forEach(function(block) {
        that.ctcpRequest(target, 'ACTION', block);
    });
};


IrcClient.prototype.whois = function(target, _cb) {
    var client = this;
    var cb;
    var irc_args = ['WHOIS'];

    // Support whois(target, arg1, arg2, argN, cb)
    _.each(arguments, function(arg) {
        if (typeof arg === 'function') {
            cb = arg;
        } else {
            irc_args.push(arg);
        }
    });

    this.on('whois', function onWhois(event) {
        if (event.nick.toLowerCase() === target.toLowerCase()) {
            client.removeListener('whois', onWhois);
            if (typeof cb === 'function') {
                cb(event);
            }
        }
    });

    this.raw(irc_args);
};


/**
 * WHO requests are queued up to run serially.
 * This is mostly because networks will only reply serially and it makes
 * it easier to include the correct replies to callbacks
 */
IrcClient.prototype.who = function(target, cb) {
    if (!this.who_queue) {
        this.who_queue = [];
    }
    this.who_queue.push([target, cb]);
    this.processNextWhoQueue();
};


IrcClient.prototype.processNextWhoQueue = function() {
    var client = this;

    // No items in the queue or the queue is already running?
    if (client.who_queue.length === 0 || client.who_queue.is_running) {
        return;
    }

    client.who_queue.is_running = true;

    var this_who = client.who_queue.shift();
    var target = this_who[0];
    var cb = this_who[1];

    if (!target || typeof target !== 'string') {
        if (typeof cb === 'function') {
            _.defer(cb, {
                target: target,
                users: []
            });
        }

        // Start the next queued WHO request
        client.who_queue.is_running = false;
        _.defer(_.bind(client.processNextWhoQueue, client));

        return;
    }

    client.on('wholist', function onWho(event) {
        client.removeListener('wholist', onWho);

        // Start the next queued WHO request
        client.who_queue.is_running = false;
        _.defer(_.bind(client.processNextWhoQueue, client));

        if (typeof cb === 'function') {
            cb({
                target: target,
                users: event.users
            });
        }
    });

    client.raw('WHO', target);
};


/**
 * Explicitely start a channel list, avoiding potential issues with broken IRC servers not sending RPL_LISTSTART
 */
IrcClient.prototype.list = function(/* paramN */) {
    var args = Array.prototype.slice.call(arguments);
    this.command_handler.cache('chanlist').channels = [];
    args.unshift('LIST');
    this.raw(args);
};


IrcClient.prototype.channel = function(channel_name) {
    return new Channel(this, channel_name);
};


IrcClient.prototype.match = function(match_regex, cb, message_type) {
    var client = this;

    var onMessage = function(event) {
        if (event.message.match(match_regex)) {
            cb(event);
        }
    };

    this.on(message_type || 'message', onMessage);

    return {
        stop: function() {
            client.removeListener(message_type || 'message', onMessage);
        }
    };
};


IrcClient.prototype.matchNotice = function(match_regex, cb) {
    return this.match(match_regex, cb, 'notice');
};
IrcClient.prototype.matchMessage = function(match_regex, cb) {
    return this.match(match_regex, cb, 'privmsg');
};
IrcClient.prototype.matchAction = function(match_regex, cb) {
    return this.match(match_regex, cb, 'action');
};





/**
 * Truncate a string into blocks of a set size
 */
function truncateString(str, block_size) {
    block_size = block_size || 350;

    var blocks = [];
    var current_pos;

    for (current_pos = 0; current_pos < str.length; current_pos = current_pos + block_size) {
        blocks.push(str.substr(current_pos, block_size));
    }

    return blocks;
}
