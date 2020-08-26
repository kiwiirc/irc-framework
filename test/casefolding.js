'use strict';
/* globals describe, it */
const chai = require('chai');
const IrcClient = require('../src/client');
const expect = chai.expect;

chai.use(require('chai-subset'));

describe('src/client.js', function() {
    describe('caseLower', function() {
        it('CASEMAPPING=rfc1459', function() {
            const client = new IrcClient();

            expect(client.network.options.CASEMAPPING).to.equal('rfc1459'); // default
            expect(client.caseLower('ABCDEFGHIJKLMNOPQRSTUVWXYZ')).to.equal('abcdefghijklmnopqrstuvwxyz');
            expect(client.caseLower('ÀTEST[]^\\')).to.equal('Àtest{}~|');
            expect(client.caseLower('Àtest{}~|')).to.equal('Àtest{}~|');
            expect(client.caseLower('@?A_`#&')).to.equal('@?a_`#&');
        });

        it('CASEMAPPING=strict-rfc1459', function() {
            const client = new IrcClient();
            client.network.options.CASEMAPPING = 'strict-rfc1459';

            expect(client.caseLower('ABCDEFGHIJKLMNOPQRSTUVWXYZ')).to.equal('abcdefghijklmnopqrstuvwxyz');
            expect(client.caseLower('ÀTEST[]^\\')).to.equal('Àtest{}^|');
            expect(client.caseLower('Àtest{}^|')).to.equal('Àtest{}^|');
            expect(client.caseLower('@?A^_`#&')).to.equal('@?a^_`#&');
        });

        it('CASEMAPPING=ascii', function() {
            const client = new IrcClient();
            client.network.options.CASEMAPPING = 'ascii';

            expect(client.caseLower('ABCDEFGHIJKLMNOPQRSTUVWXYZ')).to.equal('abcdefghijklmnopqrstuvwxyz');
            expect(client.caseLower('ÀTEST[]^\\{}~|#&')).to.equal('Àtest[]^\\{}~|#&');
            expect(client.caseLower('ПРИВЕТ, как дела? 👋')).to.equal('ПРИВЕТ, как дела? 👋');
        });
    });

    describe('caseUpper', function() {
        it('CASEMAPPING=rfc1459', function() {
            const client = new IrcClient();

            expect(client.network.options.CASEMAPPING).to.equal('rfc1459'); // default
            expect(client.caseUpper('abcdefghijklmnopqrstuvwxyz')).to.equal('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
            expect(client.caseUpper('ÀTEST{}~|')).to.equal('ÀTEST[]^\\');
            expect(client.caseUpper('ÀTEST[]^\\')).to.equal('ÀTEST[]^\\');
            expect(client.caseUpper('@?a_`#&')).to.equal('@?A_`#&');
        });

        it('CASEMAPPING=strict-rfc1459', function() {
            const client = new IrcClient();
            client.network.options.CASEMAPPING = 'strict-rfc1459';

            expect(client.caseUpper('abcdefghijklmnopqrstuvwxyz')).to.equal('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
            expect(client.caseUpper('ÀTEST{}~|')).to.equal('ÀTEST[]~\\');
            expect(client.caseUpper('ÀTEST[]^\\')).to.equal('ÀTEST[]^\\');
            expect(client.caseUpper('@?a^~_`#&')).to.equal('@?A^~_`#&');
        });

        it('CASEMAPPING=ascii', function() {
            const client = new IrcClient();
            client.network.options.CASEMAPPING = 'ascii';

            expect(client.caseUpper('abcdefghijklmnopqrstuvwxyz')).to.equal('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
            expect(client.caseUpper('Àtest[]^\\{}~|#&')).to.equal('ÀTEST[]^\\{}~|#&');
            expect(client.caseUpper('ПРИВЕТ, как дела? 👋')).to.equal('ПРИВЕТ, как дела? 👋');
        });
    });

    /* eslint-disable no-unused-expressions */
    describe('caseCompare', function() {
        it('CASEMAPPING=rfc1459', function() {
            const client = new IrcClient();

            expect(client.network.options.CASEMAPPING).to.equal('rfc1459'); // default

            expect(client.caseCompare('abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')).to.be.true;
            expect(client.caseCompare('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')).to.be.true;
            expect(client.caseCompare('Àtest{}~|', 'ÀTEST[]^\\')).to.be.true;
            expect(client.caseCompare('ÀTEST[]^\\', 'Àtest{}~|')).to.be.true;
            expect(client.caseCompare('Àtest{}~|', 'Àtest{}~|')).to.be.true;
            expect(client.caseCompare('@?A_`#&', '@?a_`#&')).to.be.true;
        });

        it('CASEMAPPING=strict-rfc1459', function() {
            const client = new IrcClient();
            client.network.options.CASEMAPPING = 'strict-rfc1459';

            expect(client.caseCompare('abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')).to.be.true;
            expect(client.caseCompare('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')).to.be.true;
            expect(client.caseCompare('Àtest{}^|', 'ÀTEST[]^\\')).to.be.true;
            expect(client.caseCompare('ÀTEST[]^\\', 'Àtest{}^|')).to.be.true;
            expect(client.caseCompare('Àtest{}^|', 'Àtest{}^|')).to.be.true;
            expect(client.caseCompare('@?A^_`#&', '@?a^_`#&')).to.be.true;
        });

        it('CASEMAPPING=ascii', function() {
            const client = new IrcClient();
            client.network.options.CASEMAPPING = 'ascii';

            expect(client.caseCompare('abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')).to.be.true;
            expect(client.caseCompare('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')).to.be.true;
            expect(client.caseCompare('Àtest[]^\\{}~|#&', 'ÀTEST[]^\\{}~|#&')).to.be.true;
            expect(client.caseCompare('ÀTEST[]^\\{}~|#&', 'Àtest[]^\\{}~|#&')).to.be.true;
            expect(client.caseCompare('ПРИВЕТ, как дела? 👋', 'ПРИВЕТ, как дела? 👋')).to.be.true;
            expect(client.caseCompare('#HELLO1', '#HELLO2')).to.be.false;
            expect(client.caseCompare('#HELLO', '#HELLO2')).to.be.false;
            expect(client.caseCompare('#HELLO', '#HELL')).to.be.false;
            expect(client.caseCompare('#HELL', '#HELLO')).to.be.false;
            expect(client.caseCompare('#HELLOZ', '#HELLOZ')).to.be.true;
            expect(client.caseCompare('#HELLOZ[', '#HELLOZ{')).to.be.false;
        });
    });
});
