'use strict';
/* globals describe, it */
const chai = require('chai');
const sinon = require('sinon');
const IrcClient = require('../src/client');
const NetworkInfo = require('../src/networkinfo');

const expect = chai.expect;

function newClient() {
    const client = new IrcClient({});
    client._applyDefaultOptions(client.options);
    // Don't try to actually connect
    client.connection.write = sinon.stub();
    return client;
}

function dispatch(client, msg) {
    client.command_handler.dispatch(Object.assign({
        prefix: 'alice!u@h',
        nick: 'alice',
        ident: 'u',
        hostname: 'h',
        tags: Object.create(null),
    }, msg));
}

describe('draft/multiline', function() {
    describe('NetworkInfo.multilineLimits', function() {
        it('returns null when CAP not enabled', function() {
            const net = new NetworkInfo();
            net.cap.available.set('draft/multiline', 'max-bytes=4096,max-lines=24');
            expect(net.multilineLimits()).to.equal(null);
        });

        it('parses max-bytes and max-lines when CAP enabled', function() {
            const net = new NetworkInfo();
            net.cap.enabled.push('draft/multiline');
            net.cap.available.set('draft/multiline', 'max-bytes=4096,max-lines=24');
            expect(net.multilineLimits()).to.deep.equal({ maxBytes: 4096, maxLines: 24 });
        });

        it('treats max-lines as null when not provided', function() {
            const net = new NetworkInfo();
            net.cap.enabled.push('draft/multiline');
            net.cap.available.set('draft/multiline', 'max-bytes=4096');
            expect(net.multilineLimits()).to.deep.equal({ maxBytes: 4096, maxLines: null });
        });

        it('returns null when max-bytes is missing', function() {
            const net = new NetworkInfo();
            net.cap.enabled.push('draft/multiline');
            net.cap.available.set('draft/multiline', 'max-lines=24');
            expect(net.multilineLimits()).to.equal(null);
        });
    });

    describe('inbound BATCH draft/multiline', function() {
        it('concatenates lines with newline separators by default', function() {
            const client = newClient();
            const onPrivmsg = sinon.spy();
            client.on('privmsg', onPrivmsg);

            dispatch(client, { command: 'BATCH', params: ['+b1', 'draft/multiline', '#chan'], tags: { msgid: 'xyz' } });
            dispatch(client, { command: 'PRIVMSG', params: ['#chan', 'hello'], tags: { batch: 'b1' } });
            dispatch(client, { command: 'PRIVMSG', params: ['#chan', 'world'], tags: { batch: 'b1' } });
            dispatch(client, { command: 'BATCH', params: ['-b1'], tags: {} });

            sinon.assert.calledOnce(onPrivmsg);
            const arg = onPrivmsg.firstCall.args[0];
            expect(arg.message).to.equal('hello\nworld');
            expect(arg.multiline).to.equal(true);
            expect(arg.target).to.equal('#chan');
            expect(arg.nick).to.equal('alice');
            expect(arg.batch.id).to.equal('b1');
            expect(arg.batch.type).to.equal('draft/multiline');
            // Tags taken from the BATCH start command
            expect(arg.tags.msgid).to.equal('xyz');
        });

        it('joins via draft/multiline-concat with no separator', function() {
            const client = newClient();
            const onPrivmsg = sinon.spy();
            client.on('privmsg', onPrivmsg);

            dispatch(client, { command: 'BATCH', params: ['+b2', 'draft/multiline', '#chan'], tags: {} });
            dispatch(client, { command: 'PRIVMSG', params: ['#chan', 'how is '], tags: { batch: 'b2' } });
            dispatch(client, { command: 'PRIVMSG', params: ['#chan', 'everyone?'], tags: { batch: 'b2', 'draft/multiline-concat': true } });
            dispatch(client, { command: 'BATCH', params: ['-b2'], tags: {} });

            sinon.assert.calledOnce(onPrivmsg);
            expect(onPrivmsg.firstCall.args[0].message).to.equal('how is everyone?');
        });

        it('handles a mix of line-feeds and concat tags per the spec example', function() {
            const client = newClient();
            const onPrivmsg = sinon.spy();
            client.on('privmsg', onPrivmsg);

            dispatch(client, { command: 'BATCH', params: ['+b3', 'draft/multiline', '#chan'], tags: {} });
            dispatch(client, { command: 'PRIVMSG', params: ['#chan', 'hello'], tags: { batch: 'b3' } });
            dispatch(client, { command: 'PRIVMSG', params: ['#chan', ''], tags: { batch: 'b3' } });
            dispatch(client, { command: 'PRIVMSG', params: ['#chan', 'how is '], tags: { batch: 'b3' } });
            dispatch(client, { command: 'PRIVMSG', params: ['#chan', 'everyone?'], tags: { batch: 'b3', 'draft/multiline-concat': true } });
            dispatch(client, { command: 'BATCH', params: ['-b3'], tags: {} });

            sinon.assert.calledOnce(onPrivmsg);
            expect(onPrivmsg.firstCall.args[0].message).to.equal('hello\n\nhow is everyone?');
        });

        it('drops a malformed batch with a blank concat line', function() {
            const client = newClient();
            const onPrivmsg = sinon.spy();
            client.on('privmsg', onPrivmsg);

            dispatch(client, { command: 'BATCH', params: ['+b4', 'draft/multiline', '#chan'], tags: {} });
            dispatch(client, { command: 'PRIVMSG', params: ['#chan', 'hello'], tags: { batch: 'b4' } });
            dispatch(client, { command: 'PRIVMSG', params: ['#chan', ''], tags: { batch: 'b4', 'draft/multiline-concat': true } });
            dispatch(client, { command: 'BATCH', params: ['-b4'], tags: {} });

            sinon.assert.notCalled(onPrivmsg);
        });

        it('drops a batch consisting entirely of blank lines', function() {
            const client = newClient();
            const onPrivmsg = sinon.spy();
            client.on('privmsg', onPrivmsg);

            dispatch(client, { command: 'BATCH', params: ['+b5', 'draft/multiline', '#chan'], tags: {} });
            dispatch(client, { command: 'PRIVMSG', params: ['#chan', ''], tags: { batch: 'b5' } });
            dispatch(client, { command: 'PRIVMSG', params: ['#chan', ''], tags: { batch: 'b5' } });
            dispatch(client, { command: 'BATCH', params: ['-b5'], tags: {} });

            sinon.assert.notCalled(onPrivmsg);
        });

        it('drops a batch mixing PRIVMSG and NOTICE', function() {
            const client = newClient();
            const onPrivmsg = sinon.spy();
            const onNotice = sinon.spy();
            client.on('privmsg', onPrivmsg);
            client.on('notice', onNotice);

            dispatch(client, { command: 'BATCH', params: ['+b6', 'draft/multiline', '#chan'], tags: {} });
            dispatch(client, { command: 'PRIVMSG', params: ['#chan', 'a'], tags: { batch: 'b6' } });
            dispatch(client, { command: 'NOTICE', params: ['#chan', 'b'], tags: { batch: 'b6' } });
            dispatch(client, { command: 'BATCH', params: ['-b6'], tags: {} });

            sinon.assert.notCalled(onPrivmsg);
            sinon.assert.notCalled(onNotice);
        });

        it('emits as a NOTICE when the batch contains NOTICEs', function() {
            const client = newClient();
            const onNotice = sinon.spy();
            client.on('notice', onNotice);

            dispatch(client, { command: 'BATCH', params: ['+b7', 'draft/multiline', '#chan'], tags: {} });
            dispatch(client, { command: 'NOTICE', params: ['#chan', 'one'], tags: { batch: 'b7' } });
            dispatch(client, { command: 'NOTICE', params: ['#chan', 'two'], tags: { batch: 'b7' } });
            dispatch(client, { command: 'BATCH', params: ['-b7'], tags: {} });

            sinon.assert.calledOnce(onNotice);
            expect(onNotice.firstCall.args[0].message).to.equal('one\ntwo');
            expect(onNotice.firstCall.args[0].multiline).to.equal(true);
        });
    });

    describe('CAP negotiation', function() {
        it('does not request draft/multiline by default', function() {
            const client = new IrcClient({});
            client._applyDefaultOptions(client.options);
            expect(client.options.enable_multiline).to.not.equal(true);
        });
    });

    describe('outbound sayMultiline', function() {
        function clientWithMultilineCap(maxBytes, maxLines) {
            const client = newClient();
            client.network.cap.enabled.push('draft/multiline');
            const value = `max-bytes=${maxBytes}` + (maxLines !== undefined ? `,max-lines=${maxLines}` : '');
            client.network.cap.available.set('draft/multiline', value);
            return client;
        }

        it('falls back to per-line PRIVMSGs when CAP is not enabled', function() {
            const client = newClient();
            client.sayMultiline('#chan', ['one', 'two']);

            const writes = client.connection.write.getCalls().map(c => c.args[0]);
            expect(writes).to.deep.equal([
                'PRIVMSG #chan one',
                'PRIVMSG #chan two',
            ]);
        });

        it('emits BATCH frames when CAP is enabled', function() {
            const client = clientWithMultilineCap(4096, 24);
            client.sayMultiline('#chan', ['hello', 'world']);

            const writes = client.connection.write.getCalls().map(c => c.args[0]);
            expect(writes.length).to.equal(4);
            // BATCH +<reftag> draft/multiline #chan
            expect(writes[0]).to.match(/^BATCH \+\S+ draft\/multiline #chan$/);
            const reftag = writes[0].split(' ')[1].slice(1);
            expect(writes[1]).to.equal(`@batch=${reftag} PRIVMSG #chan hello`);
            expect(writes[2]).to.equal(`@batch=${reftag} PRIVMSG #chan world`);
            expect(writes[3]).to.equal(`BATCH -${reftag}`);
        });

        it('splits long logical lines and adds draft/multiline-concat to continuations', function() {
            const client = clientWithMultilineCap(4096, 24);
            client.options.message_max_length = 10;
            client.sayMultiline('#c', ['the quick brown fox jumps']);

            const writes = client.connection.write.getCalls().map(c => c.args[0]);
            // First write: BATCH start, last: BATCH end. Middle: continuation lines.
            expect(writes[0]).to.match(/^BATCH \+/);
            expect(writes[writes.length - 1]).to.match(/^BATCH -/);
            const continuations = writes.slice(2, -1);
            // Every continuation block (after the first) carries the concat tag
            for (const w of continuations) {
                expect(w).to.match(/draft\/multiline-concat/);
            }
        });

        it('throws when the combined byte count exceeds max-bytes', function() {
            const client = clientWithMultilineCap(10);
            expect(() => client.sayMultiline('#c', ['this is way too long'])).to.throw(/max-bytes/);
        });

        it('throws when the line count exceeds max-lines', function() {
            const client = clientWithMultilineCap(4096, 2);
            expect(() => client.sayMultiline('#c', ['a', 'b', 'c'])).to.throw(/max-lines/);
        });

        it('exposes noticeMultiline using NOTICE', function() {
            const client = clientWithMultilineCap(4096, 24);
            client.noticeMultiline('#c', ['hi']);
            const writes = client.connection.write.getCalls().map(c => c.args[0]);
            expect(writes[1]).to.match(/NOTICE #c hi$/);
        });
    });
});
