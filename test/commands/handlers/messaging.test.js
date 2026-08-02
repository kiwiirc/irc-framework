'use strict';

/* globals describe, it */
const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const messaging = require('../../../src/commands/handlers/messaging');
const IrcCommand = require('../../../src/commands/command');

chai.use(sinonChai);

function makeHandler(opts) {
    opts = opts || {};
    const ownNick = opts.ownNick || 'testnick';
    const enabledCaps = opts.enabledCaps || [];

    const handlers = {};
    messaging({
        addHandler: function(command, handler) {
            handlers[command] = handler;
        }
    });

    const spies = {
        emit: sinon.stub(),
        connection: {
            write: sinon.stub(),
            options: { version: null }
        },
        network: {
            addServerTimeOffset: sinon.stub(),
            extractTargetGroup: sinon.stub().returns(null),
            cap: {
                isEnabled: function(cap) {
                    return enabledCaps.indexOf(cap) > -1;
                }
            }
        },
        client: {
            user: { nick: ownNick },
            caseCompare: function(a, b) {
                return a.toLowerCase() === b.toLowerCase();
            }
        }
    };

    return { handlers, spies };
}

describe('src/commands/handlers/messaging.js', function() {
    describe('PRIVMSG self flag', function() {
        it('sets self=false when echo-message cap is not active', function() {
            const { handlers, spies } = makeHandler({ ownNick: 'testnick', enabledCaps: [] });
            const cmd = new IrcCommand('PRIVMSG', {
                nick: 'testnick',
                ident: 'user',
                hostname: 'host',
                params: ['#channel', 'hello world'],
                tags: {}
            });
            handlers.PRIVMSG(cmd, spies);
            expect(spies.emit).to.have.been.calledWith('privmsg', sinon.match({ self: false }));
        });

        it('sets self=true when echo-message cap is active and nick matches', function() {
            const { handlers, spies } = makeHandler({ ownNick: 'testnick', enabledCaps: ['echo-message'] });
            const cmd = new IrcCommand('PRIVMSG', {
                nick: 'testnick',
                ident: 'user',
                hostname: 'host',
                params: ['#channel', 'hello world'],
                tags: {}
            });
            handlers.PRIVMSG(cmd, spies);
            expect(spies.emit).to.have.been.calledWith('privmsg', sinon.match({ self: true }));
        });

        it('sets self=false when echo-message is active but nick differs', function() {
            const { handlers, spies } = makeHandler({ ownNick: 'testnick', enabledCaps: ['echo-message'] });
            const cmd = new IrcCommand('PRIVMSG', {
                nick: 'othernick',
                ident: 'user',
                hostname: 'host',
                params: ['#channel', 'hello world'],
                tags: {}
            });
            handlers.PRIVMSG(cmd, spies);
            expect(spies.emit).to.have.been.calledWith('privmsg', sinon.match({ self: false }));
        });

        it('sets self=true when znc.in/self-message cap is active and nick matches', function() {
            const { handlers, spies } = makeHandler({ ownNick: 'testnick', enabledCaps: ['znc.in/self-message'] });
            const cmd = new IrcCommand('PRIVMSG', {
                nick: 'testnick',
                ident: 'user',
                hostname: 'host',
                params: ['#channel', 'hello from znc'],
                tags: {}
            });
            handlers.PRIVMSG(cmd, spies);
            expect(spies.emit).to.have.been.calledWith('privmsg', sinon.match({ self: true }));
        });

        it('is case-insensitive for nick comparison', function() {
            const { handlers, spies } = makeHandler({ ownNick: 'TestNick', enabledCaps: ['echo-message'] });
            const cmd = new IrcCommand('PRIVMSG', {
                nick: 'testnick',
                ident: 'user',
                hostname: 'host',
                params: ['#channel', 'hello'],
                tags: {}
            });
            handlers.PRIVMSG(cmd, spies);
            expect(spies.emit).to.have.been.calledWith('privmsg', sinon.match({ self: true }));
        });
    });

    describe('NOTICE self flag', function() {
        it('sets self=false when echo-message cap is not active', function() {
            const { handlers, spies } = makeHandler({ ownNick: 'testnick', enabledCaps: [] });
            const cmd = new IrcCommand('NOTICE', {
                nick: 'testnick',
                ident: 'user',
                hostname: 'host',
                params: ['#channel', 'a notice'],
                tags: {}
            });
            handlers.NOTICE(cmd, spies);
            expect(spies.emit).to.have.been.calledWith('notice', sinon.match({ self: false }));
        });

        it('sets self=true when echo-message cap is active and nick matches', function() {
            const { handlers, spies } = makeHandler({ ownNick: 'testnick', enabledCaps: ['echo-message'] });
            const cmd = new IrcCommand('NOTICE', {
                nick: 'testnick',
                ident: 'user',
                hostname: 'host',
                params: ['#channel', 'a notice'],
                tags: {}
            });
            handlers.NOTICE(cmd, spies);
            expect(spies.emit).to.have.been.calledWith('notice', sinon.match({ self: true }));
        });
    });

    describe('TAGMSG self flag', function() {
        it('sets self=false when echo-message cap is not active', function() {
            const { handlers, spies } = makeHandler({ ownNick: 'testnick', enabledCaps: [] });
            const cmd = new IrcCommand('TAGMSG', {
                nick: 'testnick',
                ident: 'user',
                hostname: 'host',
                params: ['#channel'],
                tags: { '+example': 'value' }
            });
            handlers.TAGMSG(cmd, spies);
            expect(spies.emit).to.have.been.calledWith('tagmsg', sinon.match({ self: false }));
        });

        it('sets self=true when echo-message cap is active and nick matches', function() {
            const { handlers, spies } = makeHandler({ ownNick: 'testnick', enabledCaps: ['echo-message'] });
            const cmd = new IrcCommand('TAGMSG', {
                nick: 'testnick',
                ident: 'user',
                hostname: 'host',
                params: ['#channel'],
                tags: { '+example': 'value' }
            });
            handlers.TAGMSG(cmd, spies);
            expect(spies.emit).to.have.been.calledWith('tagmsg', sinon.match({ self: true }));
        });
    });

    describe('ACTION (CTCP) self flag', function() {
        it('sets self=false when echo-message cap is not active', function() {
            const { handlers, spies } = makeHandler({ ownNick: 'testnick', enabledCaps: [] });
            const cmd = new IrcCommand('PRIVMSG', {
                nick: 'testnick',
                ident: 'user',
                hostname: 'host',
                params: ['#channel', '\x01ACTION waves\x01'],
                tags: {}
            });
            handlers.PRIVMSG(cmd, spies);
            expect(spies.emit).to.have.been.calledWith('action', sinon.match({ self: false }));
        });

        it('sets self=true when echo-message cap is active and nick matches', function() {
            const { handlers, spies } = makeHandler({ ownNick: 'testnick', enabledCaps: ['echo-message'] });
            const cmd = new IrcCommand('PRIVMSG', {
                nick: 'testnick',
                ident: 'user',
                hostname: 'host',
                params: ['#channel', '\x01ACTION waves\x01'],
                tags: {}
            });
            handlers.PRIVMSG(cmd, spies);
            expect(spies.emit).to.have.been.calledWith('action', sinon.match({ self: true }));
        });
    });
});
