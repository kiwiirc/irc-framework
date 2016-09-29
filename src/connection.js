var net             = require('net');
var tls             = require('tls');
var util            = require('util');
var DuplexStream    = require('stream').Duplex;
var Socks           = require('socksjs');
var TerminatedStream = require('./terminatedstream');
var ircLineParser   = require('./irclineparser');
var forceUTF8       = require('./forceUTF8');
var iconv           = require('iconv-lite');
var _               = require('lodash');

function Connection(options) {
    DuplexStream.call(this, { readableObjectMode: true });

    this.options = options || {};

    this.connected = false;
    this.requested_disconnect = false;

    this.auto_reconnect = options.auto_reconnect || false;
    this.auto_reconnect_wait = options.auto_reconnect_wait || 4000;
    this.auto_reconnect_max_retries = options.auto_reconnect_max_retries || 3;
    this.reconnect_attempts = 0;

    // When an IRC connection was successfully registered.
    this.registered = false;

    this.read_buffer = [];
    this.reading_buffer = false;

    this.read_command_buffer = [];

    this.localAddress = this.options.localAddress;

    this._timers = [];
}

util.inherits(Connection, DuplexStream);

module.exports = Connection;

Connection.prototype.debugOut = function(out) {
    this.emit('debug', out);
};

Connection.prototype.registeredSuccessfully = function() {
    this.registered = Date.now();
};

