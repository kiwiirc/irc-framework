import net from 'net';
import tls from 'tls';
import { EventEmitter } from 'events';
import { assert, expect, use as chaiUse } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

import Connection from '../../src/transports/net.js';

chaiUse(sinonChai);

function createMockSocket() {
    const socket = new EventEmitter();
    socket.readyState = 'opening';
    socket.setTimeout = sinon.stub();
    socket.destroy = sinon.stub();
    socket.end = sinon.stub();
    socket.write = sinon.stub();
    return socket;
}

describe('src/transports/net.js', function() {
    let sandbox;
    let mockSocket;

    beforeEach(function() {
        sandbox = sinon.createSandbox();
        mockSocket = createMockSocket();
        sandbox.stub(net, 'connect').returns(mockSocket);
        sandbox.stub(tls, 'connect').returns(mockSocket);
    });

    afterEach(function() {
        sandbox.restore();
    });

    describe('connect()', function() {
        describe('plain TCP connection', function() {
            it('should call net.connect with host and port', function() {
                const conn = new Connection({
                    host: 'irc.example.com',
                    port: 6667,
                    encoding: 'utf8',
                });
                conn.connect();

                expect(net.connect).to.have.been.calledOnce;
                expect(net.connect).to.have.been.calledWith({
                    host: 'irc.example.com',
                    port: 6667,
                    localAddress: undefined,
                    family: undefined,
                });
            });

            it('should default port to 6667 when not specified', function() {
                const conn = new Connection({
                    host: 'irc.example.com',
                    encoding: 'utf8',
                });
                conn.connect();

                expect(net.connect).to.have.been.calledOnce;
                const callArgs = net.connect.firstCall.args[0];
                assert.equal(callArgs.port, 6667);
            });

            it('should pass localAddress and family when outgoing_addr is set', function() {
                const conn = new Connection({
                    host: 'irc.example.com',
                    port: 6667,
                    outgoing_addr: '192.168.1.100',
                    encoding: 'utf8',
                });
                conn.connect();

                const callArgs = net.connect.firstCall.args[0];
                assert.equal(callArgs.localAddress, '192.168.1.100');
                assert.equal(callArgs.family, 4);
            });

            it('should detect IPv6 family for outgoing_addr', function() {
                const conn = new Connection({
                    host: 'irc.example.com',
                    port: 6667,
                    outgoing_addr: '::1',
                    encoding: 'utf8',
                });
                conn.connect();

                const callArgs = net.connect.firstCall.args[0];
                assert.equal(callArgs.family, 6);
            });
        });

        describe('TLS connection', function() {
            it('should call tls.connect with host and port when tls is set', function() {
                const conn = new Connection({
                    host: 'irc.example.com',
                    port: 6697,
                    tls: true,
                    encoding: 'utf8',
                });
                conn.connect();

                expect(tls.connect).to.have.been.calledOnce;
                expect(net.connect).to.not.have.been.called;
                const callArgs = tls.connect.firstCall.args[0];
                assert.equal(callArgs.host, 'irc.example.com');
                assert.equal(callArgs.port, 6697);
            });

            it('should call tls.connect when ssl option is set', function() {
                const conn = new Connection({
                    host: 'irc.example.com',
                    port: 6697,
                    ssl: true,
                    encoding: 'utf8',
                });
                conn.connect();

                expect(tls.connect).to.have.been.calledOnce;
            });

            it('should set servername (SNI) for hostname hosts', function() {
                const conn = new Connection({
                    host: 'irc.example.com',
                    port: 6697,
                    tls: true,
                    encoding: 'utf8',
                });
                conn.connect();

                const callArgs = tls.connect.firstCall.args[0];
                assert.equal(callArgs.servername, 'irc.example.com');
            });

            it('should not set servername for IP address hosts', function() {
                const conn = new Connection({
                    host: '192.168.1.1',
                    port: 6697,
                    tls: true,
                    encoding: 'utf8',
                });
                conn.connect();

                const callArgs = tls.connect.firstCall.args[0];
                assert.isUndefined(callArgs.servername);
            });

            it('should pass rejectUnauthorized option', function() {
                const conn = new Connection({
                    host: 'irc.example.com',
                    port: 6697,
                    tls: true,
                    rejectUnauthorized: false,
                    encoding: 'utf8',
                });
                conn.connect();

                const callArgs = tls.connect.firstCall.args[0];
                assert.equal(callArgs.rejectUnauthorized, false);
            });

            it('should pass client certificate options', function() {
                const conn = new Connection({
                    host: 'irc.example.com',
                    port: 6697,
                    tls: true,
                    client_certificate: {
                        private_key: 'test-key',
                        certificate: 'test-cert',
                    },
                    encoding: 'utf8',
                });
                conn.connect();

                const callArgs = tls.connect.firstCall.args[0];
                assert.equal(callArgs.key, 'test-key');
                assert.equal(callArgs.cert, 'test-cert');
            });
        });

        describe('Unix socket connection', function() {
            it('should call net.connect with path when path is set', function() {
                const conn = new Connection({
                    path: '/tmp/irc.sock',
                    encoding: 'utf8',
                });
                conn.connect();

                expect(net.connect).to.have.been.calledOnce;
                expect(net.connect).to.have.been.calledWith({
                    path: '/tmp/irc.sock',
                });
            });

            it('should not pass host, port, localAddress or family', function() {
                const conn = new Connection({
                    host: 'irc.example.com',
                    port: 6667,
                    path: '/tmp/irc.sock',
                    outgoing_addr: '192.168.1.100',
                    encoding: 'utf8',
                });
                conn.connect();

                const callArgs = net.connect.firstCall.args[0];
                assert.isUndefined(callArgs.host);
                assert.isUndefined(callArgs.port);
                assert.isUndefined(callArgs.localAddress);
                assert.isUndefined(callArgs.family);
            });

            it('should prefer path over host/port', function() {
                const conn = new Connection({
                    host: 'irc.example.com',
                    port: 6667,
                    path: '/tmp/irc.sock',
                    encoding: 'utf8',
                });
                conn.connect();

                expect(net.connect).to.have.been.calledOnce;
                const callArgs = net.connect.firstCall.args[0];
                assert.equal(callArgs.path, '/tmp/irc.sock');
            });
        });

        describe('TLS over Unix socket connection', function() {
            it('should call tls.connect with path when tls and path are set', function() {
                const conn = new Connection({
                    path: '/tmp/irc.sock',
                    tls: true,
                    encoding: 'utf8',
                });
                conn.connect();

                expect(tls.connect).to.have.been.calledOnce;
                expect(net.connect).to.not.have.been.called;
                const callArgs = tls.connect.firstCall.args[0];
                assert.equal(callArgs.path, '/tmp/irc.sock');
            });

            it('should work with ssl option as well', function() {
                const conn = new Connection({
                    path: '/tmp/irc.sock',
                    ssl: true,
                    encoding: 'utf8',
                });
                conn.connect();

                expect(tls.connect).to.have.been.calledOnce;
                const callArgs = tls.connect.firstCall.args[0];
                assert.equal(callArgs.path, '/tmp/irc.sock');
            });

            it('should not pass host, port, servername, localAddress or family', function() {
                const conn = new Connection({
                    host: 'irc.example.com',
                    port: 6697,
                    path: '/tmp/irc.sock',
                    tls: true,
                    outgoing_addr: '192.168.1.100',
                    encoding: 'utf8',
                });
                conn.connect();

                const callArgs = tls.connect.firstCall.args[0];
                assert.isUndefined(callArgs.host);
                assert.isUndefined(callArgs.port);
                assert.isUndefined(callArgs.servername);
                assert.isUndefined(callArgs.localAddress);
                assert.isUndefined(callArgs.family);
            });

            it('should pass rejectUnauthorized option', function() {
                const conn = new Connection({
                    path: '/tmp/irc.sock',
                    tls: true,
                    rejectUnauthorized: false,
                    encoding: 'utf8',
                });
                conn.connect();

                const callArgs = tls.connect.firstCall.args[0];
                assert.equal(callArgs.rejectUnauthorized, false);
            });

            it('should pass client certificate options', function() {
                const conn = new Connection({
                    path: '/tmp/irc.sock',
                    tls: true,
                    client_certificate: {
                        private_key: 'test-key',
                        certificate: 'test-cert',
                    },
                    encoding: 'utf8',
                });
                conn.connect();

                const callArgs = tls.connect.firstCall.args[0];
                assert.equal(callArgs.key, 'test-key');
                assert.equal(callArgs.cert, 'test-cert');
            });
        });

        // Lines 93-126: SOCKS proxy connection path
        describe('SOCKS proxy connection', function() {
            let SocksClient;
            let socksSocket;

            beforeEach(async function() {
                // Dynamically import socks so we can stub SocksClient.createConnection
                const socksModule = await import('socks');
                SocksClient = socksModule.SocksClient;
                socksSocket = createMockSocket();
                sandbox.stub(SocksClient, 'createConnection').resolves({ socket: socksSocket });
            });

            it('should call SocksClient.createConnection with proxy and destination', async function() {
                const conn = new Connection({
                    host: 'irc.example.com',
                    port: 6667,
                    socks: { host: 'proxy.example.com', port: 1080, user: 'u', pass: 'p' },
                });
                conn.connect();
                await Promise.resolve(); // flush the .then()

                expect(SocksClient.createConnection).to.have.been.calledOnce;
                const [opts] = SocksClient.createConnection.firstCall.args;
                assert.equal(opts.proxy.host, 'proxy.example.com');
                assert.equal(opts.proxy.port, 1080);
                assert.equal(opts.proxy.type, 5);
                assert.equal(opts.proxy.userId, 'u');
                assert.equal(opts.proxy.password, 'p');
                assert.equal(opts.destination.host, 'irc.example.com');
                assert.equal(opts.destination.port, 6667);
                assert.equal(opts.command, 'connect');
            });

            it('should default SOCKS proxy port to 8080 when not specified', async function() {
                const conn = new Connection({
                    host: 'irc.example.com',
                    port: 6667,
                    socks: { host: 'proxy.example.com' },
                });
                conn.connect();
                await Promise.resolve();

                const [opts] = SocksClient.createConnection.firstCall.args;
                assert.equal(opts.proxy.port, 8080);
            });

            it('should set conn.socket to the resolved SOCKS socket', async function() {
                const conn = new Connection({
                    host: 'irc.example.com',
                    port: 6667,
                    socks: { host: 'proxy.example.com' },
                });
                conn.connect();
                await Promise.resolve();

                assert.equal(conn.socket, socksSocket);
            });

            it('should not call net.connect or tls.connect for a plain SOCKS connection', async function() {
                const conn = new Connection({
                    host: 'irc.example.com',
                    port: 6667,
                    socks: { host: 'proxy.example.com' },
                });
                conn.connect();
                await Promise.resolve();

                expect(net.connect).to.not.have.been.called;
                expect(tls.connect).to.not.have.been.called;
            });

            // Lines 114-121: SOCKS + TLS wraps the SOCKS socket with tls.connect
            it('should wrap the SOCKS socket with tls.connect when tls option is set', async function() {
                const tlsSocket = createMockSocket();
                tls.connect.returns(tlsSocket);

                const conn = new Connection({
                    host: 'irc.example.com',
                    port: 6697,
                    tls: true,
                    socks: { host: 'proxy.example.com' },
                });
                conn.connect();
                await Promise.resolve();

                expect(tls.connect).to.have.been.calledOnce;
                const [tlsOpts] = tls.connect.firstCall.args;
                assert.equal(tlsOpts.socket, socksSocket,
                    'tls.connect should receive the raw SOCKS socket');
            });

            it('should wrap the SOCKS socket with tls.connect when ssl option is set', async function() {
                const conn = new Connection({
                    host: 'irc.example.com',
                    port: 6697,
                    ssl: true,
                    socks: { host: 'proxy.example.com' },
                });
                conn.connect();
                await Promise.resolve();

                expect(tls.connect).to.have.been.calledOnce;
            });

            it('should pass SNI servername to tls.connect for hostname targets', async function() {
                const conn = new Connection({
                    host: 'irc.example.com',
                    port: 6697,
                    tls: true,
                    socks: { host: 'proxy.example.com' },
                });
                conn.connect();
                await Promise.resolve();

                const [tlsOpts] = tls.connect.firstCall.args;
                assert.equal(tlsOpts.servername, 'irc.example.com');
            });

            it('should not pass SNI servername when target is an IP address', async function() {
                const conn = new Connection({
                    host: '192.168.1.1',
                    port: 6697,
                    tls: true,
                    socks: { host: 'proxy.example.com' },
                });
                conn.connect();
                await Promise.resolve();

                const [tlsOpts] = tls.connect.firstCall.args;
                assert.isUndefined(tlsOpts.servername);
            });

            it('should pass client certificate to tls.connect over SOCKS', async function() {
                const conn = new Connection({
                    host: 'irc.example.com',
                    port: 6697,
                    tls: true,
                    socks: { host: 'proxy.example.com' },
                    client_certificate: { private_key: 'test-key', certificate: 'test-cert' },
                });
                conn.connect();
                await Promise.resolve();

                const [tlsOpts] = tls.connect.firstCall.args;
                assert.equal(tlsOpts.key, 'test-key');
                assert.equal(tlsOpts.cert, 'test-cert');
            });

            // Line 126: .catch(this.onSocketError.bind(this))
            it('should call onSocketError when SocksClient.createConnection rejects', async function() {
                const err = new Error('SOCKS connection refused');
                SocksClient.createConnection.rejects(err);

                const conn = new Connection({
                    host: 'irc.example.com',
                    port: 6667,
                    socks: { host: 'proxy.example.com' },
                });
                const errorSpy = sinon.spy(conn, 'onSocketError');
                conn.connect();
                await new Promise(resolve => setTimeout(resolve, 0)); // flush rejection

                expect(errorSpy).to.have.been.calledOnce;
                expect(errorSpy).to.have.been.calledWith(err);
            });
        });

        // Line 86: encoding fallback behaviour during connect()
        describe('encoding selection', function() {
            it('should default to utf8 when no encoding option is provided', function() {
                const conn = new Connection({ host: 'irc.example.com', port: 6667 });
                conn.connect();

                assert.equal(conn.encoding, 'utf8');
            });

            it('should default to utf8 when an invalid encoding is provided', function() {
                const conn = new Connection({
                    host: 'irc.example.com',
                    port: 6667,
                    encoding: 'not-a-real-encoding',
                });
                conn.connect();

                assert.equal(conn.encoding, 'utf8');
            });

            it('should default to utf8 when base64 encoding is provided (breaks framing)', function() {
                const conn = new Connection({
                    host: 'irc.example.com',
                    port: 6667,
                    encoding: 'base64',
                });
                conn.connect();

                assert.equal(conn.encoding, 'utf8');
            });

            it('should use a valid non-utf8 encoding when provided', function() {
                const conn = new Connection({
                    host: 'irc.example.com',
                    port: 6667,
                    encoding: 'win1251',
                });
                conn.connect();

                assert.equal(conn.encoding, 'win1251');
            });
        });

        describe('connection state', function() {
            it('should set state to CONNECTING when connect is called', function() {
                const conn = new Connection({
                    host: 'irc.example.com',
                    port: 6667,
                    encoding: 'utf8',
                });
                conn.connect();

                // SOCK_CONNECTING = 1
                assert.equal(conn.state, 1);
            });

            it('should reset requested_disconnect on connect', function() {
                const conn = new Connection({
                    host: 'irc.example.com',
                    port: 6667,
                    encoding: 'utf8',
                });
                conn.requested_disconnect = true;
                conn.connect();

                assert.equal(conn.requested_disconnect, false);
            });

            it('should initialize incoming_buffer on connect', function() {
                const conn = new Connection({
                    host: 'irc.example.com',
                    port: 6667,
                    encoding: 'utf8',
                });
                conn.connect();

                assert.instanceOf(conn.incoming_buffer, Buffer);
                assert.equal(conn.incoming_buffer.length, 0);
            });
        });

        describe('socket event binding', function() {
            it('should set socket timeout when ping options are set', function() {
                const conn = new Connection({
                    host: 'irc.example.com',
                    port: 6667,
                    ping_interval: 30,
                    ping_timeout: 120,
                    encoding: 'utf8',
                });
                conn.connect();

                expect(mockSocket.setTimeout).to.have.been.calledWith(150000);
            });

            it('should not set socket timeout when ping_interval is 0', function() {
                const conn = new Connection({
                    host: 'irc.example.com',
                    port: 6667,
                    ping_interval: 0,
                    ping_timeout: 120,
                    encoding: 'utf8',
                });
                conn.connect();

                expect(mockSocket.setTimeout).to.not.have.been.called;
            });

            // Lines 171-175: already-open socket (readyState !== 'opening')
            // This happens when SOCKS returns a socket that is already connected.
            it('should call onSocketRawConnected and onSocketFullyConnected immediately when socket is already open', function() {
                const conn = new Connection({ host: 'irc.example.com', port: 6667 });
                const rawSpy = sinon.spy(conn, 'onSocketRawConnected');
                const fullSpy = sinon.spy(conn, 'onSocketFullyConnected');

                // Simulate an already-open plain socket (readyState = 'open')
                mockSocket.readyState = 'open';
                conn.connect();

                expect(rawSpy).to.have.been.calledOnce;
                expect(fullSpy).to.have.been.calledOnce;
            });

            it('should call onSocketRawConnected but NOT onSocketFullyConnected immediately when already-open socket is a TLSSocket', function() {
                const conn = new Connection({ host: 'irc.example.com', port: 6667, tls: true });
                const rawSpy = sinon.spy(conn, 'onSocketRawConnected');
                const fullSpy = sinon.spy(conn, 'onSocketFullyConnected');

                // Use a real TLSSocket so that instanceof tls.TLSSocket passes and Node's
                // stream internals (Symbol(kState) etc.) are properly initialised.
                // Passing no underlying socket leaves it inert but structurally valid.
                const realTlsSocket = new tls.TLSSocket();
                // Override readyState so _onSocketCreate takes the already-open branch
                Object.defineProperty(realTlsSocket, 'readyState', { get: () => 'open' });
                sinon.stub(realTlsSocket, 'setTimeout');
                tls.connect.returns(realTlsSocket);

                conn.connect();

                expect(rawSpy).to.have.been.calledOnce;
                // onSocketFullyConnected must NOT be called immediately for TLS
                // it must wait for the 'secureConnect' event instead
                expect(fullSpy).to.not.have.been.called;
            });

            it('should not call onSocketRawConnected immediately when socket readyState is opening', function() {
                const conn = new Connection({ host: 'irc.example.com', port: 6667 });
                const rawSpy = sinon.spy(conn, 'onSocketRawConnected');

                // mockSocket.readyState defaults to 'opening' from createMockSocket()
                conn.connect();

                expect(rawSpy).to.not.have.been.called;
            });
        });
    });

    // ── _bindEvent() / _unbindEvents() ────────────────────────────────────────
    describe('_bindEvent()', function() {
        it('should attach the listener so the event fires', function() {
            const conn = new Connection({});
            const emitter = new EventEmitter();
            const spy = sinon.spy();

            conn._bindEvent(emitter, 'test', spy);
            emitter.emit('test', 42);

            expect(spy).to.have.been.calledOnce;
            expect(spy).to.have.been.calledWith(42);
        });

        // Line 58: obj.off(event, fn) - the returned unbind function removes the listener
        it('should return an unbind function that removes the listener (line 58)', function() {
            const conn = new Connection({});
            const emitter = new EventEmitter();
            const spy = sinon.spy();

            const unbind = conn._bindEvent(emitter, 'test', spy);
            unbind();
            emitter.emit('test');

            expect(spy).to.not.have.been.called;
        });

        it('should push the unbind function onto socket_events', function() {
            const conn = new Connection({});
            const emitter = new EventEmitter();
            assert.equal(conn.socket_events.length, 0);

            conn._bindEvent(emitter, 'test', sinon.spy());

            assert.equal(conn.socket_events.length, 1);
            assert.isFunction(conn.socket_events[0]);
        });

        it('should accumulate multiple unbind functions in socket_events', function() {
            const conn = new Connection({});
            const emitter = new EventEmitter();

            conn._bindEvent(emitter, 'a', sinon.spy());
            conn._bindEvent(emitter, 'b', sinon.spy());
            conn._bindEvent(emitter, 'c', sinon.spy());

            assert.equal(conn.socket_events.length, 3);
        });
    });

    describe('_unbindEvents()', function() {
        it('should call every stored unbind function', function() {
            const conn = new Connection({});
            const unbind1 = sinon.spy();
            const unbind2 = sinon.spy();
            conn.socket_events.push(unbind1, unbind2);

            conn._unbindEvents();

            expect(unbind1).to.have.been.calledOnce;
            expect(unbind2).to.have.been.calledOnce;
        });

        it('should stop all bound events from firing after unbind', function() {
            const conn = new Connection({});
            const emitter = new EventEmitter();
            const spy = sinon.spy();

            conn._bindEvent(emitter, 'data', spy);
            conn._unbindEvents();
            emitter.emit('data', Buffer.from('hello'));

            expect(spy).to.not.have.been.called;
        });
    });

    describe('onSocketData()', function() {
        it('should emit complete lines', function() {
            const conn = new Connection({ encoding: 'utf8' });
            conn.incoming_buffer = Buffer.from('');
            const lines = [];
            conn.on('line', function(line) {
                lines.push(line);
            });

            conn.onSocketData(Buffer.from(':server PRIVMSG #test :hello\r\n'));

            assert.equal(lines.length, 1);
            assert.include(lines[0], ':server PRIVMSG #test :hello');
        });

        it('should buffer partial lines until complete', function() {
            const conn = new Connection({ encoding: 'utf8' });
            conn.incoming_buffer = Buffer.from('');
            const lines = [];
            conn.on('line', function(line) {
                lines.push(line);
            });

            conn.onSocketData(Buffer.from(':server PRIVMSG'));
            assert.equal(lines.length, 0);

            conn.onSocketData(Buffer.from(' #test :hello\r\n'));
            assert.equal(lines.length, 1);
            assert.include(lines[0], ':server PRIVMSG #test :hello');
        });

        it('should split multiple lines from a single data chunk', function() {
            const conn = new Connection({ encoding: 'utf8' });
            conn.incoming_buffer = Buffer.from('');
            const lines = [];
            conn.on('line', function(line) {
                lines.push(line);
            });

            conn.onSocketData(Buffer.from(':s PRIVMSG #a :one\r\n:s PRIVMSG #b :two\r\n'));

            assert.equal(lines.length, 2);
            assert.include(lines[0], ':s PRIVMSG #a :one');
            assert.include(lines[1], ':s PRIVMSG #b :two');
        });
    });

    describe('onSocketRawConnected()', function() {
        it('should set state to CONNECTED', function() {
            const conn = new Connection({});
            conn.socket = createMockSocket();
            conn.onSocketRawConnected();

            // SOCK_CONNECTED = 2
            assert.equal(conn.state, 2);
        });

        it('should emit "extra" with the socket when socket has no inner socket property', function() {
            const conn = new Connection({});
            const socket = createMockSocket(); // no .socket property
            conn.socket = socket;
            const spy = sinon.spy();
            conn.on('extra', spy);
            conn.onSocketRawConnected();

            // socket.socket is undefined, so falls back to socket itself
            expect(spy).to.have.been.calledWith('raw socket connected', socket);
        });

        it('should emit "extra" with the inner socket when socket.socket is set (e.g. SOCKS wrapping)', function() {
            const conn = new Connection({});
            const innerSocket = createMockSocket();
            const outerSocket = createMockSocket();
            outerSocket.socket = innerSocket; // TLS/SOCKS wraps the raw socket
            conn.socket = outerSocket;
            const spy = sinon.spy();
            conn.on('extra', spy);
            conn.onSocketRawConnected();

            expect(spy).to.have.been.calledWith('raw socket connected', innerSocket);
        });
    });

    describe('onSocketFullyConnected()', function() {
        it('should emit open event', function() {
            const conn = new Connection({});
            const spy = sinon.spy();
            conn.on('open', spy);
            conn.onSocketFullyConnected();

            expect(spy).to.have.been.calledOnce;
        });

        it('should clear last_socket_error', function() {
            const conn = new Connection({});
            conn.last_socket_error = new Error('previous error');
            conn.onSocketFullyConnected();

            assert.isNull(conn.last_socket_error);
        });
    });

    describe('onSocketClose()', function() {
        it('should set state to DISCONNECTED', function() {
            const conn = new Connection({});
            conn.state = 2; // SOCK_CONNECTED
            conn.onSocketClose();

            // SOCK_DISCONNECTED = 0
            assert.equal(conn.state, 0);
        });

        it('should emit close with last error if present', function() {
            const conn = new Connection({});
            const err = new Error('connection reset');
            conn.last_socket_error = err;
            const spy = sinon.spy();
            conn.on('close', spy);
            conn.onSocketClose();

            expect(spy).to.have.been.calledWith(err);
        });

        it('should emit close with false when no error', function() {
            const conn = new Connection({});
            conn.last_socket_error = null;
            const spy = sinon.spy();
            conn.on('close', spy);
            conn.onSocketClose();

            expect(spy).to.have.been.calledWith(false);
        });
    });

    describe('onSocketError()', function() {
        it('should store the error', function() {
            const conn = new Connection({});
            const err = new Error('ECONNREFUSED');
            conn.onSocketError(err);

            assert.equal(conn.last_socket_error, err);
        });
    });

    describe('onSocketTimeout()', function() {
        it('should call close with force', function() {
            const conn = new Connection({});
            conn.socket = createMockSocket();
            conn.state = 1; // SOCK_CONNECTING
            conn.onSocketTimeout();

            expect(conn.socket.destroy).to.have.been.calledOnce;
        });
    });

    describe('close()', function() {
        it('should destroy socket when connecting', function() {
            const conn = new Connection({});
            conn.socket = createMockSocket();
            conn.state = 1; // SOCK_CONNECTING
            conn.close();

            expect(conn.socket.destroy).to.have.been.calledOnce;
        });

        it('should destroy socket when force is true', function() {
            const conn = new Connection({});
            conn.socket = createMockSocket();
            conn.state = 2; // SOCK_CONNECTED
            conn.close(true);

            expect(conn.socket.destroy).to.have.been.calledOnce;
        });

        it('should end socket gracefully when connected', function() {
            const conn = new Connection({});
            conn.socket = createMockSocket();
            conn.state = 2; // SOCK_CONNECTED
            conn.close();

            expect(conn.socket.end).to.have.been.calledOnce;
            expect(conn.socket.destroy).to.not.have.been.called;
        });

        it('should neither destroy nor end socket when disconnected and not forced', function() {
            const conn = new Connection({});
            conn.socket = createMockSocket();
            conn.state = 0; // SOCK_DISCONNECTED

            conn.close();

            expect(conn.socket.destroy).to.not.have.been.called;
            expect(conn.socket.end).to.not.have.been.called;
        });

        it('should not throw when socket is null', function() {
            const conn = new Connection({});
            conn.socket = null;
            assert.doesNotThrow(function() {
                conn.close();
            });
        });
    });

    describe('disposeSocket()', function() {
        it('should destroy and null the socket', function() {
            const conn = new Connection({});
            conn.socket = createMockSocket();
            conn.state = 2; // SOCK_CONNECTED
            conn.disposeSocket();

            assert.isNull(conn.socket);
        });

        it('should not destroy if already disconnected', function() {
            const conn = new Connection({});
            const socket = createMockSocket();
            conn.socket = socket;
            conn.state = 0; // SOCK_DISCONNECTED
            conn.disposeSocket();

            expect(socket.destroy).to.not.have.been.called;
            assert.isNull(conn.socket);
        });
    });

    describe('getAddressFamily()', function() {
        it('should return 4 for IPv4 addresses', function() {
            const conn = new Connection({});
            assert.equal(conn.getAddressFamily('192.168.1.1'), 4);
            assert.equal(conn.getAddressFamily('10.0.0.1'), 4);
            assert.equal(conn.getAddressFamily('127.0.0.1'), 4);
        });

        it('should return 6 for IPv6 addresses', function() {
            const conn = new Connection({});
            assert.equal(conn.getAddressFamily('::1'), 6);
            assert.equal(conn.getAddressFamily('fe80::1'), 6);
        });

        it('should return undefined for hostnames', function() {
            const conn = new Connection({});
            assert.isUndefined(conn.getAddressFamily('irc.example.com'));
            assert.isUndefined(conn.getAddressFamily(undefined));
        });
    });

    describe('writeLine()', function() {
        it('should write line with CRLF when connected', function() {
            const conn = new Connection({});
            conn.socket = createMockSocket();
            conn.state = 2; // SOCK_CONNECTED

            conn.writeLine('PRIVMSG #test :hello');

            expect(conn.socket.write).to.have.been.calledOnce;
            const writeArg = conn.socket.write.firstCall.args[0];
            assert.equal(writeArg, 'PRIVMSG #test :hello\r\n');
        });

        it('should not write when not connected', function() {
            const conn = new Connection({});
            conn.socket = createMockSocket();
            conn.state = 0; // SOCK_DISCONNECTED

            conn.writeLine('PRIVMSG #test :hello');

            expect(conn.socket.write).to.not.have.been.called;
        });

        it('should call callback via nextTick when not connected', function(done) {
            const conn = new Connection({});
            conn.socket = null;
            conn.state = 0; // SOCK_DISCONNECTED

            conn.writeLine('PRIVMSG #test :hello', function() {
                done();
            });
        });

        // ── Line 38 coverage: iconv.encode branch (encoding !== 'utf8') ──────────

        it('should use iconv.encode when encoding is not utf8 (line 38)', function() {
            const conn = new Connection({});
            conn.socket = createMockSocket();
            conn.state = 2; // SOCK_CONNECTED
            conn.encoding = 'latin1';

            conn.writeLine('PRIVMSG #test :hello');

            expect(conn.socket.write).to.have.been.calledOnce;
            // iconv.encode returns a Buffer, not a plain string
            const [writeArg] = conn.socket.write.firstCall.args;
            assert.instanceOf(writeArg, Buffer,
                'writeLine() should pass a Buffer to socket.write() for non-utf8 encodings');
        });

        it('should invoke the callback when encoding is not utf8', function(done) {
            const conn = new Connection({});
            conn.socket = createMockSocket();
            // Make socket.write immediately invoke the callback (mirrors real net.Socket behaviour)
            conn.socket.write = sinon.stub().callsFake((_data, cb) => cb && cb());
            conn.state = 2; // SOCK_CONNECTED
            conn.encoding = 'latin1';

            conn.writeLine('PRIVMSG #test :hello', done);
        });

        describe('non-UTF8 encoding - popular IRC encodings', function() {
            /**
             * Each test calls writeLine() with a Unicode string and asserts that the
             * Buffer passed to socket.write() matches a *hardcoded* reference buffer
             * whose bytes were derived independently from the canonical encoding tables
             * and verified against Node's built-in TextDecoder.
             *
             * The prefix "PRIVMSG #chan :" is pure ASCII and is identical in every
             * encoding; only the language-specific body bytes differ.
             *
             * This approach catches bugs in either direction: a wrong encode would
             * produce different bytes; a round-trip using Connection for both sides
             * would mask such bugs.
             */
            function assertWriteBuffer(encoding, unicodeText, expectedBodyBytes) {
                // "PRIVMSG #chan :" in ASCII + body bytes + CRLF
                const expectedBuf = Buffer.concat([
                    Buffer.from('PRIVMSG #chan :', 'ascii'),
                    Buffer.from(expectedBodyBytes),
                    Buffer.from([0x0D, 0x0A]),
                ]);

                const conn = new Connection({});
                conn.socket = createMockSocket();
                conn.state = 2;
                conn.setEncoding(encoding);
                conn.writeLine(`PRIVMSG #chan :${unicodeText}`);

                const [actualBuf] = conn.socket.write.firstCall.args;
                assert.instanceOf(actualBuf, Buffer,
                    `writeLine() must pass a Buffer to socket.write() for ${encoding}`);
                assert.deepEqual(
                    [...actualBuf],
                    [...expectedBuf],
                    `Encoded bytes for "${unicodeText}" in ${encoding} do not match reference`
                );
            }

            // ── Western European ─────────────────────────────────────────────────
            // latin1 / ISO-8859-1 - historically the most common IRC encoding on
            // Western European IRC networks (French, German, Spanish, Dutch...)
            // Verified: é=0xE9  ö=0xF6  via ISO-8859-1 standard table
            it('latin1: encodes Western-European characters correctly', function() {
                assertWriteBuffer('latin1', 'H\u00E9llo W\u00F6rld caf\u00E9', [
                    0x48, 0xE9, 0x6C, 0x6C, 0x6F, 0x20,  // H é l l o SP
                    0x57, 0xF6, 0x72, 0x6C, 0x64, 0x20,  // W ö r l d SP
                    0x63, 0x61, 0x66, 0xE9,               // c a f é
                ]);
            });

            // win1252 extends latin1 with printable chars in 0xA0-0xFF range.
            // Verified: £=0xA3  ©=0xA9  ×=0xD7  via windows-1252 standard table
            it('win1252: encodes Windows-1252 characters correctly', function() {
                assertWriteBuffer('win1252', '\u00A3 \u00A9 \u00D7', [
                    0xA3, 0x20, 0xA9, 0x20, 0xD7,  // £ SP © SP ×
                ]);
            });

            // ── Central / Eastern European ───────────────────────────────────────
            // ISO-8859-2 - Czech, Slovak, Polish, Hungarian, Croatian, Romanian
            // Verified: ř=0xF8  í=0xED  š=0xB9  ž=0xBE  ť=0xBB  via ISO-8859-2 table
            it('iso-8859-2: encodes Central/Eastern European characters correctly', function() {
                assertWriteBuffer('iso-8859-2', 'P\u0159\u00ED li\u0161 \u017Elu\u0165', [
                    0x50, 0xF8, 0xED, 0x20,         // P ř í SP
                    0x6C, 0x69, 0xB9, 0x20,         // l i š SP
                    0xBE, 0x6C, 0x75, 0xBB,         // ž l u ť
                ]);
            });

            // win1250 - Windows Central European, common on Polish/Czech IRC clients
            // Verified: ż=0xBF  ó=0xF3  ł=0xB3  ć=0xE6  via windows-1250 table
            it('win1250: encodes Windows-1250 Polish characters correctly', function() {
                assertWriteBuffer('win1250', 'Za\u017C\u00F3\u0142\u0107', [
                    0x5A, 0x61, 0xBF, 0xF3, 0xB3, 0xE6,  // Z a ż ó ł ć
                ]);
            });

            // ── Cyrillic ─────────────────────────────────────────────────────────
            // win1251 - dominant encoding on Russian IRC networks (RusNet, IRCNet-RU)
            // Verified: П=0xCF  р=0xF0  и=0xE8  в=0xE2  е=0xE5  т=0xF2  м=0xEC
            //           via windows-1251 standard table
            it('win1251: encodes Cyrillic (Russian) characters correctly', function() {
                assertWriteBuffer('win1251', '\u041F\u0440\u0438\u0432\u0435\u0442 \u043C\u0438\u0440', [
                    0xCF, 0xF0, 0xE8, 0xE2, 0xE5, 0xF2, 0x20,  // П р и в е т SP
                    0xEC, 0xE8, 0xF0,                            // м и р
                ]);
            });

            // KOI8-R - older Cyrillic encoding, still seen on legacy Russian servers
            // Verified: м=0xCD  и=0xC9  р=0xD2  via KOI8-R standard table
            it('koi8-r: encodes KOI8-R Cyrillic characters correctly', function() {
                assertWriteBuffer('koi8-r', '\u043C\u0438\u0440', [
                    0xCD, 0xC9, 0xD2,  // м и р
                ]);
            });

            // ISO-8859-5 Cyrillic - lowercase block starts at 0xD0
            // Verified: п=0xDF  р=0xE0  и=0xD8  в=0xD2  е=0xD5  т=0xE2
            //           via ISO-8859-5 standard table
            it('iso-8859-5: encodes ISO-8859-5 Cyrillic characters correctly', function() {
                assertWriteBuffer('iso-8859-5', '\u043F\u0440\u0438\u0432\u0435\u0442', [
                    0xDF, 0xE0, 0xD8, 0xD2, 0xD5, 0xE2,  // п р и в е т
                ]);
            });

            // ── Greek ────────────────────────────────────────────────────────────
            // ISO-8859-7 - used on Greek IRC networks
            // Verified: Γ=0xC3  ε=0xE5  ι=0xE9  α=0xE1  σ=0xF3  ο=0xEF  υ=0xF5
            //           via ISO-8859-7 standard table
            it('iso-8859-7: encodes Greek characters correctly', function() {
                assertWriteBuffer('iso-8859-7', '\u0393\u03B5\u03B9\u03B1 \u03C3\u03BF\u03C5', [
                    0xC3, 0xE5, 0xE9, 0xE1, 0x20,  // Γ ε ι α SP
                    0xF3, 0xEF, 0xF5,               // σ ο υ
                ]);
            });

            // win1253 - Windows Greek, common on Hellas IRC
            // Verified: Α=0xC1  θ=0xE8  ή=0xDE  ν=0xED  α=0xE1  Ε=0xC5  λ=0xEB
            //           ά=0xDC  δ=0xE4  via windows-1253 standard table
            it('win1253: encodes Windows-1253 Greek characters correctly', function() {
                assertWriteBuffer('win1253', '\u0391\u03B8\u03AE\u03BD\u03B1 \u0395\u03BB\u03BB\u03AC\u03B4\u03B1', [
                    0xC1, 0xE8, 0xDE, 0xED, 0xE1, 0x20,  // Α θ ή ν α SP
                    0xC5, 0xEB, 0xEB, 0xDC, 0xE4, 0xE1,  // Ε λ λ ά δ α
                ]);
            });

            // ── Turkish ──────────────────────────────────────────────────────────
            // ISO-8859-9 replaces some latin1 chars with Turkish-specific ones
            // Verified: Ş=0xDE  İ=0xDD  ğ=0xF0  via ISO-8859-9 standard table
            it('iso-8859-9: encodes Turkish characters correctly', function() {
                assertWriteBuffer('iso-8859-9', '\u015Eis \u0130\u011F', [
                    0xDE, 0x69, 0x73, 0x20,  // Ş i s SP
                    0xDD, 0xF0,              // İ ğ
                ]);
            });

            // win1254 - Windows Turkish, nearly identical to ISO-8859-9
            // Verified: İ=0xDD  ş=0xFE  via windows-1254 standard table
            it('win1254: encodes Windows-1254 Turkish characters correctly', function() {
                assertWriteBuffer('win1254', '\u0130\u015F', [
                    0xDD, 0xFE,  // İ ş
                ]);
            });

            // ── Hebrew / Arabic ──────────────────────────────────────────────────
            // win1255 - used on Israeli IRC networks
            // Verified: ש=0xF9  ל=0xEC  ו=0xE5  ם=0xED  via windows-1255 standard table
            it('win1255: encodes Windows-1255 Hebrew characters correctly', function() {
                assertWriteBuffer('win1255', '\u05E9\u05DC\u05D5\u05DD', [
                    0xF9, 0xEC, 0xE5, 0xED,  // ש ל ו ם
                ]);
            });

            // win1256 - used on Arabic IRC networks
            // Verified: م=0xE3  ر=0xD1  ح=0xCD  ب=0xC8  ا=0xC7
            //           via windows-1256 standard table
            it('win1256: encodes Windows-1256 Arabic characters correctly', function() {
                assertWriteBuffer('win1256', '\u0645\u0631\u062D\u0628\u0627', [
                    0xE3, 0xD1, 0xCD, 0xC8, 0xC7,  // م ر ح ب ا
                ]);
            });

            // ── East Asian ───────────────────────────────────────────────────────
            // Shift-JIS - dominant encoding on Japanese IRC networks (IRCnet JP)
            // Verified: こ=[0x82,0xB1]  ん=[0x82,0xF1]  に=[0x82,0xC9]
            //           ち=[0x82,0xBF]  は=[0x82,0xCD]  via Shift-JIS standard table
            it('shiftjis: encodes Japanese (Shift-JIS) characters correctly', function() {
                assertWriteBuffer('shiftjis', '\u3053\u3093\u306B\u3061\u306F', [
                    0x82, 0xB1,  // こ
                    0x82, 0xF1,  // ん
                    0x82, 0xC9,  // に
                    0x82, 0xBF,  // ち
                    0x82, 0xCD,  // は
                ]);
            });

            // EUC-JP - alternative Japanese encoding on older IRC servers
            // Verified: 日=[0xC6,0xFC]  本=[0xCB,0xDC]  語=[0xB8,0xEC]
            //           via EUC-JP standard table
            it('euc-jp: encodes Japanese (EUC-JP) characters correctly', function() {
                assertWriteBuffer('euc-jp', '\u65E5\u672C\u8A9E', [
                    0xC6, 0xFC,  // 日
                    0xCB, 0xDC,  // 本
                    0xB8, 0xEC,  // 語
                ]);
            });

            // GBK / GB2312 - Simplified Chinese IRC networks
            // Verified: 你=[0xC4,0xE3]  好=[0xBA,0xC3]  via GBK standard table
            it('gbk: encodes Simplified Chinese characters correctly', function() {
                assertWriteBuffer('gbk', '\u4F60\u597D', [
                    0xC4, 0xE3,  // 你
                    0xBA, 0xC3,  // 好
                ]);
            });

            // Big5 - Traditional Chinese IRC networks (Taiwan, Hong Kong)
            // Verified: 你=[0xA7,0x41]  好=[0xA6,0x6E]  via Big5 standard table
            it('big5: encodes Traditional Chinese characters correctly', function() {
                assertWriteBuffer('big5', '\u4F60\u597D', [
                    0xA7, 0x41,  // 你
                    0xA6, 0x6E,  // 好
                ]);
            });

            // EUC-KR - Korean IRC networks
            // Verified: 안=[0xBE,0xC8]  녕=[0xB3,0xE7]  via EUC-KR standard table
            it('euc-kr: encodes Korean characters correctly', function() {
                assertWriteBuffer('euc-kr', '\uC548\uB155', [
                    0xBE, 0xC8,  // 안
                    0xB3, 0xE7,  // 녕
                ]);
            });

            // ── UTF-8 baseline ───────────────────────────────────────────────────
            // When encoding IS utf8, writeLine takes the plain string path (line 36),
            // so socket.write receives a plain string, not a Buffer.
            it('utf8 baseline: socket.write receives a plain string (not a Buffer)', function() {
                const conn = new Connection({});
                conn.socket = createMockSocket();
                conn.state = 2;
                conn.setEncoding('utf8');

                conn.writeLine('PRIVMSG #chan :\u3053\u3093\u306B\u3061\u306F');

                const [writeArg] = conn.socket.write.firstCall.args;
                assert.isString(writeArg);
                assert.equal(writeArg, 'PRIVMSG #chan :\u3053\u3093\u306B\u3061\u306F\r\n');
            });
        });
    });

    // ── setEncoding() ──────────────────────────────────────────────────────────
    describe('setEncoding()', function() {
        it('should accept utf8', function() {
            const conn = new Connection({});
            assert.isTrue(conn.setEncoding('utf8'));
            assert.equal(conn.encoding, 'utf8');
        });

        it('should accept latin1', function() {
            const conn = new Connection({});
            assert.isTrue(conn.setEncoding('latin1'));
            assert.equal(conn.encoding, 'latin1');
        });

        it('should accept win1251 (Cyrillic)', function() {
            const conn = new Connection({});
            assert.isTrue(conn.setEncoding('win1251'));
            assert.equal(conn.encoding, 'win1251');
        });

        it('should accept iso-8859-2 (Central/Eastern European)', function() {
            const conn = new Connection({});
            assert.isTrue(conn.setEncoding('iso-8859-2'));
        });

        it('should accept shiftjis', function() {
            const conn = new Connection({});
            assert.isTrue(conn.setEncoding('shiftjis'));
        });

        it('should accept gbk', function() {
            const conn = new Connection({});
            assert.isTrue(conn.setEncoding('gbk'));
        });

        it('should reject base64 (breaks IRC protocol framing)', function() {
            const conn = new Connection({});
            const result = conn.setEncoding('base64');
            assert.isFalse(result);
            // encoding must not have changed
            assert.equal(conn.encoding, 'utf8');
        });

        it('should reject a completely unknown encoding', function() {
            const conn = new Connection({});
            const result = conn.setEncoding('not-a-real-encoding');
            assert.isFalse(result);
        });

        it('should leave existing encoding unchanged on rejection', function() {
            const conn = new Connection({});
            conn.setEncoding('latin1');
            conn.setEncoding('base64'); // should fail
            assert.equal(conn.encoding, 'latin1');
        });
    });

    // ── onSocketData() with non-UTF8 encodings ─────────────────────────────────
    describe('onSocketData() - non-UTF8 decoding', function() {
        /**
         * Each test feeds a hardcoded byte buffer (whose bytes were derived from
         * canonical encoding tables and verified via Node's TextDecoder) directly
         * into onSocketData() and asserts that the emitted line contains the
         * expected Unicode text.  No Connection is used on the encode side.
         */
        function assertDecoded(encoding, inputBytes, expectedSubstring) {
            const conn = new Connection({});
            conn.incoming_buffer = Buffer.from('');
            conn.setEncoding(encoding);
            const lines = [];
            conn.on('line', l => lines.push(l));
            conn.onSocketData(Buffer.from(inputBytes));
            assert.equal(lines.length, 1, `expected 1 line emitted for ${encoding}`);
            assert.include(lines[0], expectedSubstring,
                `decoded line for ${encoding} should contain "${expectedSubstring}"`);
        }

        // latin1: é=0xE9  ö=0xF6 - "PRIVMSG #chan :H<é>llo W<ö>rld" + CRLF
        it('should decode latin1 data correctly', function() {
            assertDecoded('latin1', [
                // "PRIVMSG #chan :H" (ASCII)
                0x50, 0x52, 0x49, 0x56, 0x4D, 0x53, 0x47, 0x20, 0x23, 0x63, 0x68, 0x61, 0x6E, 0x20, 0x3A, 0x48,
                0xE9,                               // é
                0x6C, 0x6C, 0x6F, 0x20,               // llo SP
                0x57, 0xF6, 0x72, 0x6C, 0x64,          // Wörld
                0x0D, 0x0A,
            ], 'H\u00E9llo W\u00F6rld');
        });

        // win1251: П=0xCF  р=0xF0  и=0xE8  в=0xE2  е=0xE5  т=0xF2  м=0xEC
        it('should decode win1251 (Cyrillic) data correctly', function() {
            assertDecoded('win1251', [
                // "PRIVMSG #chan :" (ASCII)
                0x50, 0x52, 0x49, 0x56, 0x4D, 0x53, 0x47, 0x20, 0x23, 0x63, 0x68, 0x61, 0x6E, 0x20, 0x3A,
                0xCF, 0xF0, 0xE8, 0xE2, 0xE5, 0xF2, 0x20,  // Привет SP
                0xEC, 0xE8, 0xF0,                        // мир
                0x0D, 0x0A,
            ], '\u041F\u0440\u0438\u0432\u0435\u0442 \u043C\u0438\u0440');
        });

        // shiftjis: こ=[0x82,0xB1]  ん=[0x82,0xF1]  に=[0x82,0xC9]  ち=[0x82,0xBF]  は=[0x82,0xCD]
        it('should decode shiftjis (Japanese) data correctly', function() {
            assertDecoded('shiftjis', [
                // "PRIVMSG #chan :" (ASCII)
                0x50, 0x52, 0x49, 0x56, 0x4D, 0x53, 0x47, 0x20, 0x23, 0x63, 0x68, 0x61, 0x6E, 0x20, 0x3A,
                0x82, 0xB1,  // こ
                0x82, 0xF1,  // ん
                0x82, 0xC9,  // に
                0x82, 0xBF,  // ち
                0x82, 0xCD,  // は
                0x0D, 0x0A,
            ], '\u3053\u3093\u306B\u3061\u306F');
        });

        // gbk: 你=[0xC4,0xE3]  好=[0xBA,0xC3]
        it('should decode gbk (Simplified Chinese) data correctly', function() {
            assertDecoded('gbk', [
                // "PRIVMSG #chan :" (ASCII)
                0x50, 0x52, 0x49, 0x56, 0x4D, 0x53, 0x47, 0x20, 0x23, 0x63, 0x68, 0x61, 0x6E, 0x20, 0x3A,
                0xC4, 0xE3,  // 你
                0xBA, 0xC3,  // 好
                0x0D, 0x0A,
            ], '\u4F60\u597D');
        });

        // iso-8859-7: Γ=0xC3  ε=0xE5  ι=0xE9  α=0xE1  σ=0xF3  ο=0xEF  υ=0xF5
        it('should decode iso-8859-7 (Greek) data correctly', function() {
            assertDecoded('iso-8859-7', [
                // "PRIVMSG #chan :" (ASCII)
                0x50, 0x52, 0x49, 0x56, 0x4D, 0x53, 0x47, 0x20, 0x23, 0x63, 0x68, 0x61, 0x6E, 0x20, 0x3A,
                0xC3, 0xE5, 0xE9, 0xE1, 0x20,  // Γεια SP
                0xF3, 0xEF, 0xF5,            // σου
                0x0D, 0x0A,
            ], '\u0393\u03B5\u03B9\u03B1 \u03C3\u03BF\u03C5');
        });
    });
});
