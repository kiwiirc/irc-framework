var EventEmitter = require('events').EventEmitter,
    util = require('util'),
    _ = require('lodash'),
    Commands = require('./commands'),
    Connection = require('./connection'),
    Server = require('./server'),
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
    this.command_handler = new Commands.Handler(this.connection);
    
    // Proxy some connection events onto this client
    ['reconnecting', 'close'].forEach(function(event_name) {
        client.connection.on(event_name, function() {
            client.emit.apply(client, arguments);
        });
    });

    this.proxyConnectionIrcEvents();

    this.connection.on('connected', function () {
        client.server = new Server();
        client.user = new User();

        client.addCommandHandlerListeners();

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
        if (['privmsg', 'notice', 'action', 'message'].indexOf(event_name) > -1) {
            event_args[1].reply = function(message) {
                var dest = event_args[1].target === client.connection.nick ?
                    event_args[1].nick :
                    event_args[1].target;

                client.say(dest, message);
            };
        }

        client.emit.apply(client, event_args);
    });
};


IrcClient.prototype.addCommandHandlerListeners = function() {
    var client = this;
    var commands = this.command_handler;

    commands.on('server options', function (event) {
        _.each(event.options, function (opt) {
            this.server.ISUPPORT.add(opt[0], opt[1]);
        });
    });

    commands.on('nick', function(event) {
        if (client.user.nick === event.nick) {
            client.user.nick = event.new_nick;
        }
    });

    commands.on('registered', function(event) {
        if (client.user.nick === event.nick) {
            client.user.nick = event.new_nick;
        }

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

    this.on(message_type || 'message', function onMessage(event) {
        if (event.msg.match(match_regex)) {
            cb(event);
        }
    });

    return {
        stop: function() {
            client.removeListener('privmsg', onMessage);
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