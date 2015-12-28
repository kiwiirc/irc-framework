var EventEmitter = require('events').EventEmitter;
var IrcConnection = require('./connection').IrcConnection;
var partial = require('lodash.partial');

module.exports = IrcBot;

function IrcBot(hostname, port, ssl, nick, options) {
	var that = this;

	EventEmitter.call(this);
	this.connection = new IrcConnection(hostname, port, ssl, nick, options);
	this.connection.on('all', function(event_name) {
		console.log('[IrcBot]', event_name);
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
};

require('util').inherits(IrcBot, EventEmitter);


IrcBot.prototype.raw = function(input) {
	var args;

	if (input.constructor === Array) {
		args = input;
	} else {
		args = Array.prototype.slice.call(arguments, 0);
	}
	console.log('raw()', args);
	var to_send = '';
	if (args[args.length-1].indexOf(' ') > -1) {
		args[args.length-1] = ':' + args[args.length-1];
	}

	this.connection.write(args.join(' '));
};


IrcBot.prototype.connect = function() {
	this.connection.connect();
};


IrcBot.prototype.quit = function(message) {
	this.raw('QUIT', message);
};


IrcBot.prototype.changeNick = function(nick) {
	this.raw('NICK', nick);
};


IrcBot.prototype.say = function(target, message) {
	var that = this;

    // Maximum length of target + message we can send to the IRC server is 500 characters
    // but we need to leave extra room for the sender prefix so the entire message can
    // be sent from the IRCd to the target without being truncated.
    var blocks = truncateString(message, 350);

    blocks.forEach(function(block, idx) {
        that.raw('PRIVMSG', target, block);
    });
};


IrcBot.prototype.notice = function(target, message) {
	var that = this;

    // Maximum length of target + message we can send to the IRC server is 500 characters
    // but we need to leave extra room for the sender prefix so the entire message can
    // be sent from the IRCd to the target without being truncated.
    var blocks = truncateString(message, 350);

    blocks.forEach(function(block, idx) {
        that.raw('NOTICE', target, block);
    });
};


IrcBot.prototype.join = function(channel, key) {
	var raw = ['JOIN', channel];
	if (key) raw.push(key);
	this.raw(raw);
};


IrcBot.prototype.part = function(channel, message) {
	var raw = ['PART', channel];
	if (message) raw.push(message);
	this.raw(raw);
};


IrcBot.prototype.ctcpRequest = function(target, type /*, paramN*/) {
	var params = arguments.slice(2);
	this.raw('PRIVMSG', target, String.fromCharCode(1) + type.toUpperCase(), params.join(' ') + String.fromCharCode(1));
};


IrcBot.prototype.ctcpResponse = function(target, type /*, paramN*/) {
	var params = arguments.slice(2);
	this.raw('NOTICE', target, String.fromCharCode(1) + type.toUpperCase(), params.join(' ') + String.fromCharCode(1));
};


IrcBot.prototype.whois = function(target) {
	this.raw('WHOIS', target);
};


IrcBot.prototype.channel = function(channel_name) {
	return new IrcBot.Channel(this, channel_name);
};





IrcBot.Channel = function IrcChannel(irc_bot, channel_name, key) {
	this.irc_bot = irc_bot;
	this.name = channel_name;

	this.say = partial(irc_bot.say.bind(irc_bot), channel_name);
	this.notice = partial(irc_bot.notice.bind(irc_bot), channel_name);
	//this.action = partial(irc_bot.action.bind(irc_bot), channel_name);
	this.part = partial(irc_bot.part.bind(irc_bot), channel_name);
	this.join = partial(irc_bot.join.bind(irc_bot), channel_name);

	this.users = [];
	irc_bot.on('userlist', function(event) {
		this.users = event.users;
	});

	this.join(key);
};

IrcBot.Channel.prototype = {
	updateUsers: function(cb) {
		var that = this;
		this.irc_bot.on('userlist', function updateUserList(event) {
			if (event.channel === that.name) {
				that.irc_bot.removeListener('userlist', updateUserList);
				cb && cb(this);
			}
		});
		this.irc_bot.raw('NAMES', this.name);
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