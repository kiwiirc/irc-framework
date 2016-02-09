var EventEmitter = require('events').EventEmitter,
    util = require('util'),
    _ = require('lodash'),
    DuplexStream = require('stream').Duplex,
    MiddlewareHandler = require('middleware-handler'),
    MiddlewareStream = require('./middlewarestream'),
    IrcCommandHandler = require('./commands/').CommandHandler,
    Connection = require('./connection'),
    NetworkInfo = require('./networkinfo'),
    User = require('./user');

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
        encoding: 'utf8'
    };

    var props = Object.keys(defaults);
    for (var i=0; i<props.length; i++) {
        if (typeof user_options[props[i]] === 'undefined') {
            user_options[props[i]] = defaults[props[i]];
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
    console.log('IrcClient.connect()');

    var client = this;
    
    this.options = options;
    this._applyDefaultOptions(this.options);

    if (this.connection && this.connection.connected) {
        this.connection.end();
    }

    this.connection = new Connection(options);
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
    ['reconnecting', 'close'].forEach(function(event_name) {
        client.connection.on(event_name, function() {
            client.emit.apply(client, arguments);
        });
    });

    this.connection.on('socket connected', function () {
        client.emit('socket connected');
        client.registerToNetwork();
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
                console.error('Middleware error', err);
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
        client.emit('connected');
    });
};


IrcClient.prototype.registerToNetwork = function() {
    var webirc = this.options.webirc;

    if (webirc) {
        this.connection.write('WEBIRC ' + webirc.password + ' kiwiIRC ' + webirc.hostname + ' ' + webirc.address);
    }

    this.connection.write('CAP LS');

    if (this.options.password) {
        this.connection.write('PASS ' + this.password);
    }

    this.connection.write('NICK ' + this.user.nick);
    this.connection.write('USER ' + this.user.username + ' 0 * :' + this.user.gecos);
};


Object.defineProperty(IrcClient.prototype, 'connected', {
    enumerable: true,
    get: function () {
        return this.connection && this.connection.connected;
    }
});




/**
 * Client API
 */
IrcClient.prototype.raw = function(input) {
    var args;

    if (input.constructor === Array) {
        args = input;
    } else {
        args = Array.prototype.slice.call(arguments, 0);
    }
    console.log('raw()', args);

    if (args[args.length-1].indexOf(' ') > -1) {
        args[args.length-1] = ':' + args[args.length-1];
    }

    this.connection.write(args.join(' '));
};


IrcClient.prototype.quit = function(message) {
    this.raw('QUIT', message);
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
    var params = arguments.slice(2);
    this.raw('PRIVMSG', target, String.fromCharCode(1) + type.toUpperCase(), params.join(' ') + String.fromCharCode(1));
};


IrcClient.prototype.ctcpResponse = function(target, type /*, paramN*/) {
    var params = arguments.slice(2);
    this.raw('NOTICE', target, String.fromCharCode(1) + type.toUpperCase(), params.join(' ') + String.fromCharCode(1));
};


IrcClient.prototype.whois = function(target) {
    this.raw('WHOIS', target);
};


IrcClient.prototype.channel = function(channel_name) {
    return new IrcClient.Channel(this, channel_name);
};


IrcClient.prototype.match = function(match_regex, cb, message_type) {
    var client = this;

    var onMessage = function(event) {
        if (event.msg.match(match_regex)) {
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





IrcClient.Channel = function IrcChannel(irc_client, channel_name, key) {
    var that = this;

    this.irc_client = irc_client;
    this.name = channel_name;

    // TODO: Proxy channel related events from irc_bot to this instance

    this.say = _.partial(irc_client.say.bind(irc_client), channel_name);
    this.notice = _.partial(irc_client.notice.bind(irc_client), channel_name);
    //this.action = _.partial(irc_client.action.bind(irc_client), channel_name);
    this.part = _.partial(irc_client.part.bind(irc_client), channel_name);
    this.join = _.partial(irc_client.join.bind(irc_client), channel_name);

    this.users = [];
    irc_client.on('userlist', function(event) {
        if (event.channel === that.name) {
            this.users = event.users;
        }
    });

    this.join(key);
};

IrcClient.Channel.prototype.relay = function(target_chan, opts) {
    opts = _.extend({
        one_way: false,    // Only relay messages to target_chan, not the reverse
        replay_nick: true  // Include the sending nick as part of the relayed message
    }, opts);
    
    if (typeof target_chan === 'string') {
        target_chan = this.irc_client.channel(target_chan);
    }
    var this_stream = this.stream(opts);
    var other_stream = target_chan.stream(opts);

    this_stream.pipe(other_stream);
    if (!opts.one_way) {
        other_stream.pipe(this_stream);
    }
};

IrcClient.Channel.prototype.stream = function(stream_opts) {
    var that = this;
    var read_queue = [];
    var is_reading = false;

    var stream = new DuplexStream({
        objectMode: true,

        write: function(chunk, encoding, next) {
            // Support piping from one irc buffer to another
            if (typeof chunk === 'object' && typeof chunk.msg === 'string') {
                if (stream_opts.replay_nicks) {
                    chunk = '<' + chunk.nick + '> ' + chunk.msg;
                } else {
                    chunk = chunk.msg;
                }
            }

            that.say(chunk.toString());
            next();
        },

        read: function() {
            var message;
            
            is_reading = true;

            while (read_queue.length > 0) {
                message = read_queue.shift();               
                if (this.push(message) === false) {
                    is_reading = false;
                    break;
                }
            }
        }
    });

    this.irc_client.on('privmsg', function(event) {
        if (event.target.toLowerCase() === that.name.toLowerCase()) {
            read_queue.push(event);
            
            if (is_reading) {
                stream._read();
            }
        }
    });

    return stream;
};

IrcClient.Channel.prototype.updateUsers = function(cb) {
    var that = this;
    this.irc_client.on('userlist', function updateUserList(event) {
        if (event.channel === that.name) {
            that.irc_client.removeListener('userlist', updateUserList);
            if (typeof cb === 'function') { cb(this); }
        }
    });
    this.irc_client.raw('NAMES', this.name);
};



/**
 * Truncate a string into blocks of a set size
 */
function truncateString(str, block_size) {
    block_size = block_size || 350;

    var blocks = [],
        current_pos;

    for (current_pos = 0; current_pos < str.length; current_pos = current_pos + block_size) {
        blocks.push(str.substr(current_pos, block_size));
    }

    return blocks;
}
