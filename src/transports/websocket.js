'use strict';

/**
 * Websocket transport
 */

const EventEmitter = require('eventemitter3');

module.exports = class Connection extends EventEmitter {
    constructor(options) {
        super();

        this.options = options || {};

        this.socket = null;
        this.connected = false;
        this.last_socket_error = null;

        this.encoding = 'utf8';
        this.incoming_buffer = '';
    }

    isConnected() {
        return this.connected;
    }

    writeLine(line, cb) {
        this.debugOut('writeLine() socket=' + (this.socket ? 'yes' : 'no') + ' connected=' + this.connected);

        if (this.socket && this.connected) {
            this.socket.send(line);
        }

        // Websocket.send() does not support callbacks
        // call the callback in the next tick instead
        if (cb) {
            setTimeout(cb, 0);
        }
    }

    debugOut(out) {
        this.emit('debug', out);
    }

    connect() {
        const that = this;
        const options = this.options;
        let socket = null;
        let ws_addr = '';

        this.debugOut('Connection.connect()');

        this.disposeSocket();
        this.requested_disconnect = false;

        // Build the websocket address. eg. ws://ws.rizon.net:8080
        ws_addr += (options.tls || options.ssl) ? 'wss://' : 'ws://';
        ws_addr += options.host;
        ws_addr += options.port ? ':' + options.port : '';
        ws_addr += options.path ? options.path : '';

        socket = this.socket = new WebSocket(ws_addr);

        socket.onopen = function() {
            that.onSocketFullyConnected();
        };
        socket.onclose = function() {
            that.onSocketClose();
        };
        socket.onmessage = function(event) {
            that.onSocketMessage(event.data);
        };
        socket.onerror = function(err) {
            that.debugOut('socketError() ' + err.message);
            that.last_socket_error = err;
        };
    }

    // Called when the socket is connected and ready to start sending/receiving data.
    onSocketFullyConnected() {
        this.debugOut('socketFullyConnected()');
        this.last_socket_error = null;
        this.connected = true;
        this.emit('open');
    }

    onSocketClose() {
        this.debugOut('socketClose()');
        this.connected = false;
        this.emit('close', this.last_socket_error ? this.last_socket_error : false);
    }

    onSocketMessage(data) {
        this.debugOut('socketData() ' + JSON.stringify(data));

        const that = this;
        let lines = null;

        this.incoming_buffer += data + '\n';

        lines = this.incoming_buffer.split('\n');
        if (lines[lines.length - 1] !== '') {
            this.incoming_buffer = lines.pop();
        } else {
            lines.pop();
            this.incoming_buffer = '';
        }

        lines.forEach(function(line) {
            that.emit('line', line);
        });
    }

    disposeSocket() {
        this.debugOut('Connection.disposeSocket() connected=' + this.connected);

        if (this.socket && this.connected) {
            this.socket.close();
        }

        if (this.socket) {
            this.socket.onopen = null;
            this.socket.onclose = null;
            this.socket.onmessage = null;
            this.socket.onerror = null;
            this.socket = null;
        }
    }

    close() {
        if (this.socket && this.connected) {
            this.socket.close();
        }
    }

    setEncoding(encoding) {
    }
};
