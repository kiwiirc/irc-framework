'use strict';

const _ = {
    extend: require('lodash/extend'),
    find: require('lodash/find'),
    each: require('lodash/each'),
    defer: require('lodash/defer'),
    bind: require('lodash/bind'),
};
const EventEmitter = require('eventemitter3');
const MiddlewareHandler = require('middleware-handler');
const IrcCommandHandler = require('./commands/').CommandHandler;
const IrcMessage = require('./ircmessage');
const Connection = require('./connection');
const NetworkInfo = require('./networkinfo');
const User = require('./user');
const Channel = require('./channel');
const { lineBreak } = require('./linebreak');
const MessageTags = require('./messagetags');

let default_transport = null;

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
        const defaults = {
            nick: 'ircbot',
            username: 'ircbot',
            gecos: 'ircbot',
            encoding: 'utf8',
            version: 'node.js irc-framework',
            enable_chghost: false,
            enable_setname: false,
            enable_echomessage: false,
            auto_reconnect: true,
            auto_reconnect_max_wait: 300000,
            auto_reconnect_max_retries: 3,
            ping_interval: 30,
            ping_timeout: 120,
            message_max_length: 350,
            sasl_disconnect_on_fail: false,
            transport: default_transport,
            websocket_protocol: 'text.ircv3.net'
        };

        const props = Object.keys(defaults);
        for (let i = 0; i < props.length; i++) {
            if (typeof user_options[props[i]] === 'undefined') {
                user_options[props[i]] = defaults[props[i]];
            }
        }

        return user_options;
    }

    createStructure() {
        const client = this;

        // Provides middleware hooks for either raw IRC commands or the easier to use parsed commands
        client.raw_middleware = new MiddlewareHandler();
        client.parsed_middleware = new MiddlewareHandler();

        client.connection = new Connection(client.options);
        client.network = new NetworkInfo();
        client.user = new User();

        client.command_handler = new IrcCommandHandler(client);

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
                const args = Array.prototype.slice.call(arguments);
                client.emit.apply(client, [event_name].concat(args));
            });
        });

        client.connection.on('socket connected', function() {
            client.emit('socket connected');
            client.registerToNetwork();
            client.startPingTimeoutTimer();
        });

        client.connection.on('connecting', function() {
            // Reset cap negotiation on a new connection
            // This prevents stale state if a connection gets closed during CAP negotiation
            client.network.cap.negotiating = false;
            client.network.cap.requested = [];
            client.network.cap.enabled = [];
            client.network.cap.available.clear();

            client.command_handler.resetCache();
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

        client.on('registered', function(event) {
            // PING is not a valid command until after registration
            client.startPeriodicPing();
        });

        client.on('away', function(event) {
            if (client.caseCompare(event.nick, client.user.nick)) {
                client.user.away = true;
            }
        });

        client.on('back', function(event) {
            if (client.caseCompare(event.nick, client.user.nick)) {
                client.user.away = false;
            }
        });

        // Proxy the command handler events onto the client object, with some added sugar
        client.proxyIrcEvents();

        const whox_token = {
            value: 0,
            requests: [],
            next: () => {
                if (whox_token.value >= 999) {
                    // whox token is limited to 3 characters
                    whox_token.value = 0;
                }
                const token = ++whox_token.value;
                whox_token.requests.push(token);
                return token;
            },
            validate: (token) => {
                const idx = whox_token.requests.indexOf(token);
                if (idx !== -1) {
                    whox_token.requests.splice(idx, 1);
                    return true;
                }
                return false;
            },
        };
        client.whox_token = whox_token;

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
        const client = this;

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
            client.debugOut('connect() called when already connected');
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
        const client = this;

        this.command_handler.on('all', function(event_name, event_arg) {
            client.resetPingTimeoutTimer();

            // Add a reply() function to selected message events
            if (['privmsg', 'notice', 'action'].indexOf(event_name) > -1) {
                event_arg.reply = function(message) {
                    const dest = event_arg.target === client.user.nick ?
                        event_arg.nick :
                        event_arg.target;

                    client.say(dest, message);
                };

                // These events with .reply() function are all messages. Emit it separately
                // TODO: Should this consider a notice a message?
                client.command_handler.emit('message', _.extend({ type: event_name }, event_arg));
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
        const client = this;
        const commands = this.command_handler;

        commands.on('nick', function(event) {
            if (client.user.nick === event.nick) {
                // nicks starting with numbers are reserved for uuids
                // we dont want to store these as they cannot be used
                if (event.new_nick.match(/^\d/)) {
                    return;
                }
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
            const thisUser = _.find(event.users, { nick: client.user.nick });
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
                client.user.host = event.hostname;
            }
        });

        // Don't let IRC ERROR command kill the node.js process if unhandled
        commands.on('error', function(event) {
        });
    }

    registerToNetwork() {
        const webirc = this.options.webirc;

        if (webirc) {
            let address = String(webirc.address);

            // Prepend a zero to addresses that begin with colon (like ::1)
            // as colon is using to denote last argument in IRC
            if (address[0] === ':') {
                address = '0' + address;
            }

            this.raw(
                'WEBIRC',
                webirc.password,
                webirc.username,
                webirc.hostname,
                address,
                MessageTags.encode(webirc.options || {}, ' ')
            );
        }

        this.raw('CAP LS 302');

        if (this.options.password) {
            this.raw('PASS', this.options.password);
        }

        this.raw('NICK', this.user.nick);
        this.raw('USER', this.options.username, 0, '*', this.user.gecos);
    }

    startPeriodicPing() {
        const client = this;
        let ping_timer = null;

        if (client.options.ping_interval <= 0) {
            return;
        }

        // Constantly ping the server for lag and time syncing functions
        function pingServer() {
            client.ping();
        }

        function resetPingTimer() {
            client.connection.clearTimeout(ping_timer);
            ping_timer = client.connection.setTimeout(pingServer, client.options.ping_interval * 1000);
        }

        // Browsers have started throttling looped timeout callbacks
        // using the pong event to set the next ping breaks this loop
        client.command_handler.on('pong', resetPingTimer);

        // Socket has disconnected, remove 'pong' listener until next 'registered' event
        client.connection.once('socket close', () => {
            client.command_handler.off('pong', resetPingTimer);
        });

        // Start timer
        resetPingTimer();
    }

    startPingTimeoutTimer() {
        const client = this;
        let timeout_timer = null;

        if (client.options.ping_timeout <= 0) {
            return;
        }

        // Data from the server was detected so restart the timeout
        function resetPingTimeoutTimer() {
            client.connection.clearTimeout(timeout_timer);
            timeout_timer = client.connection.setTimeout(pingTimeout, client.options.ping_timeout * 1000);
        }

        function pingTimeout() {
            client.debugOut('Ping timeout (' + client.options.ping_timeout + ' seconds)');
            client.emit('ping timeout');
            const end_msg = client.rawString('QUIT', 'Ping timeout (' + client.options.ping_timeout + ' seconds)');
            client.connection.end(end_msg, true);
        }

        this.resetPingTimeoutTimer = resetPingTimeoutTimer;
        this.resetPingTimeoutTimer();
    }

    // Gets overridden with a function in startPeriodicPing(). Only set here for completeness.
    resetPingTimeoutTimer() {}

    debugOut(out) {
        this.emit('debug', 'Client ' + out);
    }

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
        let args;

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
        this.raw('PING', message || Date.now().toString());
    }

    changeNick(nick) {
        this.raw('NICK', nick);
    }

    sendMessage(commandName, target, message, tags) {
        const lines = message
            .split(/\r\n|\n|\r/)
            .filter(i => i);

        lines.forEach(line => {
            // Maximum length of target + message we can send to the IRC server is 500 characters
            // but we need to leave extra room for the sender prefix so the entire message can
            // be sent from the IRCd to the target without being truncated.
            const blocks = [
                ...lineBreak(line, {
                    bytes: this.options.message_max_length,
                    allowBreakingWords: true,
                    allowBreakingGraphemes: true,
                })
            ];

            blocks.forEach(block => {
                if (tags && Object.keys(tags).length) {
                    const msg = new IrcMessage(commandName, target, block);
                    msg.tags = tags;
                    this.raw(msg);
                } else {
                    this.raw(commandName, target, block);
                }
            });
        });
    }

    say(target, message, tags) {
        return this.sendMessage('PRIVMSG', target, message, tags);
    }

    notice(target, message, tags) {
        return this.sendMessage('NOTICE', target, message, tags);
    }

    tagmsg(target, tags = {}) {
        const msg = new IrcMessage('TAGMSG', target);
        msg.tags = tags;
        this.raw(msg);
    }

    join(channel, key) {
        const raw = ['JOIN', channel];
        if (key) {
            raw.push(key);
        }
        this.raw(raw);
    }

    part(channel, message) {
        const raw = ['PART', channel];
        if (message) {
            raw.push(message);
        }
        this.raw(raw);
    }

    mode(channel, mode, extra_args) {
        let raw = ['MODE', channel, mode];

        if (extra_args) {
            if (Array.isArray(extra_args)) {
                raw = raw.concat(extra_args);
            } else {
                raw.push(extra_args);
            }
        }

        this.raw(raw);
    }

    inviteList(channel, cb) {
        const client = this;
        const invex = this.network.supports('INVEX');
        let mode = 'I';

        if (typeof invex === 'string' && invex) {
            mode = invex;
        }

        function onInviteList(event) {
            if (client.caseCompare(event.channel, channel)) {
                unbindEvents();
                if (typeof cb === 'function') {
                    cb(event);
                }
            }
        }

        function onInviteListErr(event) {
            if (event.error === 'chanop_privs_needed') {
                unbindEvents();
                if (typeof cb === 'function') {
                    cb(null);
                }
            }
        }

        function bindEvents() {
            client.on('inviteList', onInviteList);
            client.on('irc error', onInviteListErr);
        }

        function unbindEvents() {
            client.removeListener('inviteList', onInviteList);
            client.removeListener('irc error', onInviteListErr);
        }

        bindEvents();
        this.raw(['MODE', channel, mode]);
    }

    invite(channel, nick) {
        const raw = ['INVITE', nick, channel];
        this.raw(raw);
    }

    addInvite(channel, mask) {
        let mode = 'I';
        const invex = this.network.supports('INVEX');
        if (typeof invex === 'string') {
            mode = invex;
        }

        const raw = ['MODE', channel, '+' + mode, mask];
        this.raw(raw);
    }

    removeInvite(channel, mask) {
        let mode = 'I';
        const invex = this.network.supports('INVEX');
        if (typeof invex === 'string') {
            mode = invex;
        }

        const raw = ['MODE', channel, '-' + mode, mask];
        this.raw(raw);
    }

    banlist(channel, cb) {
        const client = this;
        const raw = ['MODE', channel, 'b'];

        this.on('banlist', function onBanlist(event) {
            if (client.caseCompare(event.channel, channel)) {
                client.removeListener('banlist', onBanlist);
                if (typeof cb === 'function') {
                    cb(event);
                }
            }
        });

        this.raw(raw);
    }

    ban(channel, mask) {
        const raw = ['MODE', channel, '+b', mask];
        this.raw(raw);
    }

    unban(channel, mask) {
        const raw = ['MODE', channel, '-b', mask];
        this.raw(raw);
    }

    setTopic(channel, newTopic) {
        if (!newTopic || !newTopic.trim()) {
            // If newTopic is undefined or empty, remove the existing topic
            // this check is to prevent unexpectedly requesting the current topic
            // when trying to clear the topic
            this.clearTopic(channel);
            return;
        }

        this.raw('TOPIC', channel, newTopic);
    }

    clearTopic(channel) {
        // The trailing `:` is required otherwise it would be requesting the topic
        // and not clearing it
        this.raw(`TOPIC ${channel} :`);
    }

    ctcpRequest(target, type /*, paramN */) {
        const params = Array.prototype.slice.call(arguments, 1);

        // make sure the CTCP type is uppercased
        params[0] = params[0].toUpperCase();

        this.raw(
            'PRIVMSG',
            target,
            String.fromCharCode(1) + params.join(' ') + String.fromCharCode(1)
        );
    }

    ctcpResponse(target, type /*, paramN */) {
        const params = Array.prototype.slice.call(arguments, 1);

        // make sure the CTCP type is uppercased
        params[0] = params[0].toUpperCase();

        this.raw(
            'NOTICE',
            target,
            String.fromCharCode(1) + params.join(' ') + String.fromCharCode(1)
        );
    }

    action(target, message) {
        const that = this;

        // Maximum length of target + message we can send to the IRC server is 500 characters
        // but we need to leave extra room for the sender prefix so the entire message can
        // be sent from the IRCd to the target without being truncated.

        // The block length here is the max, but without the non-content characters:
        // the command name, the space, and the two SOH chars

        const commandName = 'ACTION';
        const blockLength = this.options.message_max_length - (commandName.length + 3);
        const blocks = [...lineBreak(message, { bytes: blockLength, allowBreakingWords: true, allowBreakingGraphemes: true })];

        blocks.forEach(function(block) {
            that.ctcpRequest(target, commandName, block);
        });

        return blocks;
    }

    whois(target, _cb) {
        const client = this;
        let cb;
        const irc_args = ['WHOIS'];

        // Support whois(target, arg1, arg2, argN, cb)
        _.each(arguments, function(arg) {
            if (typeof arg === 'function') {
                cb = arg;
            } else {
                irc_args.push(arg);
            }
        });

        this.on('whois', function onWhois(event) {
            if (client.caseCompare(event.nick, target)) {
                client.removeListener('whois', onWhois);
                if (typeof cb === 'function') {
                    cb(event);
                }
            }
        });

        this.raw(irc_args);
    }

    whowas(target, _cb) {
        const client = this;
        let cb;
        const irc_args = ['WHOWAS'];

        // Support whowas(target, arg1, arg2, argN, cb)
        _.each(arguments, function(arg) {
            if (typeof arg === 'function') {
                cb = arg;
            } else {
                irc_args.push(arg);
            }
        });

        this.on('whowas', function onWhowas(event) {
            if (client.caseCompare(event.nick, target)) {
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

    monitorlist(cb) {
        const client = this;
        const raw = ['MONITOR', 'L'];

        this.on('monitorList', function onMonitorlist(event) {
            client.removeListener('monitorList', onMonitorlist);
            if (typeof cb === 'function') {
                cb(event);
            }
        });

        this.raw(raw);
    }

    addMonitor(target) {
        const raw = ['MONITOR', '+', target];

        this.raw(raw);
    }

    removeMonitor(target) {
        const raw = ['MONITOR', '-', target];

        this.raw(raw);
    }

    queryMonitor() {
        const raw = ['MONITOR', 'S'];

        this.raw(raw);
    }

    clearMonitor() {
        const raw = ['MONITOR', 'C'];

        this.raw(raw);
    }

    processNextWhoQueue() {
        const client = this;

        // No items in the queue or the queue is already running?
        if (client.who_queue.length === 0 || client.who_queue.is_running) {
            return;
        }

        client.who_queue.is_running = true;

        const this_who = client.who_queue.shift();
        const target = this_who[0];
        const cb = this_who[1];

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

        if (client.network.supports('whox')) {
            const token = client.whox_token.next();
            client.raw('WHO', target, `%tcuhsnfdaor,${token}`);
        } else {
            client.raw('WHO', target);
        }
    }

    /**
     * Explicitely start a channel list, avoiding potential issues with broken IRC servers not sending RPL_LISTSTART
     */
    list(/* paramN */) {
        const args = Array.prototype.slice.call(arguments);
        this.command_handler.cache('chanlist').channels = [];
        args.unshift('LIST');
        this.raw(args);
    }

    channel(channel_name, key) {
        return new Channel(this, channel_name, key);
    }

    match(match_regex, cb, message_type) {
        const client = this;

        const onMessage = function(event) {
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

    caseCompare(string1, string2) {
        const length = string1.length;

        if (length !== string2.length) {
            return false;
        }

        const upperBound = this._getCaseMappingUpperAsciiBound();

        for (let i = 0; i < length; i++) {
            let charCode1 = string1.charCodeAt(i);
            let charCode2 = string2.charCodeAt(i);

            if (charCode1 >= 65 && charCode1 <= upperBound) {
                charCode1 += 32;
            }

            if (charCode2 >= 65 && charCode2 <= upperBound) {
                charCode2 += 32;
            }

            if (charCode1 !== charCode2) {
                return false;
            }
        }

        return true;
    }

    caseLower(string) {
        const upperBound = this._getCaseMappingUpperAsciiBound();
        let result = '';

        for (let i = 0; i < string.length; i++) {
            const charCode = string.charCodeAt(i);

            // ASCII character from 'A' to upper bound defined above
            if (charCode >= 65 && charCode <= upperBound) {
                // All the relevant uppercase characters are exactly
                // 32 bytes apart from lowercase ones, so we simply add 32
                // and get the equivalent character in lower case
                result += String.fromCharCode(charCode + 32);
            } else {
                result += string[i];
            }
        }

        return result;
    }

    caseUpper(string) {
        const upperBound = this._getCaseMappingUpperAsciiBound() + 32;
        let result = '';

        for (let i = 0; i < string.length; i++) {
            const charCode = string.charCodeAt(i);

            // ASCII character from 'a' to upper bound defined above
            if (charCode >= 97 && charCode <= upperBound) {
                // All the relevant lowercase characters are exactly
                // 32 bytes apart from lowercase ones, so we simply subtract 32
                // and get the equivalent character in upper case
                result += String.fromCharCode(charCode - 32);
            } else {
                result += string[i];
            }
        }

        return result;
    }

    _getCaseMappingUpperAsciiBound() {
        if (this.network.options.CASEMAPPING === 'ascii') {
            return 90; // 'Z'
        } else if (this.network.options.CASEMAPPING === 'strict-rfc1459') {
            return 93; // ']'
        }

        return 94; // '^' - default casemapping=rfc1459
    }
};
