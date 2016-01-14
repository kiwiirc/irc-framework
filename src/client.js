var EventEmitter = require('events').EventEmitter,
    util = require('util'),
    _ = require('lodash'),
    DuplexStream = require('stream').Duplex,
    Commands = require('./commands'),
    Connection = require('./connection'),
    NetworkInfo = require('./networkinfo'),
    User = require('./user');

function IrcClient() {
    EventEmitter.call(this);
}

util.inherits(IrcClient, EventEmitter);

module.exports = IrcClient;

IrcClient.prototype.connect = function(options) {
    console.log('IrcClient.connect()');

    var client = this;

    this.options = options;
    if (this.connection && this.connection.connected) {
        this.connection.end();
    }

    this.connection = new Connection(options);
    this.network = new NetworkInfo();
    this.command_handler = new Commands.Handler(this.connection, this.network);
    this.user = new User({nick: options.nick});

    client.addCommandHandlerListeners();
    
    // Proxy some connection events onto this client
    ['reconnecting', 'close'].forEach(function(event_name) {
        client.connection.on(event_name, function() {
            client.emit.apply(client, arguments);
        });
    });

    this.proxyConnectionIrcEvents();

    this.connection.on('socket connected', function () {
        client.emit('socket connected');
        client.registerToNetwork();
    });

    this.connection.pipe(this.command_handler);
    this.connection.connect();
};


IrcClient.prototype.proxyConnectionIrcEvents = function() {
    var client = this;

    this.connection.on('all', function(event_name) {
        console.log(event_name, Array.prototype.slice.call(arguments, 1));
        var event_args = arguments;

        // Add a reply() function to selected message events
        if (['privmsg', 'notice', 'action'].indexOf(event_name) > -1) {
            event_args[1].reply = function(message) {
                var dest = event_args[1].target === client.user.nick ?
                    event_args[1].nick :
                    event_args[1].target;

                client.say(dest, message);
            };

            // These events with .reply() function are all messages
            // TODO: Should this consider a notice a message?
            client.emit('message', _.extend({type: event_name}, event_args[1]));
        }

        client.emit.apply(client, event_args);
    });
};


IrcClient.prototype.addCommandHandlerListeners = function() {
    var client = this;
    var connection = this.connection;

    connection.on('nick', function(event) {
        if (client.user.nick === event.nick) {
            client.user.nick = event.new_nick;
        }
    });

    connection.on('registered', function(event) {
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

    this.connection.write('NICK ' + this.options.nick);
    this.connection.write('USER ' + this.options.username + ' 0 * :' + this.options.gecos);
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