Connection.prototype.connect = function() {
    var that = this;
    var socket_connect_event_name = 'connect';
    var options = this.options;
    var last_socket_error;
    var outgoing_addr = that.localAddress;
    var ircd_host = options.host;
    var ircd_port = options.port || 6667;

    this.debugOut('Connection.connect()');

    this.disposeSocket();
    this.requested_disconnect = false;

    if (!options.encoding || !this.setEncoding(options.encoding)) {
        this.setEncoding('utf8');
    }

    if (options.socks) {
        this.debugOut('Using SOCKS proxy');
        that.socket = Socks.connect({
            host: ircd_host,
            port: ircd_port,
            ssl: options.tls,
            rejectUnauthorized: options.rejectUnauthorized
        }, {
            host: options.socks.host,
            port: options.socks.port || 8080,
            user: options.socks.user,
            pass: options.socks.pass,
            localAddress: outgoing_addr
        });
    } else {
        if (options.tls || options.ssl) {
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

    // Called when the socket is connected and before any TLS handshaking if applicable.
    // This is when it's ideal to read socket pairs for identd.
    function rawSocketConnect() {
        that.debugOut('Raw socket connected');
        that.emit('raw socket connected', (that.socket.socket || that.socket));
    }

    // Called when the socket is connected and ready to start sending/receiving data.
    function socketFullyConnected() {
        that.debugOut('Socket fully connected');
        that.reconnect_attempts = 0;
        that.connected = true;
        last_socket_error = null;
        that.emit('socket connected');
    }

    that.socket.on('error', function socketErrorCb(err) {
        that.debugOut('Socket error ' + err.message);
        last_socket_error = err;
        that.emit('socket error', err);
    });

    // 1024 bytes is the maximum length of two RFC1459 IRC messages.
    // May need tweaking when IRCv3 message tags are more widespread
    that.socket.pipe(new TerminatedStream({max_buffer_size: 1024}))
        .on('data', (line) => {
            that.read_buffer.push(line);
            that.processReadBuffer();
        });

    that.socket.on('close', function socketCloseCb(had_error) {
        var was_connected = that.connected;
        var should_reconnect = false;
        var safely_registered = false;
        var registered_ms_ago = Date.now() - that.registered;

        // Some networks use aKills which kill a user after succesfully
        // registering instead of a ban, so we must wait some time after
        // being registered to be sure that we are connected properly.
        safely_registered = that.registered !== false && registered_ms_ago > 5000;

        that.debugOut('Socket closed. was_connected=' + was_connected + ' safely_registered=' + safely_registered + ' requested_disconnect='+that.requested_disconnect);

        that.connected = false;
        that.disposeSocket();
        that.clearTimers();

        that.emit('socket close', had_error);

        if (that.requested_disconnect || !that.auto_reconnect) {
            should_reconnect = false;

        // If trying to reconnect, continue with it
        } else if (that.reconnect_attempts && that.reconnect_attempts < that.auto_reconnect_max_retries) {
            should_reconnect = true;

        // If we were originally connected OK, reconnect
        } else if (was_connected && safely_registered) {
            should_reconnect = true;

        } else {
            should_reconnect = false;
        }

        if (should_reconnect) {
            that.reconnect_attempts++;
            that.emit('reconnecting', {
                attempt: that.reconnect_attempts,
                max_retries: that.auto_reconnect_max_retries,
                wait: that.auto_reconnect_wait
            });
        } else {
            that.emit('close', last_socket_error ? true : false);
            that.reconnect_attempts = 0;
        }

        if (should_reconnect) {
            that.debugOut('Scheduling reconnect');
            that.setTimeout(function() {
                that.connect();
            }, that.auto_reconnect_wait);
        }
    });
};

Connection.prototype._write = function(chunk, encoding, callback) {
    if (!this.connected || this.requested_disconnect) {
        return 0;
    }
    if(typeof this.write_encoding !== 'undefined'){
        var encoded_buffer = iconv.encode(chunk + '\r\n', this.write_encoding);
    } else {
        var encoded_buffer = iconv.encode(chunk + '\r\n', this.encoding);
    }
    return this.socket.write(encoded_buffer, callback);
};

Connection.prototype._read = function() {
    var message;
    var continue_pushing = true;

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
    this.debugOut('Connection.disposeSocket() connected=' + this.connected);

    if (this.socket && this.connected) {
        this.requested_disconnect = true;
        this.socket.destroy();
    }

    if (this.socket) {
        this.socket.removeAllListeners();
        this.socket = null;
    }
};

/**
 * Create and keep track of all timers so they can be easily removed
 */
Connection.prototype.setTimeout = function(/*fn, length, argN */) {
    var that = this;
    var tmr = null;
    var callback = arguments[0];
    
    arguments[0] = function() {
       _.pull(that._timers, tmr);
       callback.apply(null, arguments);
    };
    
    tmr = setTimeout.apply(null, arguments);
    this._timers.push(tmr);
    return tmr;
};

Connection.prototype.clearTimeout = function(tmr) {
	clearTimeout(tmr);
	_.pull(this._timers, tmr); 
};

Connection.prototype.clearTimers = function() {
    this._timers.forEach(function(tmr) {
        clearTimeout(tmr);
    });
    
    this._timers = [];
};

/**
 * Close the connection to the IRCd after forcing one last line
 */
Connection.prototype.end = function(data, callback) {
    var that = this;

    this.debugOut('Connection.end() connected=' + this.connected + ' with data=' + !!data);

    if (this.connected && data) {
        // Once the last bit of data has been sent, then re-run this function to close the socket
        this.write(data, function() {
            that.requested_disconnect = true;
            that.socket.end();
        });

        return;
    }

    this.disposeSocket();
};


/**
 * Set a new encoding for this connection
 * Return true in case of success
 */

Connection.prototype.setEncoding = function(encoding) {
    var encoded_test;

    this.debugOut('Connection.setEncoding() encoding=' + encoding);
    /* 
    format styles
    utf8 - reading and writing use same encoding
    utf8:auto - reading and writing use same encoding, reading autocorrects coding error
    iso-8859-1/utf8 - reading latin1 and writing utf8 encoding
    iso-8859-1:auto/write - reading latin1 and autocorrects, writes on utf8 encoding 
    */
    var types=encoding.split("/")
    var read_encoding=''
    var write_encoding=''
    var force_encoding=false
    if(types.length===2){
        read_encoding=types[0];
        write_encoding=types[1];
        encoding=read_encoding;
    }
    
    var auto=encoding.split(":")
    if(auto.length===2){
        read_encoding=auto[0]
        encoding=read_encoding
        if(auto[1].toUpperCase()==='AUTO'){
            this.force_encoding=true
        }
    }
    
    try {
        if(write_encoding.length){
            encoded_test = iconv.encode('TEST', write_encoding);
            // This test is done to check if this encoding also supports
            // the ASCII charset required by the IRC protocols
            // (Avoid the use of base64 or incompatible encodings)
            if (encoded_test == 'TEST') { // jshint ignore:line
                this.write_encoding = write_encoding;
            }
        }
        
        
        encoded_test = iconv.encode('TEST', encoding);
        // This test is done to check if this encoding also supports
        // the ASCII charset required by the IRC protocols
        // (Avoid the use of base64 or incompatible encodings)
        if (encoded_test == 'TEST') { // jshint ignore:line
            this.encoding = encoding;
            return true;
        }
        return false;
    } catch (err) {
        return false;
    }
};



/**
 * Process the messages recieved from the IRCd that are buffered on an IrcConnection object
 * Will only process 4 lines per JS tick so that node can handle any other events while
 * handling a large buffer
 */
Connection.prototype.processReadBuffer = function(continue_processing) {
    // If we already have the read buffer being iterated through, don't start
    // another one.
    if (this.reading_buffer && !continue_processing) {
        return;
    }

    var lines_per_js_tick = 4;
    var processed_lines = 0;
    var line;
    var message;

    this.reading_buffer = true;

    while (processed_lines < lines_per_js_tick && this.read_buffer.length > 0) {
        var data=this.read_buffer.shift()
        line = iconv.decode(data, this.encoding);
        if(this.force_encoding){
            line=forceUTF8(line);
        }
        if (!line) {
            continue;
        }

        message = ircLineParser(line);

        if (!message) {
            // A malformed IRC line
            continue;
        }
        this.emit('raw', line);

        this.pushCommandBuffer(message);

        processed_lines++;
    }

    // If we still have items left in our buffer then continue reading them in a few ticks
    if (this.read_buffer.length > 0) {
        this.setTimeout(processReadBuffer.bind(this), 1, true);
    } else {
        this.reading_buffer = false;
    }
}
