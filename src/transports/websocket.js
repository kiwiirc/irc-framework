/**
 * Websocket transport
 */

var EventEmitter = require('eventemitter3');
var _ = require('lodash');

function Connection(options) {
    EventEmitter.call(this);

    this.options = options || {};

    this.socket = null;
    this.connected = false;
    this.last_socket_error = null;

    this.encoding = 'utf8';
    this.incoming_buffer = '';
}

_.extend(Connection.prototype, EventEmitter.prototype);

module.exports = Connection;

Connection.prototype.isConnected = function isConnected() {
    return this.connected;
};

Connection.prototype.writeLine = function writeLine(line, cb) {
    this.debugOut('writeLine() socket=' + (this.socket?'yes':'no') + ' connected=' + this.connected);
	if (this.socket && this.connected) {
		this.socket.send(line, cb);
	}
};

Connection.prototype.debugOut = function(out) {
    this.emit('debug', out);
};

Connection.prototype.connect = function() {
    var that = this;
    var options = this.options;
    var socket = null;
    var ws_addr = '';

    this.debugOut('Connection.connect()');

    this.disposeSocket();
    this.requested_disconnect = false;

    // Build the websocket address. eg. ws://ws.rizon.net:8080
    ws_addr += (options.tls || options.ssl) ? 'wss://' : 'ws://';
    ws_addr += options.host;
    ws_addr += options.port ? ':' + options.port : '';
    ws_addr += options.path ? options.path : '';

    socket = this.socket = new WebSocket(ws_addr); // jshint ignore:line

    socket.onopen = _.bind(function() {
        that.onSocketFullyConnected();
    });
    socket.onclose = function() {
        that.onSocketClose();
    };
    socket.onmessage = function(event) {
        that.onSocketMessage(event.data);
    };
    socket.onopen = function() {
        that.onSocketFullyConnected();
    };
};



// Called when the socket is connected and ready to start sending/receiving data.
Connection.prototype.onSocketFullyConnected = function onSocketFullyConnected() {
    this.debugOut('socketFullyConnected()');
    this.connected = true;
    this.emit('open');
};

Connection.prototype.onSocketClose = function onSocketClose() {
	this.debugOut('socketClose()');
    this.connected = false;
    this.emit('close');
};

Connection.prototype.onSocketMessage = function onSocketMessage(data) {
	this.debugOut('socketData() ' + JSON.stringify(data));

    var that = this;
    var lines = null;

	this.incoming_buffer += data + '\n';

	lines = this.incoming_buffer.split('\n');
	if (lines[lines.length - 1] !== '') {
		this.incoming_buffer = lines.pop();
	} else {
		lines.pop();
		this.incoming_buffer = '';
	}

	lines.forEach(function(_line) {
		var line = _line.trim();
		that.emit('line', line);
	});
};



Connection.prototype.disposeSocket = function() {
    this.debugOut('Connection.disposeSocket() connected=' + this.connected);

    if (this.socket && this.connected) {
        this.socket.close();
    }

    if (this.socket) {
        this._unbindEvents();
        this.socket = null;
    }
};


Connection.prototype.close = function() {
    if (this.socket && this.connected) {
        this.socket.close();
    }
};


Connection.prototype.setEncoding = function(encoding) {
};
