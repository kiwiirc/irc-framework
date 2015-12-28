var net             = require('net'),
    tls             = require('tls'),
    util            = require('util'),
    dns             = require('dns'),
    _               = require('lodash'),
    Socks           = require('socksjs'),
    IrcCommands     = require('./commands'),
    ircLineParser   = require('./ircLineParser'),
    EventEmitter    = require('events').EventEmitter,
    iconv           = require('iconv-lite');
    //Proxy           = require('../proxy.js');


function log(what) {
    console.log.apply(console, arguments);
}

var next_connection_id = 1;
function generateConnectionId() {
    return next_connection_id++;
}

var IrcConnection = function (hostname, port, ssl, nick, options) {
    EventEmitter.call(this);
    this.setMaxListeners(0);

    this.options = options || {};

    // An ID to identify this connection instance
    this.id = generateConnectionId();

    // All setInterval/setTimeout values relating to this connection will be
    // added here. Keeps it easier to clearTimeout() them all during cleanup.
    this._timers = [];

    // Socket state
    this.connected = false;

    // If the connection closes and this is false, we reconnect
    this.requested_disconnect = false;

    // Number of times we have tried to reconnect
    this.reconnect_attempts = 0;

    // Last few lines from the IRCd for context when disconnected (server errors, etc)
    this.last_few_lines = [];

    // IRCd message buffers
    this.read_buffer = [];

    // In process of reading the IRCd messages?
    this.reading_buffer = false;

    // IRCd write buffers (flood controll)
    this.write_buffer = [];

    // In process of writing the buffer?
    this.writing_buffer = false;

    // Max number of lines to write a second
    this.write_buffer_lines_second = 2;

    // If we are in the CAP negotiation stage
    this.cap_negotiation = true;

    // User information
    this.nick = nick;
    this.username = options.username || 'ircbot';
    this.gecos = options.gecos || this.username; // Users real-name. Uses default from config if empty
    this.password = options.password || '';
    this.quit_message = options.quit_message || ''; // Uses default from config if empty

    // Set the passed encoding. or the default if none giving or it fails
    if (!options.encoding || !this.setEncoding(options.encoding)) {
        this.setEncoding('utf8');
    }

    // IRC protocol handling
    this.irc_commands = new IrcCommands.Handler(this);

    // IRC connection information
    this.irc_host = {hostname: hostname, port: port};
    this.ssl = !!ssl;

    // SOCKS proxy details
    // TODO: Wildcard matching of hostnames and/or CIDR ranges of IP addresses
    if (options.proxy && options.proxy.type === 'socks') {
        this.socks = {
            host: options.proxy.address,
            port: options.proxy.port,
            user: options.proxy.user,
            pass: options.proxy.pass
        };
    } else {
        this.socks = false;
    }

    // Kiwi proxy info may be set within a server module. {port: 7779, host: 'kiwi.proxy.com', ssl: false}
    this.proxy = false;

    // Net. interface this connection should be made through
    this.localAddress = options.localAddress;

    // Options sent by the IRCd
    this.ircd_options = Object.create(null);
    this.ircd_options.PREFIX = [
        {symbol: '~', mode: 'q'},
        {symbol: '&', mode: 'a'},
        {symbol: '@', mode: 'o'},
        {symbol: '%', mode: 'h'},
        {symbol: '+', mode: 'v'}
    ];

    this.cap = {requested: [], enabled: []};

    // Buffers for data sent from the IRCd
    this.hold_last = false;
    this.held_data = null;

    this.applyIrcEvents();
};
util.inherits(IrcConnection, EventEmitter);

module.exports.IrcConnection = IrcConnection;



/**
 * Create and keep track of all timers so they can be easily removed
 */
IrcConnection.prototype.setTimeout = function(fn, length /*, argN */) {
    var tmr = setTimeout.apply(null, arguments);
    this._timers.push(tmr);
    return tmr;
};

IrcConnection.prototype.clearTimers = function() {
    this._timers.forEach(function(tmr) {
        clearTimeout(tmr);
    });
};



IrcConnection.prototype.applyIrcEvents = function () {
    this.onServerConnect = this.onServerConnect || onServerConnect.bind(this);
    this.on('register', this.onServerConnect)

    this.onUserNick = this.onUserNick || onUserNick.bind(this);
    this.on('nick', this.onUserNick);
};


/**
 * Start the connection to the IRCd
 */
