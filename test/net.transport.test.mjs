import net from 'net';
import tls from 'tls';
import { EventEmitter } from 'events';
import { assert, expect, use as chaiUse } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

import Connection from '../src/transports/net.js';

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

        it('should emit raw socket connected event', function() {
            const conn = new Connection({});
            conn.socket = createMockSocket();
            const spy = sinon.spy();
            conn.on('extra', spy);
            conn.onSocketRawConnected();

            expect(spy).to.have.been.calledWith('raw socket connected', conn.socket);
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
    });
});
