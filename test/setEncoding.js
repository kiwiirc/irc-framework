'use strict';

/* globals describe, it */
const Connection = require('../src/transports/net');
const chai = require('chai');
const assert = chai.assert;

chai.use(require('chai-subset'));

describe('src/transports/net.js', function() {
    describe('setEncoding', function() {
        it('should set encoding', function() {
            const conn = new Connection();
            assert.equal(conn.setEncoding('utf8'), true);
            assert.equal(conn.encoding, 'utf8');
            assert.equal(conn.setEncoding('ascii'), true);
            assert.equal(conn.encoding, 'ascii');
            assert.equal(conn.setEncoding('windows-1252'), true);
            assert.equal(conn.encoding, 'windows-1252');
        });

        it('should not set encoding if ASCII fails', function() {
            const conn = new Connection();
            assert.equal(conn.encoding, 'utf8');
            assert.equal(conn.setEncoding('base64'), false);
            assert.equal(conn.setEncoding('ucs2'), false);
            assert.equal(conn.setEncoding('utf16le'), false);
            assert.equal(conn.setEncoding('hex'), false);
            assert.equal(conn.setEncoding('utf16be'), false);
            assert.equal(conn.setEncoding('utf16'), false);
            assert.equal(conn.setEncoding('utf7imap'), false);
            assert.equal(conn.encoding, 'utf8');
        });

        it('should not set encoding if invalid', function() {
            const conn = new Connection();
            assert.equal(conn.setEncoding('this encoding totally does not exist'), false);
            assert.equal(conn.encoding, 'utf8');
            assert.equal(conn.setEncoding(null), false);
            assert.equal(conn.encoding, 'utf8');
        });
    });
});
