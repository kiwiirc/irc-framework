import { assert, expect, use as chaiUse } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

import Connection from '../../src/transports/websocket.js';

chaiUse(sinonChai);

// ── WebSocket global mock ──────────────────────────────────────────────────────
// websocket.js uses the browser-global WebSocket constructor directly.
// We install a controllable stub on `global` before each test and remove it
// afterwards so tests are fully isolated.

function createMockWebSocket() {
    return {
        send: sinon.stub(),
        close: sinon.stub(),
        onopen: null,
        onclose: null,
        onmessage: null,
        onerror: null,
    };
}

describe('src/transports/websocket.js', function() {
    let sandbox;
    let mockWs;
    let WebSocketStub;

    beforeEach(function() {
        sandbox = sinon.createSandbox();
        mockWs = createMockWebSocket();
        // The stub acts as the constructor - every `new WebSocket(...)` returns
        // the same mockWs so tests can inspect calls on it directly.
        WebSocketStub = sinon.stub().returns(mockWs);
        global.WebSocket = WebSocketStub;
    });

    afterEach(function() {
        sandbox.restore();
        delete global.WebSocket;
    });

    // ── constructor ───────────────────────────────────────────────────────────
    describe('constructor', function() {
        it('should initialise connected to false', function() {
            const conn = new Connection({});
            assert.isFalse(conn.connected);
        });

        it('should initialise socket to null', function() {
            const conn = new Connection({});
            assert.isNull(conn.socket);
        });

        it('should initialise last_socket_error to null', function() {
            const conn = new Connection({});
            assert.isNull(conn.last_socket_error);
        });

        it('should initialise encoding to utf8', function() {
            // WebSocket text frames are always UTF-8
            const conn = new Connection({});
            assert.equal(conn.encoding, 'utf8');
        });

        it('should initialise incoming_buffer to empty string', function() {
            const conn = new Connection({});
            assert.equal(conn.incoming_buffer, '');
        });

        it('should initialise protocol_fallback to false', function() {
            const conn = new Connection({});
            assert.isFalse(conn.protocol_fallback);
        });

        it('should set protocol to undefined when websocket_protocol is not provided', function() {
            // undefined protocol is intentional: the caller (higher-level code) is
            // responsible for requesting IRCv3 subprotocols and retrying without one
            // if the server does not support them
            const conn = new Connection({});
            assert.isUndefined(conn.protocol);
        });

        it('should set protocol to undefined when websocket_protocol is an empty string', function() {
            // Falsy values are treated as "no protocol" - see source comment
            const conn = new Connection({ websocket_protocol: '' });
            assert.isUndefined(conn.protocol);
        });

        it('should set protocol to undefined when websocket_protocol is 0', function() {
            const conn = new Connection({ websocket_protocol: 0 });
            assert.isUndefined(conn.protocol);
        });

        it('should set protocol from websocket_protocol when provided', function() {
            // e.g. caller passes 'text.ircv3.net' for an IRCv3-aware connection
            const conn = new Connection({ websocket_protocol: 'text.ircv3.net' });
            assert.equal(conn.protocol, 'text.ircv3.net');
        });

        it('should default options to empty object when passed explicitly', function() {
            const conn = new Connection({});
            assert.deepEqual(conn.options, {});
        });

        it('should throw when called with no arguments', function() {
            // options.websocket_protocol is accessed before the options || {} guard
            // can take effect, so undefined options causes an immediate TypeError
            assert.throws(() => new Connection(), TypeError);
        });
    });

    // ── isConnected() ─────────────────────────────────────────────────────────
    describe('isConnected()', function() {
        it('should return false initially', function() {
            assert.isFalse(new Connection({}).isConnected());
        });

        it('should return true after connected is set', function() {
            const conn = new Connection({});
            conn.connected = true;
            assert.isTrue(conn.isConnected());
        });
    });

    // ── connect() ─────────────────────────────────────────────────────────────
    describe('connect()', function() {
        describe('WebSocket URL construction', function() {
            it('should use ws:// scheme by default', function() {
                new Connection({ host: 'irc.example.com' }).connect();
                assert.equal(WebSocketStub.firstCall.args[0], 'ws://irc.example.com');
            });

            it('should use wss:// when tls option is set', function() {
                new Connection({ host: 'irc.example.com', tls: true }).connect();
                assert.isTrue(WebSocketStub.firstCall.args[0].startsWith('wss://'));
            });

            it('should use wss:// when ssl option is set', function() {
                new Connection({ host: 'irc.example.com', ssl: true }).connect();
                assert.isTrue(WebSocketStub.firstCall.args[0].startsWith('wss://'));
            });

            it('should append port when provided', function() {
                new Connection({ host: 'irc.example.com', port: 8080 }).connect();
                assert.equal(WebSocketStub.firstCall.args[0], 'ws://irc.example.com:8080');
            });

            it('should not append port when not provided', function() {
                new Connection({ host: 'irc.example.com' }).connect();
                assert.equal(WebSocketStub.firstCall.args[0], 'ws://irc.example.com');
            });

            it('should append path when provided', function() {
                new Connection({ host: 'irc.example.com', path: '/irc' }).connect();
                assert.equal(WebSocketStub.firstCall.args[0], 'ws://irc.example.com/irc');
            });

            it('should not append path when not provided', function() {
                new Connection({ host: 'irc.example.com' }).connect();
                assert.equal(WebSocketStub.firstCall.args[0], 'ws://irc.example.com');
            });

            it('should combine host, port and path correctly with wss', function() {
                new Connection({ host: 'irc.example.com', port: 443, path: '/webirc', tls: true }).connect();
                assert.equal(WebSocketStub.firstCall.args[0], 'wss://irc.example.com:443/webirc');
            });
        });

        describe('WebSocket subprotocol argument', function() {
            it('should pass undefined to WebSocket constructor when no protocol is set', function() {
                // No subprotocol - compatible with pre-IRCv3 servers. Higher-level
                // code handles the retry-with-protocol / retry-without-protocol logic.
                new Connection({ host: 'irc.example.com' }).connect();
                assert.isUndefined(WebSocketStub.firstCall.args[1]);
            });

            it('should pass the protocol to WebSocket constructor when set', function() {
                // e.g. first attempt with 'text.ircv3.net'
                new Connection({ host: 'irc.example.com', websocket_protocol: 'text.ircv3.net' }).connect();
                assert.equal(WebSocketStub.firstCall.args[1], 'text.ircv3.net');
            });
        });

        describe('socket assignment and state', function() {
            it('should assign the new WebSocket instance to this.socket', function() {
                const conn = new Connection({ host: 'irc.example.com' });
                conn.connect();
                assert.equal(conn.socket, mockWs);
            });

            it('should set requested_disconnect to false', function() {
                const conn = new Connection({ host: 'irc.example.com' });
                conn.requested_disconnect = true;
                conn.connect();
                assert.isFalse(conn.requested_disconnect);
            });

            it('should call disposeSocket before creating the new WebSocket', function() {
                const conn = new Connection({ host: 'irc.example.com' });
                const disposeSpy = sinon.spy(conn, 'disposeSocket');
                conn.connect();
                assert.isTrue(disposeSpy.calledBefore(WebSocketStub));
            });
        });

        describe('event handler wiring', function() {
            it('should attach a function to onopen', function() {
                new Connection({ host: 'irc.example.com' }).connect();
                assert.isFunction(mockWs.onopen);
            });

            it('should attach a function to onclose', function() {
                new Connection({ host: 'irc.example.com' }).connect();
                assert.isFunction(mockWs.onclose);
            });

            it('should attach a function to onmessage', function() {
                new Connection({ host: 'irc.example.com' }).connect();
                assert.isFunction(mockWs.onmessage);
            });

            it('should attach a function to onerror', function() {
                new Connection({ host: 'irc.example.com' }).connect();
                assert.isFunction(mockWs.onerror);
            });

            it('onopen should call onSocketFullyConnected', function() {
                const conn = new Connection({ host: 'irc.example.com' });
                conn.connect();
                const spy = sinon.spy(conn, 'onSocketFullyConnected');
                mockWs.onopen();
                expect(spy).to.have.been.calledOnce;
            });

            it('onclose should call onSocketClose with the event object', function() {
                const conn = new Connection({ host: 'irc.example.com' });
                conn.connect();
                const spy = sinon.spy(conn, 'onSocketClose');
                const event = { code: 1000 };
                mockWs.onclose(event);
                expect(spy).to.have.been.calledOnceWith(event);
            });

            it('onmessage should call onSocketMessage with event.data', function() {
                const conn = new Connection({ host: 'irc.example.com' });
                conn.connect();
                const spy = sinon.spy(conn, 'onSocketMessage');
                mockWs.onmessage({ data: 'PING :server' });
                expect(spy).to.have.been.calledOnceWith('PING :server');
            });

            it('onerror should store the error in last_socket_error', function() {
                const conn = new Connection({ host: 'irc.example.com' });
                conn.connect();
                const err = new Error('connection refused');
                mockWs.onerror(err);
                assert.equal(conn.last_socket_error, err);
            });

            it('onerror should emit a debug event', function() {
                const conn = new Connection({ host: 'irc.example.com' });
                conn.connect();
                const debugSpy = sinon.spy();
                conn.on('debug', debugSpy);
                mockWs.onerror(new Error('refused'));
                expect(debugSpy).to.have.been.called;
            });
        });
    });

    // ── onSocketFullyConnected() ──────────────────────────────────────────────
    describe('onSocketFullyConnected()', function() {
        it('should set connected to true', function() {
            const conn = new Connection({});
            conn.onSocketFullyConnected();
            assert.isTrue(conn.connected);
        });

        it('should clear last_socket_error', function() {
            const conn = new Connection({});
            conn.last_socket_error = new Error('previous error');
            conn.onSocketFullyConnected();
            assert.isNull(conn.last_socket_error);
        });

        it('should emit open', function() {
            const conn = new Connection({});
            const spy = sinon.spy();
            conn.on('open', spy);
            conn.onSocketFullyConnected();
            expect(spy).to.have.been.calledOnce;
        });
    });

    // ── onSocketClose() ───────────────────────────────────────────────────────
    describe('onSocketClose()', function() {
        describe('normal close', function() {
            it('should set connected to false', function() {
                const conn = new Connection({});
                conn.connected = true;
                conn.onSocketClose({ code: 1000 });
                assert.isFalse(conn.connected);
            });

            it('should emit close with false when there is no last_socket_error', function() {
                const conn = new Connection({});
                const spy = sinon.spy();
                conn.on('close', spy);
                conn.onSocketClose({ code: 1000 });
                expect(spy).to.have.been.calledOnceWith(false);
            });

            it('should emit close with the error when last_socket_error is set', function() {
                const conn = new Connection({});
                const err = new Error('broken pipe');
                conn.last_socket_error = err;
                const spy = sinon.spy();
                conn.on('close', spy);
                conn.onSocketClose({ code: 1000 });
                expect(spy).to.have.been.calledOnceWith(err);
            });

            it('should not retry when code 1006 fires but socket was already connected', function() {
                // possible_protocol_error requires !this.connected - if the socket
                // successfully opened, code 1006 is a genuine network drop, not a
                // subprotocol rejection
                const conn = new Connection({ host: 'irc.example.com', websocket_protocol: 'text.ircv3.net' });
                conn.connect();
                conn.connected = true;
                const connectSpy = sinon.spy(conn, 'connect');
                conn.onSocketClose({ code: 1006 });
                expect(connectSpy).to.not.have.been.called;
            });

            it('should not retry when close code is not 1006', function() {
                const conn = new Connection({ host: 'irc.example.com', websocket_protocol: 'text.ircv3.net' });
                conn.connect();
                const connectSpy = sinon.spy(conn, 'connect');
                conn.onSocketClose({ code: 1000 });
                expect(connectSpy).to.not.have.been.called;
            });
        });

        describe('subprotocol fallback (code 1006, never connected, protocol set)', function() {
            // When a connection using a specific subprotocol closes immediately with
            // code 1006 before ever opening, it likely means the server does not
            // support that subprotocol (e.g. a pre-IRCv3 server rejecting
            // 'text.ircv3.net'). The transport retries without any subprotocol for
            // compatibility. All four conditions must hold: !connected, code===1006,
            // !protocol_fallback, protocol !== undefined.

            it('should call connect() again to retry without a subprotocol', function() {
                const conn = new Connection({ host: 'irc.example.com', websocket_protocol: 'text.ircv3.net' });
                conn.connect();
                const connectSpy = sinon.spy(conn, 'connect');
                conn.onSocketClose({ code: 1006 });
                expect(connectSpy).to.have.been.calledOnce;
            });

            it('should set protocol to undefined before retrying', function() {
                const conn = new Connection({ host: 'irc.example.com', websocket_protocol: 'text.ircv3.net' });
                conn.connect();
                conn.onSocketClose({ code: 1006 });
                assert.isUndefined(conn.protocol);
            });

            it('should set protocol_fallback to true', function() {
                const conn = new Connection({ host: 'irc.example.com', websocket_protocol: 'text.ircv3.net' });
                conn.connect();
                conn.onSocketClose({ code: 1006 });
                assert.isTrue(conn.protocol_fallback);
            });

            it('should not emit close when retrying', function() {
                const conn = new Connection({ host: 'irc.example.com', websocket_protocol: 'text.ircv3.net' });
                conn.connect();
                const closeSpy = sinon.spy();
                conn.on('close', closeSpy);
                conn.onSocketClose({ code: 1006 });
                expect(closeSpy).to.not.have.been.called;
            });

            it('should pass undefined protocol to the retry WebSocket constructor call', function() {
                const conn = new Connection({ host: 'irc.example.com', websocket_protocol: 'text.ircv3.net' });
                conn.connect();
                conn.onSocketClose({ code: 1006 });
                assert.isUndefined(WebSocketStub.secondCall.args[1]);
            });

            it('should not retry a second time when protocol_fallback is already true', function() {
                const conn = new Connection({ host: 'irc.example.com', websocket_protocol: 'text.ircv3.net' });
                conn.connect();
                conn.onSocketClose({ code: 1006 }); // first retry - sets protocol_fallback = true
                const connectSpy = sinon.spy(conn, 'connect');
                conn.onSocketClose({ code: 1006 }); // second abnormal close - must not retry again
                expect(connectSpy).to.not.have.been.called;
            });

            it('should not retry when protocol is already undefined', function() {
                // Connection was made without a subprotocol - there is nothing to
                // fall back from, so a code 1006 close is a genuine failure
                const conn = new Connection({ host: 'irc.example.com' });
                conn.connect();
                const connectSpy = sinon.spy(conn, 'connect');
                conn.onSocketClose({ code: 1006 });
                expect(connectSpy).to.not.have.been.called;
            });
        });
    });

    // ── onSocketMessage() ─────────────────────────────────────────────────────
    describe('onSocketMessage()', function() {
        describe('binary data rejection', function() {
            // The text subprotocol only handles UTF-8 string frames. Binary data
            // indicates either a protocol mismatch or a misbehaving peer.

            it('should set last_socket_error when data is not a string', function() {
                const conn = new Connection({});
                conn.onSocketMessage(Buffer.from('hello'));
                assert.instanceOf(conn.last_socket_error, Error);
                assert.include(conn.last_socket_error.message, 'binary');
            });

            it('should call close() when data is not a string', function() {
                const conn = new Connection({});
                const ws = createMockWebSocket();
                conn.socket = ws;
                conn.connected = true;
                conn.onSocketMessage(new Uint8Array([1, 2, 3]));
                expect(ws.close).to.have.been.calledOnce;
            });

            it('should not emit any line events when data is not a string', function() {
                const conn = new Connection({});
                const lineSpy = sinon.spy();
                conn.on('line', lineSpy);
                conn.onSocketMessage(42);
                expect(lineSpy).to.not.have.been.called;
            });

            it('should not emit any line events for a Buffer', function() {
                const conn = new Connection({});
                const lineSpy = sinon.spy();
                conn.on('line', lineSpy);
                conn.onSocketMessage(Buffer.from(':server PING :x'));
                expect(lineSpy).to.not.have.been.called;
            });
        });

        describe('line splitting', function() {
            // A single WebSocket message may contain multiple IRC lines separated
            // by '\n'. Each must be emitted as a separate line event. This handles
            // both spec-compliant servers (one line per message) and peers that
            // batch multiple lines into one message.

            it('should emit one line for a single IRC message', function() {
                const conn = new Connection({});
                const lines = [];
                conn.on('line', l => lines.push(l));
                conn.onSocketMessage('PING :server');
                assert.deepEqual(lines, ['PING :server']);
            });

            it('should split a message containing multiple newline-separated lines', function() {
                // Defensive handling: some peers send multiple IRC lines in one frame
                const conn = new Connection({});
                const lines = [];
                conn.on('line', l => lines.push(l));
                conn.onSocketMessage(':s PRIVMSG #a :one\n:s PRIVMSG #b :two\n:s PRIVMSG #c :three');
                assert.deepEqual(lines, [
                    ':s PRIVMSG #a :one',
                    ':s PRIVMSG #b :two',
                    ':s PRIVMSG #c :three',
                ]);
            });

            it('should emit one line per successive message', function() {
                const conn = new Connection({});
                const lines = [];
                conn.on('line', l => lines.push(l));
                conn.onSocketMessage(':server 001 nick :Welcome');
                conn.onSocketMessage(':server 002 nick :Host');
                assert.deepEqual(lines, [':server 001 nick :Welcome', ':server 002 nick :Host']);
            });

            it('should emit an empty line when a message ends with a newline', function() {
                // data = 'PING :server\n', after appending '\n': 'PING :server\n\n'
                // split('\n') -> ['PING :server', '', '']
                // else branch: pop trailing '' and clear buffer
                // remaining ['PING :server', ''] are both emitted - the empty string
                // represents the blank line between the newline and the appended '\n'
                const conn = new Connection({});
                const lines = [];
                conn.on('line', l => lines.push(l));
                conn.onSocketMessage('PING :server\n');
                assert.deepEqual(lines, ['PING :server', '']);
            });

            it('should clear incoming_buffer after a complete message', function() {
                const conn = new Connection({});
                conn.on('line', () => {});
                conn.onSocketMessage('PING :server');
                assert.equal(conn.incoming_buffer, '');
            });

            it('should preserve UTF-8 content exactly', function() {
                const conn = new Connection({});
                const lines = [];
                conn.on('line', l => lines.push(l));
                const msg = ':nick PRIVMSG #chan :caf\u00E9 \u4F60\u597D \u041F\u0440\u0438\u0432\u0435\u0442';
                conn.onSocketMessage(msg);
                assert.deepEqual(lines, [msg]);
            });
        });

        describe('incoming_buffer accumulation (line 131)', function() {
            // incoming_buffer persists across calls. If a previous call left a
            // non-newline-terminated remainder in the buffer (line 131), the next
            // call prepends it to the new data before splitting.
            //
            // Because onSocketMessage always appends data + '\n', the combined
            // buffer always ends with '\n', making the last split element always ''.
            // Line 131 (the if-branch) can only be reached by pre-loading
            // incoming_buffer with a value that, after the internal += and split,
            // leaves a non-empty last element - which requires intercepting the
            // assignment. The test uses Object.defineProperty to do this, exercising
            // the branch as the code intends: saving a partial line for the next call.

            it('should prepend buffered content to the next message', function() {
                const conn = new Connection({});
                const lines = [];
                conn.on('line', l => lines.push(l));
                // Manually set a partial line in the buffer as if a previous message
                // left it there, then deliver the rest as a new message
                conn.incoming_buffer = ':server PRIV';
                conn.onSocketMessage('MSG #chan :hello');
                // buffer becomes ':server PRIVMSG #chan :hello\n'
                // split -> [':server PRIVMSG #chan :hello', ''] -> else branch clears
                assert.deepEqual(lines, [':server PRIVMSG #chan :hello']);
                assert.equal(conn.incoming_buffer, '');
            });

            it('should save a partial line back into incoming_buffer when split leaves a non-empty tail (line 131)', function() {
                // Line 131 is the defensive save-back path. We use Object.defineProperty
                // to strip the trailing '\n' from the internal += assignment so the
                // split produces a non-empty last element, triggering the if-branch.
                const conn = new Connection({});
                const lines = [];
                conn.on('line', l => lines.push(l));

                let raw = '';
                let calls = 0;
                Object.defineProperty(conn, 'incoming_buffer', {
                    get: () => raw,
                    set: (v) => {
                        // Strip the trailing '\n' on the first (+=) assignment only
                        raw = (++calls === 1 && v.endsWith('\n')) ? v.slice(0, -1) : v;
                    },
                    configurable: true,
                });

                conn.onSocketMessage('complete\npartial');
                // After stripping: buffer = 'complete\npartial'
                // split('\n') = ['complete', 'partial']
                // last element 'partial' !== '' -> if-branch fires:
                //   incoming_buffer = lines.pop() = 'partial'
                //   only 'complete' is emitted
                assert.deepEqual(lines, ['complete']);
                assert.equal(conn.incoming_buffer, 'partial');
            });
        });
    });

    // ── writeLine() ───────────────────────────────────────────────────────────
    describe('writeLine()', function() {
        it('should call socket.send with the line when connected', function() {
            const conn = new Connection({});
            conn.socket = createMockWebSocket();
            conn.connected = true;
            conn.writeLine('PRIVMSG #chan :hello');
            expect(conn.socket.send).to.have.been.calledOnceWith('PRIVMSG #chan :hello');
        });

        it('should not call socket.send when not connected', function() {
            const conn = new Connection({});
            conn.socket = createMockWebSocket();
            conn.connected = false;
            conn.writeLine('PRIVMSG #chan :hello');
            expect(conn.socket.send).to.not.have.been.called;
        });

        it('should not call socket.send when socket is null', function() {
            const conn = new Connection({});
            conn.socket = null;
            conn.connected = true;
            assert.doesNotThrow(() => conn.writeLine('PING'));
        });

        it('should send the line as-is without any modification', function() {
            // The transport does not strip \r\n - that is the responsibility of the
            // caller. Peers not following the spec may require \r\n to be present.
            const conn = new Connection({});
            conn.socket = createMockWebSocket();
            conn.connected = true;
            const msg = ':nick!user@host PRIVMSG #chan :caf\u00E9 \u4F60\u597D';
            conn.writeLine(msg);
            expect(conn.socket.send).to.have.been.calledOnceWith(msg);
        });

        it('should invoke the callback via setTimeout when connected', function(done) {
            const conn = new Connection({});
            conn.socket = createMockWebSocket();
            conn.connected = true;
            conn.writeLine('PING', done);
        });

        it('should invoke the callback via setTimeout even when not connected', function(done) {
            // Unlike net.js, the websocket transport always fires the callback
            // regardless of connected state
            const conn = new Connection({});
            conn.socket = null;
            conn.connected = false;
            conn.writeLine('PING', done);
        });

        it('should not throw when no callback is provided', function() {
            const conn = new Connection({});
            conn.socket = createMockWebSocket();
            conn.connected = true;
            assert.doesNotThrow(() => conn.writeLine('PING'));
        });
    });

    // ── disposeSocket() ───────────────────────────────────────────────────────
    describe('disposeSocket()', function() {
        it('should call socket.close when socket exists and is connected', function() {
            const conn = new Connection({});
            const ws = createMockWebSocket();
            conn.socket = ws;
            conn.connected = true;
            conn.disposeSocket();
            expect(ws.close).to.have.been.calledOnce;
        });

        it('should not call socket.close when socket exists but is not connected', function() {
            const conn = new Connection({});
            const ws = createMockWebSocket();
            conn.socket = ws;
            conn.connected = false;
            conn.disposeSocket();
            expect(ws.close).to.not.have.been.called;
        });

        it('should null out all event handler properties on the socket', function() {
            const conn = new Connection({});
            const ws = createMockWebSocket();
            ws.onopen = () => {};
            ws.onclose = () => {};
            ws.onmessage = () => {};
            ws.onerror = () => {};
            conn.socket = ws;
            conn.connected = false;
            conn.disposeSocket();
            assert.isNull(ws.onopen);
            assert.isNull(ws.onclose);
            assert.isNull(ws.onmessage);
            assert.isNull(ws.onerror);
        });

        it('should set this.socket to null', function() {
            const conn = new Connection({});
            conn.socket = createMockWebSocket();
            conn.connected = false;
            conn.disposeSocket();
            assert.isNull(conn.socket);
        });

        it('should do nothing when socket is already null', function() {
            const conn = new Connection({});
            conn.socket = null;
            assert.doesNotThrow(() => conn.disposeSocket());
        });

        it('should close the existing socket when connect() is called a second time', function() {
            const conn = new Connection({ host: 'irc.example.com' });
            conn.connect();
            const firstWs = conn.socket;
            conn.connected = true;

            const secondMockWs = createMockWebSocket();
            WebSocketStub.returns(secondMockWs);

            conn.connect();
            expect(firstWs.close).to.have.been.calledOnce;
        });
    });

    // ── close() ───────────────────────────────────────────────────────────────
    describe('close()', function() {
        it('should call socket.close when socket exists and is connected', function() {
            const conn = new Connection({});
            conn.socket = createMockWebSocket();
            conn.connected = true;
            conn.close();
            expect(conn.socket.close).to.have.been.calledOnce;
        });

        it('should not call socket.close when not connected', function() {
            const conn = new Connection({});
            const ws = createMockWebSocket();
            conn.socket = ws;
            conn.connected = false;
            conn.close();
            expect(ws.close).to.not.have.been.called;
        });

        it('should not call socket.close when socket is null', function() {
            const conn = new Connection({});
            conn.socket = null;
            conn.connected = true;
            assert.doesNotThrow(() => conn.close());
        });
    });

    // ── setEncoding() ─────────────────────────────────────────────────────────
    describe('setEncoding()', function() {
        it('should be a no-op - WebSocket text frames are always UTF-8', function() {
            // Exists for interface compatibility with the net transport
            const conn = new Connection({});
            conn.setEncoding('latin1');
            assert.equal(conn.encoding, 'utf8');
        });

        it('should not throw for any argument', function() {
            const conn = new Connection({});
            assert.doesNotThrow(() => conn.setEncoding('shiftjis'));
            assert.doesNotThrow(() => conn.setEncoding(null));
            assert.doesNotThrow(() => conn.setEncoding(undefined));
        });

        it('should return undefined (no return value)', function() {
            const conn = new Connection({});
            assert.isUndefined(conn.setEncoding('utf8'));
        });
    });

    // ── debugOut() ────────────────────────────────────────────────────────────
    describe('debugOut()', function() {
        it('should emit a debug event with the provided string', function() {
            const conn = new Connection({});
            const spy = sinon.spy();
            conn.on('debug', spy);
            conn.debugOut('test message');
            expect(spy).to.have.been.calledOnceWith('test message');
        });
    });
});
