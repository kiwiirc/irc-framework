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

        it('should parse CLIENTTAGDENY= as a list', function() {
            const client = newMockClient();
            client.dispatch({
                command: '005',
                params: ['nick', 'CLIENTTAGDENY='],
                tags: []
            });
            assert.isEmpty(client.network.options.CLIENTTAGDENY);
        });

        it('should parse CLIENTTAGDENY=*,-a,-b as a list', function() {
            const client = newMockClient();
            client.dispatch({
                command: '005',
                params: ['nick', 'CLIENTTAGDENY=*,-a,-b'],
                tags: []
            });
            assert.equal(client.network.options.CLIENTTAGDENY, ['*', '-a', '-b']);
        });
    });

    it('should parse CLIENTTAGDENY=a,b,c as a list', function() {
        const client = newMockClient();
        client.dispatch({
            command: '005',
            params: ['nick', 'CLIENTTAGDENY=a,b,c'],
            tags: []
        });
        assert.equal(client.network.options.CLIENTTAGDENY, ['a', 'b', 'c']);
    });
});
