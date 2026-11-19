'use strict';

/* globals describe, it, beforeEach, afterEach */
const EventEmitter = require('eventemitter3');
const chai = require('chai');
const sinon = require('sinon');
const assert = chai.assert;

const Connection = require('../src/connection');

// A transport the test drives by hand: each connect() is recorded, and the
// test emits 'open' and 'close' on the most recent one.
let transports = [];

class FakeTransport extends EventEmitter {
    constructor() {
        super();
        transports.push(this);
    }

    connect() {}
    disposeSocket() {}
    setEncoding() {
        return true;
    }

    writeLine() {}
}

function lastTransport() {
    return transports[transports.length - 1];
}

describe('src/connection.js reconnect', function() {
    let clock;
    let conn;
    let reconnecting;
    let closed;

    beforeEach(function() {
        transports = [];
        clock = sinon.useFakeTimers({ now: 1000000 });
        conn = new Connection({
            transport: FakeTransport,
            auto_reconnect: true,
            auto_reconnect_max_retries: 3,
            auto_reconnect_max_wait: 10000,
        });
        reconnecting = [];
        closed = 0;
        conn.on('reconnecting', (e) => reconnecting.push(e.attempt));
        conn.on('close', () => closed++);
    });

    afterEach(function() {
        clock.restore();
    });

    // Fail the current connection attempt and let any scheduled reconnect run.
    function failAndWait(transport) {
        transport.emit('close', new Error('ECONNRESET'));
        clock.tick(20000);
    }

    it('retries when the first-ever connection fails', function() {
        conn.connect();
        failAndWait(lastTransport());

        assert.deepEqual(reconnecting, [1]);
        assert.equal(transports.length, 2);
        assert.equal(closed, 0);
    });

    it('numbers retries from 1 and stops after auto_reconnect_max_retries', function() {
        conn.connect();
        for (let i = 0; i < 4; i++) {
            failAndWait(lastTransport());
        }

        assert.deepEqual(reconnecting, [1, 2, 3]);
        assert.equal(closed, 1);
    });

    it('retries when the socket opens but registration fails', function() {
        conn.connect();
        lastTransport().emit('open');
        failAndWait(lastTransport());

        assert.deepEqual(reconnecting, [1]);
        assert.equal(closed, 0);
    });

    it('does not reset the budget on socket open when registration keeps failing', function() {
        conn.connect();
        for (let i = 0; i < 4; i++) {
            lastTransport().emit('open');
            failAndWait(lastTransport());
        }

        assert.deepEqual(reconnecting, [1, 2, 3]);
        assert.equal(closed, 1);
    });

    it('reconnects after a drop from a stable registered connection', function() {
        conn.connect();
        lastTransport().emit('open');
        conn.registeredSuccessfully();
        clock.tick(60000);
        failAndWait(lastTransport());

        assert.deepEqual(reconnecting, [1]);
        assert.equal(closed, 0);
    });

    it('resets the budget after a successful registration', function() {
        conn.connect();
        failAndWait(lastTransport());
        failAndWait(lastTransport());

        lastTransport().emit('open');
        conn.registeredSuccessfully();
        clock.tick(60000);
        failAndWait(lastTransport());

        assert.deepEqual(reconnecting, [1, 2, 1]);
    });

    it('does not reconnect when killed right after registering (aKill)', function() {
        conn.connect();
        lastTransport().emit('open');
        conn.registeredSuccessfully();
        clock.tick(1000);
        failAndWait(lastTransport());

        assert.deepEqual(reconnecting, []);
        assert.equal(closed, 1);
    });

    it('does not reconnect after a requested disconnect', function() {
        conn.connect();
        lastTransport().emit('open');
        conn.requested_disconnect = true;
        failAndWait(lastTransport());

        assert.deepEqual(reconnecting, []);
        assert.equal(closed, 1);
    });

    it('retries again on a manual connect() after giving up', function() {
        conn.connect();
        for (let i = 0; i < 4; i++) {
            failAndWait(lastTransport());
        }
        assert.equal(closed, 1);

        conn.connect();
        failAndWait(lastTransport());

        assert.deepEqual(reconnecting, [1, 2, 3, 1]);
    });
});