IrcConnection.prototype.connect = function () {
    var that = this;

    // The socket connect event to listener for
    var socket_connect_event_name = 'connect';

    // The destination address
    var dest_addr;
    if (this.socks) {
        dest_addr = this.socks.host;
    } else if (this.proxy) {
        dest_addr = this.proxy.host;
    } else {
        dest_addr = this.irc_host.hostname;
    }

    // Make sure we don't already have an open connection
    this.disposeSocket();

    this.requested_disconnect = false;

    // Get the IP family for the dest_addr (either socks or IRCd destination)
    getConnectionFamily(dest_addr, function getConnectionFamilyCb(err, family, host) {
        var outgoing = this.localAddress || '0.0.0.0';

        // Are we connecting through a SOCKS proxy?
        if (that.socks) {
            that.socket = Socks.connect({
                host: that.irc_host.host,
                port: that.irc_host.port,
                ssl: that.ssl,
                rejectUnauthorized: that.options.reject_unauthorised_certificates
            }, {host: host,
                port: that.socks.port,
                user: that.socks.user,
                pass: that.socks.pass,
                localAddress: outgoing
            });

        } else if (that.proxy) {
            that.socket = new Proxy.ProxySocket(that.proxy.port, host, {
                username: that.username,
                interface: that.proxy.interface
            }, {ssl: that.proxy.ssl});

            if (that.ssl) {
                that.socket.connectTls(that.irc_host.port, that.irc_host.hostname);
            } else {
                that.socket.connect(that.irc_host.port, that.irc_host.hostname);
            }

        } else {
            // No socks connection, connect directly to the IRCd

            log('(connection ' + that.id + ') Connecting directly to ' + host + ':' + (that.ssl?'+':'') + that.irc_host.port);

            if (that.ssl) {
                that.socket = tls.connect({
                    host: host,
                    port: that.irc_host.port,
                    rejectUnauthorized: that.options.reject_unauthorised_certificates,
                    localAddress: outgoing
                });

                // We need the raw socket connect event.
                // node.js 0.12 no longer has a .socket property.
                (that.socket.socket || that.socket).on('connect', function() {
                    rawSocketConnect.call(that, this);
                });

                socket_connect_event_name = 'secureConnect';

            } else {
                that.socket = net.connect({
                    host: host,
                    port: that.irc_host.port,
                    localAddress: outgoing
                });
            }
        }

        // Apply the socket listeners
        that.socket.on(socket_connect_event_name, function socketConnectCb() {

            // TLS connections have the actual socket as a property
            var is_tls = (typeof this.socket !== 'undefined') ?
                true :
                false;

            // TLS sockets have already called this
            if (!is_tls) {
                rawSocketConnect.call(that, this);
            }

            log('(connection ' + that.id + ') Socket connected');
            that.connected = true;

            socketConnectHandler.call(that);
        });

        that.socket.on('error', function socketErrorCb(event) {
            that.emit('socket error', event);
        });

        that.socket.on('data', function () {
            socketOnData.apply(that, arguments);
        });

        that.socket.on('close', function socketCloseCb(had_error) {
            // If that.connected is false, we never actually managed to connect
            var was_connected = that.connected,
                safely_registered = (new Date()) - that.server.registered > 10000, // Safely = registered + 10secs after.
                should_reconnect = false;

            log('(connection ' + that.id + ') Socket closed');
            that.connected = false;
            that.server.reset();

            // Remove this socket form the identd lookup
            if (that.identd_port_pair) {
                // TODO: Delete this from the identd somewhere
            }

            // Close the whole socket down
            that.disposeSocket();

            if (!that.ircd_reconnect) {
                that.emit('close', had_error);

            } else {
                // If trying to reconnect, continue with it
                if (that.reconnect_attempts && that.reconnect_attempts < 3) {
                    should_reconnect = true;

                // If this was an unplanned disconnect and we were originally connected OK, reconnect
                } else if (!that.requested_disconnect  && was_connected && safely_registered) {
                    should_reconnect = true;

                } else {
                    should_reconnect = false;
                }

                if (should_reconnect) {
                    log('(connection ' + that.id + ') Socket reconnecting');
                    that.reconnect_attempts++;
                    that.emit('reconnecting');
                } else {
                    that.emit('close', had_error);
                    that.reconnect_attempts = 0;
                }

                // If this socket closing was not expected and we did actually connect and
                // we did previously completely register on the network, then reconnect
                if (should_reconnect) {
                    that.setTimeout(function() {
                        that.connect();
                    }, 4000);
                }
            }
        });
    });
};

/**
 * Send an event to the client
 */
IrcConnection.prototype.clientEvent = function (event_name, data, callback) {
    this.emit('client_event', event_name, data);
};

/**
 * Write a line of data to the IRCd
 * @param data The line of data to be sent
 * @param force Write the data now, ignoring any write queue
 */
