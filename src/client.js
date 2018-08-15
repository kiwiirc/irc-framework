'use strict';

var _ = {
    extend: require('lodash/extend'),
    find: require('lodash/find'),
    each: require('lodash/each'),
    defer: require('lodash/defer'),
    bind: require('lodash/bind'),
};
var EventEmitter = require('eventemitter3');
var runes = require('runes');
var MiddlewareHandler = require('middleware-handler');
var IrcCommandHandler = require('./commands/').CommandHandler;
var IrcMessage = require('./ircmessage');
var Connection = require('./connection');
var NetworkInfo = require('./networkinfo');
var User = require('./user');
var Channel = require('./channel');

var default_transport = null;

module.exports = class IrcClient extends EventEmitter {
    constructor(options) {
        super();

        this.request_extra_caps = [];
        this.options = options || null;

        this.createStructure();
    }

    static setDefaultTransport(transport) {
        default_transport = transport;
    }

    get Message() {
        return IrcMessage;
    }

    _applyDefaultOptions(user_options) {
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
            message_max_length: 350,
            transport: default_transport
        };

        var props = Object.keys(defaults);
        for (var i = 0; i < props.length; i++) {
            if (typeof user_options[props[i]] === 'undefined') {
                user_options[ props[ i ] ] = defaults[ props[ i ] ];
            }
        }

        return user_options;
    }


    createStructure() {
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

        Object.defineProperty(client, 'connected', {
            enumerable: true,
            get: function() {
                return client.connection && client.connection.connected;
            }
        });
    }


    requestCap(cap) {
        this.request_extra_caps = this.request_extra_caps.concat(cap);
    }


    use(middleware_fn) {
        middleware_fn(this, this.raw_middleware, this.parsed_middleware);
        return this;
    }


    connect(options) {
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
    }


    // Proxy the command handler events onto the client object, with some added sugar
    // Events are handled in order:
    // 1. Received from the command handler
    // 2. Checked if any extra properties/methods are to be added to the event + re-emitted
    // 3. Routed through middleware
    // 4. Emitted from the client instance
    proxyIrcEvents() {
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
                    console.error(err.stack);
                    return;
                }

                client.emit(event_name, event_arg);
            });
        });
    }


    addCommandHandlerListeners() {
        var client = this;
        var commands = this.command_handler;

        commands.on('nick', function(event) {
            if (client.user.nick === event.nick) {
                client.user.nick = event.new_nick;
            }
        });

        commands.on('mode', function(event) {
            if (client.user.nick === event.target) {
                event.modes.forEach(function(mode) {
                    client.user.toggleModes(mode.mode);
                });
            }
        });

        commands.on('wholist', function(event) {
            var thisUser = _.find(event.users, {nick: client.user.nick});
            if (thisUser) {
                client.user.username = thisUser.ident;
                client.user.host = thisUser.hostname;
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
    }


    registerToNetwork() {
        var webirc = this.options.webirc;

        if (webirc) {
            this.raw('WEBIRC', webirc.password, webirc.username, webirc.hostname, webirc.address);
        }

        this.raw('CAP LS 302');

        if (this.options.password) {
            this.raw('PASS', this.options.password);
        }

        this.raw('NICK', this.user.nick);
        this.raw('USER', this.options.username, 0, '*', this.user.gecos);
    }


    startPeriodicPing() {
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
    }


    // Gets overridden with a function in startPeriodicPing(). Only set here for completeness.
    resetPingTimer() {}




    /**
     * Client API
     */
    raw(input) {
        if (input instanceof IrcMessage) {
            this.connection.write(input.to1459());
        } else {
            this.connection.write(this.rawString.apply(this, arguments));
        }
    }


    rawString(input) {
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
    }


    quit(message) {
        this.connection.end(this.rawString('QUIT', message));
    }


    ping(message) {
        this.raw('PING', message || '*');
    }


    changeNick(nick) {
        this.raw('NICK', nick);
    }


    sendMessage(commandName, target, message) {
        var that = this;

        // Maximum length of target + message we can send to the IRC server is 500 characters
        // but we need to leave extra room for the sender prefix so the entire message can
        // be sent from the IRCd to the target without being truncated.
        var blocks = this.stringToBlocks(message, this.options.message_max_length);

        blocks.forEach(function(block) {
            that.raw(commandName, target, block);
        });

        return blocks;
    }


    say(target, message) {
        return this.sendMessage('PRIVMSG', target, message);
    }


    notice(target, message) {
        return this.sendMessage('NOTICE', target, message);
    }


    join(channel, key) {
        var raw = ['JOIN', channel];
        if (key) {
            raw.push(key);
        }
        this.raw(raw);
    }


    part(channel, message) {
        var raw = ['PART', channel];
        if (message) {
            raw.push(message);
        }
        this.raw(raw);
    }

    mode(channel, mode, extra_args) {
        var raw = ['MODE', channel, mode];

        if (extra_args) {
            raw.push(extra_args);
        }

        this.raw(raw);
    }

    inviteList(channel, cb) {
        var client = this;
        var raw = ['MODE', channel, 'I'];

        this.on('inviteList', function onInviteList(event) {
            if (event.channel.toLowerCase() === channel.toLowerCase()) {
                client.removeListener('inviteList', onInviteList);
                if (typeof cb === 'function') {
                    cb(event);
                }
            }
        });

        this.raw(raw);
    }

    invite(channel, nick) {
        var raw = ['INVITE', channel, nick]
        this.raw(raw);
    }

    addInvite(channel, mask) {
        var raw = ['MODE', channel, '+I', mask];
        this.raw(raw);
    }

    removeInvite(channel, mask) {
        var raw = ['MODE', channel, '-I', mask];
        this.raw(raw);
    }

    banlist(channel, cb) {
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
    }

    ban(channel, mask) {
        var raw = ['MODE', channel, '+b', mask];
        this.raw(raw);
    }

    unban(channel, mask) {
        var raw = ['MODE', channel, '-b', mask];
        this.raw(raw);
    }

    setTopic(channel, newTopic) {
        this.raw('TOPIC', channel, newTopic);
    }


    ctcpRequest(target, type /*, paramN*/) {
        var params = Array.prototype.slice.call(arguments, 1);

        // make sure the CTCP type is uppercased
        params[0] = params[0].toUpperCase();

        this.raw(
            'PRIVMSG',
            target,
            String.fromCharCode(1) + params.join(' ') + String.fromCharCode(1)
        );
    }


    ctcpResponse(target, type /*, paramN*/) {
        var params = Array.prototype.slice.call(arguments, 1);

        // make sure the CTCP type is uppercased
        params[0] = params[0].toUpperCase();

        this.raw(
            'NOTICE',
            target,
            String.fromCharCode(1) + params.join(' ') + String.fromCharCode(1)
        );
    }


    action(target, message) {
        var that = this;

        // Maximum length of target + message we can send to the IRC server is 500 characters
        // but we need to leave extra room for the sender prefix so the entire message can
        // be sent from the IRCd to the target without being truncated.

        // The block length here is the max, but without the non-content characters:
        // the command name, the space, and the two SOH chars

        var commandName = 'ACTION';
        var blockLength = this.options.message_max_length - (commandName.length + 3);
        var blocks = this.stringToBlocks(message, blockLength);

        blocks.forEach(function(block) {
            that.ctcpRequest(target, commandName, block);
        });

        return blocks;
    }


    whois(target, _cb) {
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
    }

    whowas(target, _cb) {
        var client = this;
        var cb;
        var irc_args = ['WHOWAS'];

        // Support whowas(target, arg1, arg2, argN, cb)
        _.each(arguments, function(arg) {
            if (typeof arg === 'function') {
                cb = arg;
            } else {
                irc_args.push(arg);
            }
        });

        this.on('whowas', function onWhowas(event) {
            if (event.nick.toLowerCase() === target.toLowerCase()) {
                client.removeListener('whowas', onWhowas);
                if (typeof cb === 'function') {
                    cb(event);
                }
            }
        });

        this.raw(irc_args);
    }

    /**
     * WHO requests are queued up to run serially.
     * This is mostly because networks will only reply serially and it makes
     * it easier to include the correct replies to callbacks
     */
    who(target, cb) {
        if (!this.who_queue) {
            this.who_queue = [];
        }
        this.who_queue.push([target, cb]);
        this.processNextWhoQueue();
    }


    processNextWhoQueue() {
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
    }


    /**
     * Explicitely start a channel list, avoiding potential issues with broken IRC servers not sending RPL_LISTSTART
     */
    list(/* paramN */) {
        var args = Array.prototype.slice.call(arguments);
        this.command_handler.cache('chanlist').channels = [];
        args.unshift('LIST');
        this.raw(args);
    }


    channel(channel_name) {
        return new Channel(this, channel_name);
    }


    match(match_regex, cb, message_type) {
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
    }


    matchNotice(match_regex, cb) {
        return this.match(match_regex, cb, 'notice');
    }
    matchMessage(match_regex, cb) {
        return this.match(match_regex, cb, 'privmsg');
    }
    matchAction(match_regex, cb) {
        return this.match(match_regex, cb, 'action');
    }
    
    /**
     * Truncate a string into blocks of a set size
     */
    stringToBlocks(str, block_size) {
        block_size = block_size || 350;

        // Quickly return if input string fits in a single block
        if (str.length <= block_size) {
            return [str];
        }

        var chars = runes(str);
        var blocks = [];
        var start_index = 0;
        var end_index = 0;
        var current_block_length = 0;
        var current_char_length = 0;

        do {
            do {
                current_char_length = chars[end_index].length;
                current_block_length += current_char_length;
                
                // If character does not fit in a single block, include it in current block anyway
                // and split it later on by falling back to simple substring
                if (current_char_length > block_size) {
                    end_index++;
                }
            }
            while (current_block_length <= block_size && ++end_index < chars.length);

            var block = chars.slice(start_index, end_index).join('');

            // Fallback to plain substring if we are unable to fit unicode characters in a single block
            if (block.length > block_size) {
                for (current_char_length = 0; current_char_length < block.length; current_char_length += block_size) {
                    blocks.push(block.substr(current_char_length, block_size));
                }
            } else {
                blocks.push(block);
            }

            start_index = end_index;
            current_block_length = 0;
        }
        while (end_index < chars.length);

        return blocks;
    }
};
