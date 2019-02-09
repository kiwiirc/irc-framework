'use strict';

var _ = {
    pull: require('lodash/pull'),
};
var EventEmitter    = require('eventemitter3');
var ircLineParser   = require('./irclineparser');

module.exports = class Connection extends EventEmitter {
    constructor(options) {
        super();

        this.options = options || {};

        this.connected = false;
        this.requested_disconnect = false;

        this.reconnect_attempts = 0;

        // When an IRC connection was successfully registered.
        this.registered = false;

        this.read_buffer = [];
        this.reading_buffer = false;

        this.read_command_buffer = [];

        this.transport = null;

        this._timers = [];
    }

    debugOut(out) {
        this.emit('debug', out);
    }

    registeredSuccessfully() {
        this.registered = Date.now();
    }

    connect(options) {
        var that = this;
        var transport;

        if (options) {
            this.options = options;
        }
        options = this.options;

        this.auto_reconnect = options.auto_reconnect || false;
        this.auto_reconnect_wait = options.auto_reconnect_wait || 4000;
        this.auto_reconnect_max_retries = options.auto_reconnect_max_retries || 3;

        if (this.transport) {
            unbindTransportEvents(this.transport);
        }
        transport = this.transport = new options.transport(options);

        if (!options.encoding || !this.setEncoding(options.encoding)) {
            this.setEncoding('utf8');
        }

        // Some transports may emit extra events
        transport.on('extra', function(/*event_name, argN*/) {
            that.emit.apply(that, arguments);
        });

        bindTransportEvents(transport);

        this.registered = false;
        this.requested_disconnect = false;
        this.emit('connecting');
        transport.connect();

        function bindTransportEvents(transport) {
            transport.on('open', socketOpen);
            transport.on('line', socketLine);
            transport.on('close', socketClose);
            transport.on('debug', transportDebug);
        }

        function unbindTransportEvents(transport) {
            transport.removeListener('open', socketOpen);
            transport.removeListener('line', socketLine);
            transport.removeListener('close', socketClose);
            transport.removeListener('debug', transportDebug);
        }

        function transportDebug(out) {
            that.debugOut(out);
        }

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
                unbindTransportEvents(that.transport);
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
    }

    addReadBuffer(line) {
        this.read_buffer.push(line);
        this.processReadBuffer();
    }

    write(data, callback) {
        if (!this.connected || this.requested_disconnect) {
            return 0;
        }

        this.emit('raw', { line: data, from_server: false });
        return this.transport.writeLine(data, callback);
    }


    /**
     * Create and keep track of all timers so they can be easily removed
     */
    setTimeout(/*fn, length, argN */) {
        var that = this;
        var tmr = null;
        var args = Array.prototype.slice.call(arguments, 0);
        var callback = args[0];

        args[0] = function() {
           _.pull(that._timers, tmr);
           callback.apply(null, args);
        };

        tmr = setTimeout.apply(null, args);
        this._timers.push(tmr);
        return tmr;
    }

    clearTimeout(tmr) {
    	clearTimeout(tmr);
    	_.pull(this._timers, tmr);
    }

    clearTimers() {
        this._timers.forEach(function(tmr) {
            clearTimeout(tmr);
        });

        this._timers = [];
    }

    /**
     * Close the connection to the IRCd after forcing one last line
     */
    end(data, had_error) {
        var that = this;

        this.debugOut('Connection.end() connected=' + this.connected + ' with data=' + !!data + ' had_error=' + !!had_error);

        if (this.connected && data) {
            // Once the last bit of data has been sent, then re-run this function to close the socket
            this.write(data, function() {
                that.end(null, had_error);
            });

            return;
        }

        // Shutdowns of the connection may be caused by errors like ping timeouts, which
        // are not requested by the user so we leave requested_disconnect as false to make sure any
        // reconnects happen.
        if (!had_error) {
            this.requested_disconnect = true;
            this.clearTimers();
        }

        if (this.transport) {
            this.transport.close(!!had_error);
        }
    }


    setEncoding(encoding) {
        this.debugOut('Connection.setEncoding() encoding=' + encoding);

        if (this.transport) {
            return this.transport.setEncoding(encoding);
        }
    }


    /**
     * Process the buffered messages recieved from the IRCd
     * Will only process 4 lines per JS tick so that node can handle any other events while
     * handling a large buffer
     */
    processReadBuffer(continue_processing) {
        // If we already have the read buffer being iterated through, don't start
        // another one.
        if (this.reading_buffer && !continue_processing) {
            return;
        }

        var that = this;
        var lines_per_js_tick = 40;
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
            this.emit('raw', { line: line, from_server: true });
            this.emit('message', message, line);

            processed_lines++;
        }

        // If we still have items left in our buffer then continue reading them in a few ticks
        if (this.read_buffer.length > 0) {
            this.setTimeout(function() {
                that.processReadBuffer(true);
            }, 1);
        } else {
            this.reading_buffer = false;
        }
    }
};
