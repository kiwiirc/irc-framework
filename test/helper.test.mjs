'use strict';

import { expect, use } from 'chai';
import chaiSubset from 'chai-subset';

import Helper from '../src/helpers.js';

use(chaiSubset);

describe('src/irclineparser.js', function() {
    describe('mask parsing', function() {
        it('should recognize when just passed a nick', function() {
            const msgObj = Helper.parseMask('something');

            expect(msgObj).to.containSubset({
                nick: 'something',
            });
        });

        it('should recognize when just passed a host', function() {
            const msgObj = Helper.parseMask('irc.server.com');

            expect(msgObj).to.containSubset({
                nick: '',
                host: 'irc.server.com',
            });
        });

        it('should recognize when just passed a nick and user', function() {
            const msgObj = Helper.parseMask('something!something');

            expect(msgObj).to.containSubset({
                nick: 'something',
                user: 'something',
            });
        });

        it('should recognize when just passed a nick and host', function() {
            const msgObj = Helper.parseMask('something@something');

            expect(msgObj).to.containSubset({
                host: 'something',
                nick: 'something',
            });
        });

        it('should recognize when just passed a nick, user, and host', function() {
            const msgObj = Helper.parseMask('something!something@something');

            expect(msgObj).to.containSubset({
                nick: 'something',
                host: 'something',
                user: 'something',
            });
        });
    });
});
