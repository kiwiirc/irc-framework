"use strict";
/*globals describe, it */
const chai = require('chai'),
    IrcCommand = require('../src/commands/command'),
    expect = chai.expect;

describe('src/commands/command.js', function () {
    describe('getServerTime parsing', function () {

        it('should parse ISO8601 correctly', function () {
            const cmd = new IrcCommand('', {
                tags: {
                    time: '2011-10-10T14:48:00Z',
                }
            });

            expect(cmd.getServerTime()).to.equal(1318258080000);
        });

        it('should parse unix timestamps', function () {
            const cmd = new IrcCommand('', {
                tags: {
                    time: '1318258080',
                }
            });

            expect(cmd.getServerTime()).to.equal(1318258080000);
        });

        it('should parse unix timestamps with milliseconds', function () {
            const cmd = new IrcCommand('', {
                tags: {
                    time: '1318258080.1234',
                }
            });

            expect(cmd.getServerTime()).to.equal(1318258080123);
        });

        it('should return undefined for missing time', function () {
            const cmd = new IrcCommand('', {
                tags: {}
            });

            expect(cmd.getServerTime()).to.equal(undefined);
        });

        it('should return undefined for empty time', function () {
            const cmd = new IrcCommand('', {
                tags: {
                    time: '',
                }
            });

            expect(cmd.getServerTime()).to.equal(undefined);
        });

        it('should return undefined for malformed time', function () {
            const cmd = new IrcCommand('', {
                tags: {
                    time: 'definetelyNotAtimestamp',
                }
            });

            expect(cmd.getServerTime()).to.equal(undefined);
        });
    });
});
