var EventEmitter = require('events').EventEmitter;
var util = require('util');
var _ = require('lodash');
var MiddlewareHandler = require('middleware-handler');
var MiddlewareStream = require('./middlewarestream');
var IrcCommandHandler = require('./commands/').CommandHandler;
var Connection = require('./connection');
var NetworkInfo = require('./networkinfo');
var User = require('./user');
var Channel = require('./channel');

function IrcClient() {
    EventEmitter.call(this);

    // Provides middleware hooks for either raw IRC commands or the easier to use parsed commands
    this.raw_middleware = new MiddlewareHandler();
    this.parsed_middleware = new MiddlewareHandler();

    this.request_extra_caps = [];
}

util.inherits(IrcClient, EventEmitter);

module.exports = IrcClient;

IrcClient.prototype._applyDefaultOptions = function(user_options) {
    var defaults = {
        nick: 'ircbot',
        username: 'ircbot',
        gecos: 'ircbot',
        encoding: 'utf8',
        version: 'node.js irc-framework',
        auto_reconnect: true,
        ping_interval: 30,
        ping_timeout: 120
    };

    var props = Object.keys(defaults);
    for (var i = 0; i < props.length; i++) {
        if (typeof user_options[props[i]] === 'undefined') {
            user_options[ props[ i ] ] = defaults[ props[ i ] ];
        }
    }

    return user_options;
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

    this.options = options;
    this._applyDefaultOptions(this.options);

    if (this.connection && this.connection.connected) {
        this.connection.end();
    }

    this.connection = new Connection(this.options);
    this.network = new NetworkInfo();
    this.user = new User({
        nick: options.nick,
        username: options.username,
        gecos: options.gecos
    });

    this.command_handler = new IrcCommandHandler(this.connection, this.network);
    this.command_handler.requestExtraCaps(this.request_extra_caps);

    client.addCommandHandlerListeners();

    // Proxy some connection events onto this client
    [
        'reconnecting',
        'close',
        'socket close',
        'socket error',
        'raw socket connected',
    ].forEach(function(event_name) {
        client.connection.on(event_name, function() {
            var args = Array.prototype.slice.call(arguments);
            client.emit.apply(client, [event_name].concat(args));
        });
    });

    this.connection.on('socket connected', function() {
        client.emit('socket connected');
        client.registerToNetwork();
        client.startPeriodicPing();
    });

    // IRC command routing
    this.connection
        .pipe(new MiddlewareStream(this.raw_middleware, this))
        .pipe(this.command_handler);

    // Proxy the command handler events onto the client object, with some added sugar
    this.proxyIrcEvents();

    // Everything is setup and prepared, start connecting
    this.connection.connect();
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
        client.emit('connected', event);
        client.user.nick = event.nick;
        client.connection.registeredSuccessfully();
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

    this.raw('CAP LS');

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
        that.quit('Ping timeout (' + that.options.ping_timeout + ' seconds)');
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

    if (args.length > 1 && args[args.length - 1].indexOf(' ') > -1) {
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


IrcClient.prototype.ctcpRequest = function(target, type /*, paramN*/) {
    var params = Array.prototype.slice.call(arguments, 2);
    this.raw(
        'PRIVMSG',
        target,
        String.fromCharCode(1) + type.toUpperCase() + ' ' +
        params.join(' ') + String.fromCharCode(1)
    );
};


IrcClient.prototype.ctcpResponse = function(target, type /*, paramN*/) {
    var params = Array.prototype.slice.call(arguments, 2);
    this.raw(
        'NOTICE',
        target,
        String.fromCharCode(1) + type.toUpperCase() + ' ' +
        params.join(' ') + String.fromCharCode(1)
    );
};


IrcClient.prototype.action = function(target, message) {
    this.ctcpRequest(target, 'ACTION', message);
};


IrcClient.prototype.whois = function(target, cb) {
    var client = this;

    this.on('whois', function onWhois(event) {
        if (event.nick.toLowerCase() === target.toLowerCase()) {
            client.removeListener('whois', onWhois);
            if (typeof cb === 'function') {
                cb(event);
            }
        }
    });

    this.raw('WHOIS', target);
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
