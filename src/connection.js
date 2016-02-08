var net             = require('net'),
    tls             = require('tls'),
    util            = require('util'),
    DuplexStream    = require('stream').Duplex,
    Socks           = require('socksjs'),
    ircLineParser   = require('./irclineparser'),
    getConnectionFamily = require('./getconnectionfamily'),
    iconv           = require('iconv-lite');

function Connection(options) {
    DuplexStream.call(this, { readableObjectMode : true });

    this.options = options || {};

    this.connected = false;
    this.requested_disconnect = false;
    this.reconnect_attempts = 0;

    this.read_buffer = [];
    this.reading_buffer = false;

    this.read_command_buffer = [];

    this.localAddress = this.options.localAddress;

    // Buffers for data sent from the IRCd
    this.hold_last = false;
    this.held_data = null;

    this._timers = [];
}

util.inherits(Connection, DuplexStream);

module.exports = Connection;

Connection.prototype.connect = function() {
    var socket_connect_event_name = 'connect',
        that = this,
        options = this.options,
        dest_addr;

    if (options.socks) {
        dest_addr = this.socks.host;
    } else {
        dest_addr = options.host;
    }

    this.disposeSocket();

    this.requested_disconnect = false;

    if (!this.options.encoding || !this.setEncoding(this.options.encoding)) {
        this.setEncoding('utf8');
    }

    getConnectionFamily(dest_addr, function getConnectionFamilyCb(err, family, host) {
        var outgoing_addr = this.localAddress || '0.0.0.0';
        var ircd_host = host;
        var ircd_port = options.port || 6667;

        if (options.socks) {
            console.log('Connecting via socks to ' + options.host + ':' + ircd_port);
            that.socket = Socks.connect({
                host: options.host,
                port: ircd_port,
                ssl: options.tls,
                rejectUnauthorized: options.rejectUnauthorized
            }, {
                host: host,
                port: options.socks.port || 8080,
                user: options.socks.user,
                pass: options.socks.pass,
                localAddress: outgoing_addr
            });
        } else {
            console.log('Connecting directly to ' + ircd_host + ':' + ircd_port);
            if (options.tls) {
                that.socket = tls.connect({
                    host: ircd_host,
                    port: ircd_port,
                    rejectUnauthorized: options.rejectUnauthorized,
                    localAddress: outgoing_addr
                });

                socket_connect_event_name = 'secureConnect';

            } else {
                that.socket = net.connect({
                    host: ircd_host,
                    port: ircd_port,
                    localAddress: outgoing_addr
                });

                socket_connect_event_name = 'connect';
            }
        }

        // We need the raw socket connect event.
        // node.js 0.12 no longer has a .socket property.
        (that.socket.socket || that.socket).on('connect', rawSocketConnect);
        that.socket.on(socket_connect_event_name, socketFullyConnected);

        function rawSocketConnect() {
            // TLS connections have the actual socket as a property
            var is_tls = (typeof this.socket !== 'undefined');

            // TODO: This is where it's safe to read socket pairs for identd
        }

        function socketFullyConnected() {
            that.connected = true;
            that.emit('socket connected');
        }

        that.socket.on('error', function socketErrorCb(event) {
            that.emit('socket error', event);
        });

        that.socket.on('readable', function socketReadableCb() {
            var data;

            while (data !== null) {
                data = that.socket.read();
                if (data !== null) {
                    socketOnData.call(that, data);
                }
            }
        });

        that.socket.on('close', function socketCloseCb(had_error) {
            var was_connected = that.connected,
                should_reconnect = false;
                that.connected = false;

                that.disposeSocket();

                if (!that.ircd_reconnect) {
                    that.emit('close', had_error);
                } else {
                    if (that.reconnect_attempts && that.reconnect_attempts < 3) {
                        should_reconnect = true;
                    } else if (!that.requested_disconnect && was_connected) {
                        should_reconnect = true;
                    }

                    if (should_reconnect) {
                        that.reconnect_attempts += 1;
                        that.emit('reconnecting');
                    } else {
                        that.emit('close', had_error);
                        that.reconnect_attempts = 0;
                    }

                    if (should_reconnect) {
                        that.setTimeout(function () {
                            that.connect(options);
                        }, 4000);
                    }
                }
        });

    });
};

