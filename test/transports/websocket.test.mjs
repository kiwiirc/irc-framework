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
        send:      sinon.stub(),
        close:     sinon.stub(),
        onopen:    null,
        onclose:   null,
        onmessage: null,
        onerror:   null,
    };
}

describe('src/transports/websocket.js', function() {
    let sandbox;
    let mockWs;
    let WebSocketStub;

    beforeEach(function() {
        sandbox       = sinon.createSandbox();
        mockWs        = createMockWebSocket();
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
            // WebSocket is text-only; encoding is fixed at utf8 and never changes
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

        it('should set protocol from websocket_protocol option', function() {
            const conn = new Connection({ websocket_protocol: 'irc' });
            assert.equal(conn.protocol, 'irc');
        });

        it('should set protocol to undefined when websocket_protocol is not provided', function() {
            const conn = new Connection({});
            assert.isUndefined(conn.protocol);
        });

        it('should set protocol to undefined when websocket_protocol is an empty string', function() {
            // Empty string is falsy - the comment in source explicitly covers this case
            const conn = new Connection({ websocket_protocol: '' });
            assert.isUndefined(conn.protocol);
        });

        it('should set protocol to undefined when websocket_protocol is 0', function() {
            const conn = new Connection({ websocket_protocol: 0 });
            assert.isUndefined(conn.protocol);
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

        describe('WebSocket protocol argument', function() {
            it('should pass protocol to WebSocket constructor when set', function() {
                new Connection({ host: 'irc.example.com', websocket_protocol: 'irc' }).connect();
                assert.equal(WebSocketStub.firstCall.args[1], 'irc');
            });

            it('should pass undefined to WebSocket constructor when no protocol is set', function() {
                new Connection({ host: 'irc.example.com' }).connect();
                assert.isUndefined(WebSocketStub.firstCall.args[1]);
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
                // possible_protocol_error requires !this.connected - if connected
                // was true the condition is false even with code 1006
                const conn = new Connection({ host: 'irc.example.com', websocket_protocol: 'irc' });
                conn.connect();
                conn.connected = true;
                const connectSpy = sinon.spy(conn, 'connect');
                conn.onSocketClose({ code: 1006 });
                expect(connectSpy).to.not.have.been.called;
            });

            it('should not retry when code is not 1006', function() {
                const conn = new Connection({ host: 'irc.example.com', websocket_protocol: 'irc' });
                conn.connect();
                const connectSpy = sinon.spy(conn, 'connect');
                conn.onSocketClose({ code: 1000 });
                expect(connectSpy).to.not.have.been.called;
            });
        });

        describe('protocol fallback (code 1006, never connected, protocol set)', function() {
            // The fallback triggers only when ALL of these are true:
            //   !this.connected  (first attempt never reached open)
            //   event.code === 1006  (abnormal closure)
            //   !this.protocol_fallback  (not already retried)
            //   this.protocol !== undefined  (there is a protocol to drop)

            it('should call connect() again to retry without a protocol', function() {
                const conn = new Connection({ host: 'irc.example.com', websocket_protocol: 'irc' });
                conn.connect();
                const connectSpy = sinon.spy(conn, 'connect');
                conn.onSocketClose({ code: 1006 });
                expect(connectSpy).to.have.been.calledOnce;
            });

            it('should set protocol to undefined before retrying', function() {
                const conn = new Connection({ host: 'irc.example.com', websocket_protocol: 'irc' });
                conn.connect();
                conn.onSocketClose({ code: 1006 });
                assert.isUndefined(conn.protocol);
            });

            it('should set protocol_fallback to true', function() {
                const conn = new Connection({ host: 'irc.example.com', websocket_protocol: 'irc' });
                conn.connect();
                conn.onSocketClose({ code: 1006 });
                assert.isTrue(conn.protocol_fallback);
            });

            it('should not emit close when retrying', function() {
                const conn = new Connection({ host: 'irc.example.com', websocket_protocol: 'irc' });
                conn.connect();
                const closeSpy = sinon.spy();
                conn.on('close', closeSpy);
                conn.onSocketClose({ code: 1006 });
                expect(closeSpy).to.not.have.been.called;
            });

            it('should pass undefined protocol to the retry WebSocket constructor call', function() {
                const conn = new Connection({ host: 'irc.example.com', websocket_protocol: 'irc' });
                conn.connect();
                conn.onSocketClose({ code: 1006 });
                // Second WebSocket constructor call is the retry
                assert.isUndefined(WebSocketStub.secondCall.args[1]);
            });

            it('should not retry a second time when protocol_fallback is already true', function() {
                const conn = new Connection({ host: 'irc.example.com', websocket_protocol: 'irc' });
                conn.connect();
                conn.onSocketClose({ code: 1006 }); // triggers retry, sets protocol_fallback = true
                const connectSpy = sinon.spy(conn, 'connect');
                conn.onSocketClose({ code: 1006 }); // second abnormal close - must not retry again
                expect(connectSpy).to.not.have.been.called;
            });

            it('should not retry when protocol is already undefined', function() {
                // No protocol was ever set - nothing to fall back from
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

        describe('line splitting - utf-8 text messages', function() {
            // WebSocket messages are always complete UTF-8 text frames.
            // The transport appends '\n' to each received message then splits on
            // '\n', so a single message always produces at least one emitted line.

            it('should emit one line for a single IRC message', function() {
                const conn = new Connection({});
                const lines = [];
                conn.on('line', l => lines.push(l));
                conn.onSocketMessage(':server PING :12345');
                assert.deepEqual(lines, [':server PING :12345']);
            });

            it('should preserve the line content exactly, including any \\r', function() {
                // The transport splits on \n only; \r is part of the emitted string
                const conn = new Connection({});
                const lines = [];
                conn.on('line', l => lines.push(l));
                conn.onSocketMessage(':server PING :12345\r');
                assert.deepEqual(lines, [':server PING :12345\r']);
            });

            it('should emit multiple lines when a message contains an embedded newline', function() {
                // Two IRC messages packed into one WebSocket frame
                const conn = new Connection({});
                const lines = [];
                conn.on('line', l => lines.push(l));
                conn.onSocketMessage(':s PRIVMSG #a :one\n:s PRIVMSG #b :two');
                assert.deepEqual(lines, [':s PRIVMSG #a :one', ':s PRIVMSG #b :two']);
            });

            it('should emit lines from multiple successive calls', function() {
                const conn = new Connection({});
                const lines = [];
                conn.on('line', l => lines.push(l));
                conn.onSocketMessage(':server 001 nick :Welcome');
                conn.onSocketMessage(':server 002 nick :Host');
                assert.deepEqual(lines, [':server 001 nick :Welcome', ':server 002 nick :Host']);
            });

            it('should clear incoming_buffer to empty string after a complete message', function() {
                const conn = new Connection({});
                conn.on('line', () => {});
                conn.onSocketMessage(':server PING :x');
                assert.equal(conn.incoming_buffer, '');
            });

            it('should prepend existing incoming_buffer content to the new message', function() {
                // Simulate a partial line already sitting in the buffer, then
                // deliver the rest of the line as a new message.
                const conn = new Connection({});
                const lines = [];
                conn.on('line', l => lines.push(l));
                conn.incoming_buffer = ':server PRIV';
                conn.onSocketMessage('MSG #chan :hello');
                // buffer becomes ':server PRIVMSG #chan :hello\n'
                // split -> [':server PRIVMSG #chan :hello', '']
                // last element is '' -> else branch fires: pop, clear, emit
                assert.deepEqual(lines, [':server PRIVMSG #chan :hello']);
                assert.equal(conn.incoming_buffer, '');
            });

            it('should save a partial line back to incoming_buffer when split leaves a non-empty tail (line 131)', function() {
                // The if-branch on line 130 is designed to handle the case where
                // the buffer contains an incomplete line with no trailing newline.
                // Because onSocketMessage always appends data + '\n', a call through
                // the normal API always ends with '\n', making the last split element
                // always ''. Line 131 can therefore only be reached by intercepting
                // the internal buffer state between the += and the split.
                //
                // We use Object.defineProperty to strip the trailing '\n' on the
                // first assignment so the split sees a non-empty last element,
                // exercising the save-remainder path exactly as intended.
                const conn = new Connection({});
                const lines = [];
                conn.on('line', l => lines.push(l));

                let raw = '';
                let calls = 0;
                Object.defineProperty(conn, 'incoming_buffer', {
                    get: () => raw,
                    set: (v) => {
                        // Strip the trailing '\n' on the first (+=) assignment only,
                        // so the split produces a non-empty last element
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

            it('should handle an empty string message', function() {
                // '' + '\n' = '\n', split('\n') = ['', '']
                // last is '' -> else: pop, clear, emit ['']
                const conn = new Connection({});
                const lines = [];
                conn.on('line', l => lines.push(l));
                conn.onSocketMessage('');
                assert.deepEqual(lines, ['']);
            });

            it('should handle utf-8 text content without modification', function() {
                // WebSocket always delivers utf-8; the transport must not transform it
                const conn = new Connection({});
                const lines = [];
                conn.on('line', l => lines.push(l));
                const msg = ':nick!user@host PRIVMSG #chan :caf\u00E9 \u4F60\u597D \u041F\u0440\u0438\u0432\u0435\u0442';
                conn.onSocketMessage(msg);
                assert.deepEqual(lines, [msg]);
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

        it('should send the line as-is without any encoding transformation', function() {
            // WebSocket is always utf-8; writeLine must not modify the string at all
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
            ws.onopen    = () => {};
            ws.onclose   = () => {};
            ws.onmessage = () => {};
            ws.onerror   = () => {};
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
            // connect() calls disposeSocket() before creating the new WebSocket
            // verify the first socket is closed during the reconnect
            const conn = new Connection({ host: 'irc.example.com' });
            conn.connect();
            const firstWs = conn.socket;
            conn.connected = true; // mark as open so disposeSocket calls close()

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
        it('should be a no-op - WebSocket is always utf-8 text only', function() {
            // The method exists for interface compatibility with the net transport
            // but intentionally does nothing: encoding is always utf-8
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
