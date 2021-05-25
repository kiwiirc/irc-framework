'use strict';

/**
 * TCP / TLS transport
 */

const net = require('net');
const tls = require('tls');
const EventEmitter = require('events').EventEmitter;
const SocksClient = require('socks').SocksClient;
const iconv = require('iconv-lite');

const SOCK_DISCONNECTED = 0;
const SOCK_CONNECTING = 1;
const SOCK_CONNECTED = 2;

module.exports = class Connection extends EventEmitter {
    constructor(options) {
        super();

        this.options = options || {};

        this.socket = null;
        this.state = SOCK_DISCONNECTED;
        this.last_socket_error = null;
        this.socket_events = [];

        this.encoding = 'utf8';
    }

    isConnected() {
        return this.state === SOCK_CONNECTED;
    }

    writeLine(line, cb) {
        if (this.socket && this.isConnected()) {
            if (this.encoding !== 'utf8') {
                this.socket.write(iconv.encode(line + '\r\n', this.encoding), cb);
            } else {
                this.socket.write(line + '\r\n', cb);
            }
        } else {
            this.debugOut('writeLine() called when not connected');

            if (cb) {
                process.nextTick(cb);
            }
        }
    }

    debugOut(out) {
        this.emit('debug', 'NetTransport ' + out);
    }

    _bindEvent(obj, event, fn) {
        obj.on(event, fn);
        const unbindEvent = () => {
            obj.off(event, fn);
        };
        this.socket_events.push(unbindEvent);
        return unbindEvent;
    }

    _unbindEvents() {
        this.socket_events.forEach(fn => fn());
    }

    connect() {
        const options = this.options;
        const ircd_host = options.host;
        const ircd_port = options.port || 6667;
        let sni;

        this.debugOut('connect()');

        this.disposeSocket();
        this.requested_disconnect = false;
        this.incoming_buffer = Buffer.from('');

        // Include server name (SNI) if provided host is not an IP address
        if (!this.getAddressFamily(ircd_host)) {
            sni = ircd_host;
        }

        if (!options.encoding || !this.setEncoding(options.encoding)) {
            this.setEncoding('utf8');
        }

        this.state = SOCK_CONNECTING;
        this.debugOut('Connecting socket..');

        if (options.socks) {
            this.debugOut('Using SOCKS proxy');
            this.socket = null;

            SocksClient.createConnection({
                proxy: {
                    host: options.socks.host,
                    port: options.socks.port || 8080,
                    type: 5, // Proxy version (4 or 5)

                    userId: options.socks.user,
                    password: options.socks.pass,
                },

                command: 'connect',

                destination: {
                    host: ircd_host,
                    port: ircd_port,
                }
            }).then(info => {
                let connection = info.socket;
                if (options.tls || options.ssl) {
                    connection = tls.connect({
                        socket: connection,
                        servername: sni,
                        rejectUnauthorized: options.rejectUnauthorized,
                        key: options.client_certificate && options.client_certificate.private_key,
                        cert: options.client_certificate && options.client_certificate.certificate,
                    });
                }
                this.socket = connection;
                this.debugOut('SOCKS connection established.');
                this._onSocketCreate(options, connection);
            }).catch(this.onSocketError.bind(this));
        } else {
            let socket = null;
            if (options.tls || options.ssl) {
                socket = this.socket = tls.connect({
                    servername: sni,
                    host: ircd_host,
                    port: ircd_port,
                    rejectUnauthorized: options.rejectUnauthorized,
                    key: options.client_certificate && options.client_certificate.private_key,
                    cert: options.client_certificate && options.client_certificate.certificate,
                    localAddress: options.outgoing_addr,
                    family: this.getAddressFamily(options.outgoing_addr)
                });
            } else {
                socket = this.socket = net.connect({
                    host: ircd_host,
                    port: ircd_port,
                    localAddress: options.outgoing_addr,
                    family: this.getAddressFamily(options.outgoing_addr)
                });
            }
            this._onSocketCreate(options, socket);
        }
    }

    _onSocketCreate(options, socket) {
        this.debugOut('Socket created!');
        if (options.ping_interval > 0 && options.ping_timeout > 0) {
            socket.setTimeout((options.ping_interval + options.ping_timeout) * 1000);
        }

        // We need the raw socket connect event.
        // It seems SOCKS gives us the socket in an already open state! Deal with that:
        if (socket.readyState !== 'opening') {
            this.onSocketRawConnected();
            if (!(socket instanceof tls.TLSSocket)) {
                this.onSocketFullyConnected();
            }
        } else {
            this._bindEvent(socket, 'connect', this.onSocketRawConnected.bind(this));
        }
        this._bindEvent(
            socket,
            socket instanceof tls.TLSSocket ? 'secureConnect' : 'connect',
            this.onSocketFullyConnected.bind(this)
        );
        this._bindEvent(socket, 'close', this.onSocketClose.bind(this));
        this._bindEvent(socket, 'error', this.onSocketError.bind(this));
        this._bindEvent(socket, 'data', this.onSocketData.bind(this));
        this._bindEvent(socket, 'timeout', this.onSocketTimeout.bind(this));
    }

    // Called when the socket is connected and before any TLS handshaking if applicable.
    // This is when it's ideal to read socket pairs for identd.
    onSocketRawConnected() {
        this.debugOut('socketRawConnected()');
        this.state = SOCK_CONNECTED;
        this.emit('extra', 'raw socket connected', (this.socket.socket || this.socket));
    }

    // Called when the socket is connected and ready to start sending/receiving data.
    onSocketFullyConnected() {
        this.debugOut('socketFullyConnected()');
        this.last_socket_error = null;
        this.emit('open');
    }

    onSocketClose() {
        this.debugOut('socketClose()');
        this.state = SOCK_DISCONNECTED;
        this.emit('close', this.last_socket_error ? this.last_socket_error : false);
    }

    onSocketError(err) {
        this.debugOut('socketError() ' + err.message);
        this.last_socket_error = err;
        // this.emit('error', err);
    }

    onSocketTimeout() {
        this.debugOut('socketTimeout()');
        this.close(true);
    }

    onSocketData(data) {
        // Buffer incoming data because multiple messages can arrive at once
        // without necessarily ending in a new line
        this.incoming_buffer = Buffer.concat(
            [this.incoming_buffer, data],
            this.incoming_buffer.length + data.length
        );

        let startIndex = 0;

        while (true) {
            // Search for the next new line in the buffered data
            const endIndex = this.incoming_buffer.indexOf(0x0A, startIndex) + 1;

            // If this message is partial, keep it in the buffer until more data arrives.
            // If startIndex is equal to incoming_buffer.length, that means we reached the end
            // of the buffer and it ended on a new line, slice will return an empty buffer.
            if (endIndex === 0) {
                this.incoming_buffer = this.incoming_buffer.slice(startIndex);
                break;
            }

            // Slice a single message delimited by a new line, decode it and emit it out
            let line = this.incoming_buffer.slice(startIndex, endIndex);
            line = iconv.decode(line, this.encoding);
            this.emit('line', line);

            startIndex = endIndex;
        }
    }

    disposeSocket() {
        this.debugOut('disposeSocket() connected=' + this.isConnected());

        if (this.socket && this.state !== SOCK_DISCONNECTED) {
            this.socket.destroy();
        }

        if (this.socket) {
            this._unbindEvents();
            this.socket = null;
        }
    }

    close(force) {
        if (!this.socket) {
            this.debugOut('close() called with no socket');
            return;
        }

        // Cleanly close the socket if we can
        if (this.state === SOCK_CONNECTING || force) {
            this.debugOut('close() destroying');
            this.socket.destroy();
        } else if (this.state === SOCK_CONNECTED) {
            this.debugOut('close() ending');
            this.socket.end();
        }
    }

    setEncoding(encoding) {
        let encoded_test;

        this.debugOut('Connection.setEncoding() encoding=' + encoding);

        try {
            const testString = 'TEST\r\ntest';

            encoded_test = iconv.encode(testString, encoding);
            // This test is done to check if this encoding also supports
            // the ASCII charset required by the IRC protocols
            // (Avoid the use of base64 or incompatible encodings)
            if (encoded_test.toString('ascii') === testString) {
                this.encoding = encoding;
                return true;
            }
            return false;
        } catch (err) {
            return false;
        }
    }

    getAddressFamily(addr) {
        if (net.isIPv4(addr)) {
            return 4;
        }
        if (net.isIPv6(addr)) {
            return 6;
        }
    }
};
