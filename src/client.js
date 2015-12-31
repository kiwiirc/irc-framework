var EventEmitter = require('events').EventEmitter;
var util = require('util');
var DuplexStream = require('stream').Duplex;
var IrcConnection = require('./connection').IrcConnection;
var _ = require('lodash');

module.exports = IrcClient;

function IrcClient(hostname, port, ssl, nick, options) {
	var that = this;

	EventEmitter.call(this);
	this.connection = new IrcConnection(hostname, port, ssl, nick, options);
	this.use(require('./commands/registration'));
	this.use(require('./commands/channel'));
	this.use(require('./commands/user'));
	this.use(require('./commands/messaging'));
	this.use(require('./commands/misc'));
	this.connection.on('all', function(event_name) {
		console.log('[IrcClient]', event_name);
		var event_args = arguments;

		// Add a reply() function to selected message events
		if (['privmsg', 'notice', 'action'].indexOf(event_name) > -1) {
			arguments[1].reply = function(message) {
				var dest = event_args[1].target === that.connection.nick ?
					event_args[1].nick :
					event_args[1].target;

				that.say(dest, message);
			};
		}

		that.emit.apply(that, arguments);
	});
}

util.inherits(IrcClient, EventEmitter);


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


IrcClient.prototype.connect = function() {
	this.connection.connect();
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

IrcClient.prototype.use = function() {
	return this.connection.irc_commands.use.apply(this.connection.irc_commands, [].slice.call(arguments));
};



IrcClient.Channel = function IrcChannel(irc_client, channel_name, key) {
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
		this.users = event.users;
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