Connection.prototype._write = function(chunk, encoding, callback) {
    var encoded_buffer = iconv.encode(chunk + '\r\n', this.encoding);
    console.log('Raw C:', chunk.toString());
    return this.socket.write(encoded_buffer, callback);
};

Connection.prototype._read = function() {
    var message,
        continue_pushing = true;

    this._reading = true;

    while (continue_pushing && this.read_command_buffer.length > 0) {
        message = this.read_command_buffer.shift();
        continue_pushing = this.push(message);
        if (!continue_pushing) {
            this._reading = false;
        }
    }
};

Connection.prototype.pushCommandBuffer = function(command) {
    this.read_command_buffer.push(command);
    if (this._reading) {
        this._read();
    }
};

Connection.prototype.disposeSocket = function() {
    // If we're still connected, wait until the socket is closed before disposing
    // so that all the events are still correctly triggered
    if (this.socket && this.connected) {
        this.end();
        return;
    }

    this.clearTimers();
};

/**
 * Create and keep track of all timers so they can be easily removed
 */
Connection.prototype.setTimeout = function(/*fn, length, argN */) {
    var tmr = setTimeout.apply(null, arguments);
    this._timers.push(tmr);
    return tmr;
};

Connection.prototype.clearTimers = function() {
    this._timers.forEach(function(tmr) {
        clearTimeout(tmr);
    });
};

/**
 * Close the connection to the IRCd after forcing one last line
 */
Connection.prototype.end = function (data, callback) {
    var that = this;

    this.requested_disconnect = true;

    if (this.connected && data) {
        // Once the last bit of data has been sent, then re-run this function to close the socket
        this.write(data, function() {
            that.end();
        });

        return;
    }

    DuplexStream.prototype.end.call(this, callback);

    if (this.socket) {
        this.socket.destroy();
        this.socket = null;
    }
};


/**
 * Clean up this IrcConnection instance and any sockets
 */
Connection.prototype.dispose = function () {
    // If we're still connected, wait until the socket is closed before disposing
    // so that all the events are still correctly triggered
    if (this.socket && this.connected) {
        this.end();
        return;
    }

    if (this.socket) {
        this.disposeSocket();
    }

    this.clearTimers();
};

/**
 * Set a new encoding for this connection
 * Return true in case of success
 */

Connection.prototype.setEncoding = function (encoding) {
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


/**
 * Buffer any data we get from the IRCd until we have complete lines.
 */
function socketOnData(data) {
    var data_pos,               // Current position within the data Buffer
        line_start = 0,
        lines = [],
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

/**
 * Process the messages recieved from the IRCd that are buffered on an IrcConnection object
 * Will only process 4 lines per JS tick so that node can handle any other events while
 * handling a large buffer
 */
function processIrcLines(irc_con, continue_processing) {
    if (irc_con.reading_buffer && !continue_processing) {
        return;
    }

    irc_con.reading_buffer = true;

    var lines_per_js_tick = 4,
        processed_lines = 0,
        line, message;

    while(processed_lines < lines_per_js_tick && irc_con.read_buffer.length > 0) {
        line = iconv.decode(irc_con.read_buffer.shift(), irc_con.encoding);
        if (!line) {
            continue;
        }

        console.log('Raw S:', line.replace(/^\r+|\r+$/, ''));

        message = ircLineParser(line);

        if (!message) {
            // A malformed IRC line
            continue;
        }

        irc_con.pushCommandBuffer(message);

        processed_lines++;
    }

    if (irc_con.read_buffer.length > 0) {
        irc_con.setTimeout(processIrcLines, 1, irc_con, true);
    } else {
        irc_con.reading_buffer = false;
    }
}
