'use strict';

/*globals describe, it */
let chai = require('chai'),
    Helper = require('../src/helpers'),
    expect = chai.expect;

chai.use(require('chai-subset'));

describe('src/irclineparser.js', function () {
    describe('mask parsing', function () {

        it('should recognize when just passed a nick', function () {
            var msgObj = Helper.parseMask("something");

            expect(msgObj).to.containSubset({
                nick: "something",
            });
        });

        it('should recognize when just passed a nick and user', function () {
            var msgObj = Helper.parseMask("something!something");

            expect(msgObj).to.containSubset({
                nick: "something",
                user: "something",
            });
        });

        it('should recognize when just passed a nick and host', function () {
            var msgObj = Helper.parseMask("something@something");

            expect(msgObj).to.containSubset({
                host: "something",
                nick: "something",
            });
        });

        it('should recognize when just passed a nick, user, and host', function () {
            var msgObj = Helper.parseMask("something!something@something");

            expect(msgObj).to.containSubset({
                nick: "something",
                host: "something",
                user: "something",
            });
        });
    });
});
