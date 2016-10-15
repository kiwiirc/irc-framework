var EventEmitter    = require('eventemitter3');
var _               = require('lodash');
var TransportNet    = require('./transports/net');
var ircLineParser   = require('./irclineparser');

function Connection(options) {
    EventEmitter.call(this);

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

    this.transport = null;

    this._timers = [];
}

_.extend(Connection.prototype, EventEmitter.prototype);

module.exports = Connection;

Connection.prototype.debugOut = function(out) {
    this.emit('debug', out);
};

Connection.prototype.registeredSuccessfully = function() {
    this.registered = Date.now();
};

Connection.prototype.connect = function(options) {
    var that = this;
    var transport;

    if (options) {
        this.options = options;
    }

    options = this.options;
    transport = this.transport = new TransportNet(options);

    if (!options.encoding || !this.setEncoding(options.encoding)) {
        this.setEncoding('utf8');
    }

    // Some transports may emit extra events
    transport.on('extra', function(/*event_name, argN*/) {
        that.emit.apply(that, arguments);
    });

    transport.on('open', socketOpen);
    transport.on('line', socketLine);
    transport.on('close', socketClose);

    transport.connect();

    // Called when the socket is connected and ready to start sending/receiving data.
    function socketOpen() {
        that.debugOut('Socket fully connected');
        that.reconnect_attempts = 0;
        that.connected = true;
        that.emit('socket connected');
    }

    function socketLine(line) {
        that.read_buffer.push(line);
        that.processReadBuffer();
    }

    function socketClose(err) {
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
        that.clearTimers();

        that.emit('socket close', err);

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
            that.emit('close', err ? true : false);
            that.reconnect_attempts = 0;
        }

        if (should_reconnect) {
            that.debugOut('Scheduling reconnect');
            that.setTimeout(function() {
                that.connect();
            }, that.auto_reconnect_wait);
        }
    }
};

Connection.prototype.write = function(data, callback) {
    if (!this.connected || this.requested_disconnect) {
        return 0;
    }

    return this.transport.writeLine(data, callback);
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
            that.end();
        });

        return;
    }

    if (this.transport) {
        this.transport.close();
    }
};


Connection.prototype.setEncoding = function(encoding) {
    this.debugOut('Connection.setEncoding() encoding=' + encoding);

    if (this.transport) {
        return this.transport.setEncoding(encoding);
    }
};


/**
 * Process the buffered messages recieved from the IRCd
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
        line = this.read_buffer.shift();
        if (!line) {
            continue;
        }

        message = ircLineParser(line);

        if (!message) {
            // A malformed IRC line
            continue;
        }
        this.emit('raw', line);
        this.emit('message', message);

        processed_lines++;
    }

    // If we still have items left in our buffer then continue reading them in a few ticks
    if (this.read_buffer.length > 0) {
        this.setTimeout(() => {
            this.processReadBuffer(true);
        }, 1);
    } else {
        this.reading_buffer = false;
    }
};
