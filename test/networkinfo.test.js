'use strict';

/* globals describe, it */
const chai = require('chai');
const assert = chai.assert;
const NetworkInfo = require('../src/networkinfo');
const IrcCommandHandler = require('../src/commands/handler');

function newMockClient() {
    const handler = new IrcCommandHandler({ network: new NetworkInfo() });
    return handler;
}

describe('src/networkinfo.js', function() {
    describe('isChannelName', function() {
        const names = ['chan', '#chan', '.chan', '%chan', '&#chan', '%#chan'];

        it('should identify names as channels when CHANTYPES is not given', function() {
            const client = newMockClient();
            const results = names.map(name => client.network.isChannelName(name));
            assert.deepEqual(results, [false, true, false, false, true, false]);
        });

        it('should identify names as channels when CHANTYPES is standard', function() {
            const client = newMockClient();
            client.dispatch({
                command: '005',
                params: ['nick', 'CHANTYPES=#&'],
                tags: []
            });
            const results = names.map(name => client.network.isChannelName(name));
            assert.deepEqual(results, [false, true, false, false, true, false]);
        });

        it('should identify names as channels when CHANTYPES is non-standard', function() {
            const client = newMockClient();
            client.dispatch({
                command: '005',
                params: ['nick', 'CHANTYPES=%'],
                tags: []
            });
            const results = names.map(name => client.network.isChannelName(name));
            assert.deepEqual(results, [false, false, false, true, false, true]);
        });

        it('should not identify any names as channels when no CHANTYPES are supported', function() {
            const client = newMockClient();
            client.dispatch({
                command: '005',
                params: ['nick', 'CHANTYPES='],
                tags: []
            });
            const results = names.map(name => client.network.isChannelName(name));
            assert.deepEqual(results, [false, false, false, false, false, false]);
        });
    });

    describe('CLIENTTAGDENY Support', function() {
        it('should parse CLIENTTAGDENY=a,b,c as a list', function() {
            const client = newMockClient();
            client.dispatch({
                command: '005',
                params: ['nick', 'CLIENTTAGDENY=a,b,c'],
                tags: []
            });
            assert.deepEqual(client.network.options.CLIENTTAGDENY, ['a', 'b', 'c']);
        });

        it('should parse CLIENTTAGDENY=*,-a,-b as a list', function() {
            const client = newMockClient();
            client.dispatch({
                command: '005',
                params: ['nick', 'CLIENTTAGDENY=*,-a,-b'],
                tags: []
            });
            assert.deepEqual(client.network.options.CLIENTTAGDENY, ['*', '-a', '-b']);
        });

        it('should parse CLIENTTAGDENY= as a list', function() {
            const client = newMockClient();
            client.dispatch({
                command: '005',
                params: ['nick', 'CLIENTTAGDENY='],
                tags: []
            });
            assert.isArray(client.network.options.CLIENTTAGDENY);
            assert.isEmpty(client.network.options.CLIENTTAGDENY);
        });

        it('should be undefined when no CLIENTTAGDENY', function() {
            const client = newMockClient();
            client.dispatch({
                command: '005',
                params: ['nick', ''],
                tags: []
            });
            assert.isUndefined(client.network.options.CLIENTTAGDENY);
        });

        it('should deny all when no message-tags CAP', function() {
            const client = newMockClient();
            client.dispatch({
                command: '005',
                params: ['nick', 'CLIENTTAGDENY=*,-a,-b'],
                tags: []
            });
            assert.isFalse(client.network.supportsTag('a'));
            assert.isFalse(client.network.supportsTag('b'));
        });

        it('should allow all when CLIENTTAGDENY=', function() {
            const client = newMockClient();
            client.network.cap.enabled.push('message-tags');
            client.dispatch({
                command: '005',
                params: ['nick', 'CLIENTTAGDENY='],
                tags: []
            });
            assert.isTrue(client.network.supportsTag('a'));
            assert.isTrue(client.network.supportsTag('b'));
        });

        it('should deny all when CLIENTTAGDENY=*', function() {
            const client = newMockClient();
            client.network.cap.enabled.push('message-tags');
            client.dispatch({
                command: '005',
                params: ['nick', 'CLIENTTAGDENY=*'],
                tags: []
            });
            assert.isFalse(client.network.supportsTag('a'));
            assert.isFalse(client.network.supportsTag('b'));
        });

        it('should allow a & deny b, c when CLIENTTAGDENY=*,-a', function() {
            const client = newMockClient();
            client.network.cap.enabled.push('message-tags');
            client.dispatch({
                command: '005',
                params: ['nick', 'CLIENTTAGDENY=*,-a'],
                tags: []
            });
            assert.isTrue(client.network.supportsTag('a'));
            assert.isFalse(client.network.supportsTag('b'));
        });

        it('should allow a & deny b when CLIENTTAGDENY=b', function() {
            const client = newMockClient();
            client.network.cap.enabled.push('message-tags');
            client.dispatch({
                command: '005',
                params: ['nick', 'CLIENTTAGDENY=b'],
                tags: []
            });
            assert.isTrue(client.network.supportsTag('a'));
            assert.isFalse(client.network.supportsTag('b'));
        });
    });

    describe('EXTBAN and ACCOUNTEXTBAN support', function() {
        it('should parse EXTBAN into prefix and types', function() {
            const client = newMockClient();
            client.dispatch({
                command: '005',
                params: ['nick', 'EXTBAN=$,ARar'],
                tags: []
            });
            assert.deepEqual(client.network.options.EXTBAN, {
                prefix: '$',
                types: ['A', 'R', 'a', 'r'],
            });
        });

        it('should parse EXTBAN with tilde prefix', function() {
            const client = newMockClient();
            client.dispatch({
                command: '005',
                params: ['nick', 'EXTBAN=~,a'],
                tags: []
            });
            assert.deepEqual(client.network.options.EXTBAN, {
                prefix: '~',
                types: ['a'],
            });
        });

        it('should parse ACCOUNTEXTBAN as a list', function() {
            const client = newMockClient();
            client.dispatch({
                command: '005',
                params: ['nick', 'ACCOUNTEXTBAN=a,account'],
                tags: []
            });
            assert.deepEqual(client.network.options.ACCOUNTEXTBAN, ['a', 'account']);
        });

        it('should parse single ACCOUNTEXTBAN value', function() {
            const client = newMockClient();
            client.dispatch({
                command: '005',
                params: ['nick', 'ACCOUNTEXTBAN=R'],
                tags: []
            });
            assert.deepEqual(client.network.options.ACCOUNTEXTBAN, ['R']);
        });

        it('should construct account ban mask with $ prefix', function() {
            const client = newMockClient();
            client.dispatch({
                command: '005',
                params: ['nick', 'EXTBAN=$,ARar', 'ACCOUNTEXTBAN=R'],
                tags: []
            });
            assert.equal(client.network.accountBanMask('bob'), '$R:bob');
        });

        it('should construct account ban mask with ~ prefix', function() {
            const client = newMockClient();
            client.dispatch({
                command: '005',
                params: ['nick', 'EXTBAN=~,a', 'ACCOUNTEXTBAN=a,account'],
                tags: []
            });
            assert.equal(client.network.accountBanMask('bob'), '~a:bob');
        });

        it('should return null when EXTBAN is not available', function() {
            const client = newMockClient();
            client.dispatch({
                command: '005',
                params: ['nick', 'ACCOUNTEXTBAN=R'],
                tags: []
            });
            assert.isNull(client.network.accountBanMask('bob'));
        });

        it('should return null when ACCOUNTEXTBAN is not available', function() {
            const client = newMockClient();
            client.dispatch({
                command: '005',
                params: ['nick', 'EXTBAN=$,ARar'],
                tags: []
            });
            assert.isNull(client.network.accountBanMask('bob'));
        });
    });
});
