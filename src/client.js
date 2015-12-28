var EventEmitter = require('events').EventEmitter;
var IrcConnection = require('./connection').IrcConnection;
var _ = require('lodash');

module.exports = IrcClient;

function IrcClient(hostname, port, ssl, nick, options) {
	var that = this;

	EventEmitter.call(this);
	this.connection = new IrcConnection(hostname, port, ssl, nick, options);
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

require('util').inherits(IrcClient, EventEmitter);


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





IrcClient.Channel = function IrcChannel(irc_client, channel_name, key) {
	this.irc_client = irc_client;
	this.name = channel_name;

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

IrcClient.Channel.prototype = {
	updateUsers: function(cb) {
		var that = this;
		this.irc_client.on('userlist', function updateUserList(event) {
			if (event.channel === that.name) {
				that.irc_client.removeListener('userlist', updateUserList);
				if (typeof cb === 'function') { cb(this); }
			}
		});
		this.irc_client.raw('NAMES', this.name);
	}
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