IrcConnection.prototype.write = function (data, force, force_complete_fn) {
    //ENCODE string to encoding of the server
    var encoded_buffer = iconv.encode(data + '\r\n', this.encoding);

    if (force) {
        this.socket && this.socket.write(encoded_buffer, force_complete_fn);
        log('(connection ' + this.id + ') Raw C:', data);
        return;
    }

    log('(connection ' + this.id + ') Raw C:', data);
    this.write_buffer.push(encoded_buffer);

    // Only flush if we're not writing already
    if (!this.writing_buffer) {
        this.flushWriteBuffer();
    }
};



/**
 * Flush the write buffer to the server in a throttled fashion
 */
IrcConnection.prototype.flushWriteBuffer = function () {

    // In case the socket closed between writing our queue.. clean up
    if (!this.connected) {
        this.write_buffer = [];
        this.writing_buffer = false;
        return;
    }

    this.writing_buffer = true;

    // Disabled write buffer? Send everything we have
    if (!this.write_buffer_lines_second) {
        this.write_buffer.forEach(function(buffer) {
            this.socket && this.socket.write(buffer);
            this.write_buffer = null;
        });

        this.write_buffer = [];
        this.writing_buffer = false;

        return;
    }

    // Nothing to write? Stop writing and leave
    if (this.write_buffer.length === 0) {
        this.writing_buffer = false;
        return;
    }

    this.socket && this.socket.write(this.write_buffer[0]);
    this.write_buffer = this.write_buffer.slice(1);

    // Call this function again at some point if we still have data to write
    if (this.write_buffer.length > 0) {
        that.setTimeout(this.flushWriteBuffer.bind(this), 1000 / this.write_buffer_lines_second);
    } else {
        // No more buffers to write.. so we've finished
        this.writing_buffer = false;
    }
};



/**
 * Close the connection to the IRCd after forcing one last line
 */
IrcConnection.prototype.end = function (data) {
    var that = this;

    if (!this.socket) {
        return;
    }

    this.requested_disconnect = true;

    if (this.connected && data) {
        // Once the last bit of data has been sent, then re-run this function to close the socket
        this.write(data, true, function() {
            that.end();
        });

        return;
    }

    this.socket.destroy();
};



/**
 * Check if any server capabilities are enabled
 */
IrcConnection.prototype.capContainsAny = function (caps) {
    var enabled_caps;

    if (!caps instanceof Array) {
        caps = [caps];
    }

    enabled_caps = _.intersection(this.cap.enabled, caps);
    return enabled_caps.length > 0;
};



/**
 * Clean up this IrcConnection instance and any sockets
 */
IrcConnection.prototype.dispose = function () {
    // If we're still connected, wait until the socket is closed before disposing
    // so that all the events are still correctly triggered
    if (this.socket && this.connected) {
        this.end();
        return;
    }

    if (this.socket) {
        this.disposeSocket();
    }

    this.server.dispose();
    this.server = undefined;

    this.irc_commands = undefined;

    this.clearTimers();
    this.removeAllListeners();
};



/**
 * Clean up any sockets for this IrcConnection
 */
IrcConnection.prototype.disposeSocket = function () {
    if (this.socket) {
        this.socket.end();
        this.socket.removeAllListeners();
        this.socket = null;
    }
};

/**
 * Set a new encoding for this connection
 * Return true in case of success
 */

IrcConnection.prototype.setEncoding = function (encoding) {
    var encoded_test;

    try {
        encoded_test = iconv.encode("TEST", encoding);
        //This test is done to check if this encoding also supports
        //the ASCII charset required by the IRC protocols
        //(Avoid the use of base64 or incompatible encodings)
        if (encoded_test == "TEST") { // jshint ignore:line
            this.encoding = encoding;
            return true;
        }
        return false;
    } catch (err) {
        return false;
    }
};

function getConnectionFamily(host, callback) {
    if (net.isIP(host)) {
        if (net.isIPv4(host)) {
            callback(null, 'IPv4', host);
        } else {
            callback(null, 'IPv6', host);
        }
    } else {
        dns.resolve4(host, function resolve4Cb(err, addresses) {
            if (!err) {
                callback(null, 'IPv4', addresses[0]);
            } else {
                dns.resolve6(host, function resolve6Cb(err, addresses) {
                    if (!err) {
                        callback(null, 'IPv6',addresses[0]);
                    } else {
                        callback(err);
                    }
                });
            }
        });
    }
}



function onServerConnect(event) {
    this.nick = event.nick;
}


function onUserNick(event) {
    // Only deal with messages targetted to us
    if (event.nick !== this.nick) {
        return;
    }

    this.nick = event.newnick;
}




/**
 * When a socket connects to an IRCd
 * May be called before any socket handshake are complete (eg. TLS)
 */
var rawSocketConnect = function(socket) {
    // Make note of the port numbers for any identd lookups
    // Nodejs < 0.9.6 has no socket.localPort so check this first
    if (typeof socket.localPort !== 'undefined') {
        this.identd_port_pair = socket.localPort.toString() + '_' + socket.remotePort.toString();
        // TODO: Add this tot he identd somewhere
    }
};


/**
 * Handle the socket connect event, starting the IRCd registration
 */
var socketConnectHandler = function () {
    var webirc = this.options.webirc;

    if (webirc) {
        this.write('WEBIRC ' + webirc.password + ' kiwiIRC ' + webirc.hostname + ' ' + webirc.address);
    }

    this.write('CAP LS');

    if (this.password) {
        this.write('PASS ' + this.password);
    }

    this.write('NICK ' + this.nick);
    this.write('USER ' + this.username + ' 0 0 :' + this.gecos);

    this.emit('connected');
};





/**
 * Buffer any data we get from the IRCd until we have complete lines.
 */
function socketOnData(data) {
    var data_pos,               // Current position within the data Buffer
        line_start = 0,
        lines = [],
        i,
        max_buffer_size = 1024; // 1024 bytes is the maximum length of two RFC1459 IRC messages.
                                // May need tweaking when IRCv3 message tags are more widespread

    // Split data chunk into individual lines
    for (data_pos = 0; data_pos < data.length; data_pos++) {
        if (data[data_pos] === 0x0A) { // Check if byte is a line feed
            lines.push(data.slice(line_start, data_pos));
            line_start = data_pos + 1;
        }
    }

    // No complete lines of data? Check to see if buffering the data would exceed the max buffer size
    if (!lines[0]) {
        if ((this.held_data ? this.held_data.length : 0 ) + data.length > max_buffer_size) {
            // Buffering this data would exeed our max buffer size
            this.emit('error', 'Message buffer too large');
            this.socket.destroy();

        } else {

            // Append the incomplete line to our held_data and wait for more
            if (this.held_data) {
                this.held_data = Buffer.concat([this.held_data, data], this.held_data.length + data.length);
            } else {
                this.held_data = data;
            }
        }

        // No complete lines to process..
        return;
    }

    // If we have an incomplete line held from the previous chunk of data
    // merge it with the first line from this chunk of data
    if (this.hold_last && this.held_data !== null) {
        lines[0] = Buffer.concat([this.held_data, lines[0]], this.held_data.length + lines[0].length);
        this.hold_last = false;
        this.held_data = null;
    }

    // If the last line of data in this chunk is not complete, hold it so
    // it can be merged with the first line from the next chunk
    if (line_start < data_pos) {
        if ((data.length - line_start) > max_buffer_size) {
            // Buffering this data would exeed our max buffer size
            this.emit('error', 'Message buffer too large');
            this.socket.destroy();
            return;
        }

        this.hold_last = true;
        this.held_data = new Buffer(data.length - line_start);
        data.copy(this.held_data, 0, line_start);
    }

    this.read_buffer = this.read_buffer.concat(lines);
    processIrcLines(this);
}



function ip2Hex(ip) {
    // We can only deal with IPv4 addresses for now
    if (!ip.match(/^[0-9]{0,3}\.[0-9]{0,3}\.[0-9]{0,3}\.[0-9]{0,3}$/)) {
        return;
    }

    var hexed = ip.split('.').map(function ipSplitMapCb(i){
        var hex = parseInt(i, 10).toString(16);

        // Pad out the hex value if it's a single char
        if (hex.length === 1) {
            hex = '0' + hex;
        }

        return hex;
    }).join('');

    return hexed;
}



/**
 * Process the messages recieved from the IRCd that are buffered on an IrcConnection object
 * Will only process 4 lines per JS tick so that node can handle any other events while
 * handling a large buffer
 */
function processIrcLines(irc_con, continue_processing) {
    if (irc_con.reading_buffer && !continue_processing) return;
    irc_con.reading_buffer = true;

    var lines_per_js_tick = 4,
        processed_lines = 0,
        line, message;

    while(processed_lines < lines_per_js_tick && irc_con.read_buffer.length > 0) {
        line = iconv.decode(irc_con.read_buffer.shift(), irc_con.encoding);
        if (!line) continue;

        log('(connection ' + irc_con.id + ') Raw S:', line.replace(/^\r+|\r+$/, ''));

        message = ircLineParser(line);
        irc_con.irc_commands.dispatch(new IrcCommands.Command(message.command.toUpperCase(), message));
        processed_lines++;
    }

    if (irc_con.read_buffer.length > 0) {
        irc_con.setTimeout(processIrcLines, 1, irc_con, true);
    } else {
        irc_con.reading_buffer = false;
    }
}




