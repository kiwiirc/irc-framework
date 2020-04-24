'use strict';

/* globals describe, it */
const chai = require('chai');
const parseIrcLine = require('../src/irclineparser');
const expect = chai.expect;

chai.use(require('chai-subset'));

describe('src/irclineparser.js', function() {
    describe('message parsing', function() {
        it('should parse a command by itself', function() {
            const msgObj = parseIrcLine('TEST');

            expect(msgObj).to.containSubset({
                command: 'TEST',
            });
        });

        it('should parse a command with a single parameter', function() {
            const msgObj = parseIrcLine('TEST foo');

            expect(msgObj).to.containSubset({
                command: 'TEST',
                params: ['foo']
            });
        });

        it('should parse a command with a single "trailing" parameter', function() {
            const msgObj = parseIrcLine('TEST :foo');

            expect(msgObj).to.containSubset({
                command: 'TEST',
                params: ['foo']
            });
        });

        it('should parse a command with an empty "trailing" parameter', function() {
            const msgObj = parseIrcLine('TEST :');

            expect(msgObj).to.containSubset({
                command: 'TEST',
                params: ['']
            });
        });

        it('should parse a command with a colon in parameter', function() {
            const msgObj = parseIrcLine('TEST foo:bar');

            expect(msgObj).to.containSubset({
                command: 'TEST',
                params: ['foo:bar']
            });
        });

        it('should parse a command with a colon in "trailing" parameter', function() {
            const msgObj = parseIrcLine('TEST :foo:bar');

            expect(msgObj).to.containSubset({
                command: 'TEST',
                params: ['foo:bar']
            });
        });

        it('should parse a command with a colon and space in "trailing" parameter', function() {
            const msgObj = parseIrcLine('TEST :foo :bar');

            expect(msgObj).to.containSubset({
                command: 'TEST',
                params: ['foo :bar']
            });
        });

        it('should parse a command with a multiple parameters', function() {
            const msgObj = parseIrcLine('TEST foo bar');

            expect(msgObj).to.containSubset({
                command: 'TEST',
                params: ['foo', 'bar']
            });
        });

        it('should parse a command with a multiple parameters, one of which is "trailing"', function() {
            const msgObj = parseIrcLine('TEST foo :bar');

            expect(msgObj).to.containSubset({
                command: 'TEST',
                params: ['foo', 'bar']
            });
        });

        it('should parse a command with a "trailing" parameter that contains spaces', function() {
            const msgObj = parseIrcLine('TEST :hello world');

            expect(msgObj).to.containSubset({
                command: 'TEST',
                params: ['hello world']
            });
        });

        it('should parse a message that has a hostname as a prefix with no command', function() {
            const msgObj = parseIrcLine(':irc.example.org');

            expect(msgObj).to.containSubset({
                prefix: 'irc.example.org',
                nick: '',
                ident: '',
                hostname: 'irc.example.org',
                command: '',
            });
        });

        it('should parse a message that has a hostname as a prefix', function() {
            const msgObj = parseIrcLine(':irc.example.org TEST');

            expect(msgObj).to.containSubset({
                prefix: 'irc.example.org',
                nick: '',
                ident: '',
                hostname: 'irc.example.org',
                command: 'TEST',
            });
        });

        it('should parse a message that has nick@hostname as a prefix', function() {
            const msgObj = parseIrcLine(':nick@irc.example.org TEST');

            expect(msgObj).to.containSubset({
                nick: 'nick',
                hostname: 'irc.example.org',
                command: 'TEST'
            });
        });

        it('should parse a message that has nick!ident@hostname as a prefix', function() {
            const msgObj = parseIrcLine(':nick!ident@irc.example.org TEST');

            expect(msgObj).to.containSubset({
                nick: 'nick',
                ident: 'ident',
                hostname: 'irc.example.org',
                command: 'TEST'
            });
        });

        it('should parse a command with a single parameter and a hostname prefix', function() {
            const msgObj = parseIrcLine(':irc.example.org TEST');

            expect(msgObj).to.containSubset({
                prefix: 'irc.example.org',
                command: 'TEST'
            });
        });

        it('should parse a command with a single parameter and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine(':nick@example.org TEST foo');

            expect(msgObj).to.containSubset({
                nick: 'nick',
                hostname: 'example.org',
                command: 'TEST',
                params: ['foo'],
            });
        });

        it('should parse a command with a single "trailing" parameter and a nick!ident@hostname prefix', function() {
            const msgObj = parseIrcLine(':nick!ident@example.org TEST :foo');

            expect(msgObj).to.containSubset({
                nick: 'nick',
                ident: 'ident',
                hostname: 'example.org',
                command: 'TEST',
                params: ['foo'],
            });
        });

        it('should parse a command with a single "trailing" parameter and a hostname prefix', function() {
            const msgObj = parseIrcLine(':irc.example.org TEST :foo');

            expect(msgObj).to.containSubset({
                prefix: 'irc.example.org',
                command: 'TEST',
                params: ['foo'],
            });
        });

        it('should parse a command with a single "trailing" parameter and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine(':nick@example.org TEST :foo');

            expect(msgObj).to.containSubset({
                nick: 'nick',
                hostname: 'example.org',
                command: 'TEST',
                params: ['foo'],
            });
        });

        it('should parse a command with a single "trailing" parameter and a nick!ident@hostname prefix', function() {
            const msgObj = parseIrcLine(':nick!ident@example.org TEST :foo');

            expect(msgObj).to.containSubset({
                nick: 'nick',
                ident: 'ident',
                hostname: 'example.org',
                command: 'TEST',
                params: ['foo'],
            });
        });

        it('should parse a command with a multiple parameters and a hostname prefix', function() {
            const msgObj = parseIrcLine(':irc.example.org TEST foo bar');

            expect(msgObj).to.containSubset({
                prefix: 'irc.example.org',
                command: 'TEST',
                params: ['foo', 'bar']
            });
        });

        it('should parse a command with a multiple parameters and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine(':nick@example.org TEST foo bar');

            expect(msgObj).to.containSubset({
                nick: 'nick',
                hostname: 'example.org',
                command: 'TEST',
                params: ['foo', 'bar']
            });
        });

        it('should parse a command with a multiple parameters and a nick!ident@hostname prefix', function() {
            const msgObj = parseIrcLine(':nick!ident@example.org TEST foo bar');

            expect(msgObj).to.containSubset({
                nick: 'nick',
                ident: 'ident',
                hostname: 'example.org',
                command: 'TEST',
                params: ['foo', 'bar']
            });
        });

        it('should parse a command with a multiple parameters, one of which is "trailing", and a hostname prefix', function() {
            const msgObj = parseIrcLine(':irc.example.org TEST foo :bar');

            expect(msgObj).to.containSubset({
                prefix: 'irc.example.org',
                command: 'TEST',
                params: ['foo', 'bar']
            });
        });

        it('should parse a command with a multiple parameters, one of which is "trailing", and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine(':nick@example.org TEST foo :bar');

            expect(msgObj).to.containSubset({
                nick: 'nick',
                hostname: 'example.org',
                command: 'TEST',
                params: ['foo', 'bar']
            });
        });

        it('should parse a command with a multiple parameters, one of which is "trailing", and a nick!ident@hostname prefix', function() {
            const msgObj = parseIrcLine(':nick!ident@example.org TEST foo :bar');

            expect(msgObj).to.containSubset({
                nick: 'nick',
                ident: 'ident',
                hostname: 'example.org',
                command: 'TEST',
                params: ['foo', 'bar']
            });
        });

        it('should parse a command with a "trailing" parameter that contains spaces and a hostname prefix', function() {
            const msgObj = parseIrcLine(':irc.example.org TEST :hello world');

            expect(msgObj).to.containSubset({
                prefix: 'irc.example.org',
                command: 'TEST',
                params: ['hello world']
            });
        });

        it('should parse a command with a "trailing" parameter that contains spaces and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine(':nick@example.org TEST :hello world');

            expect(msgObj).to.containSubset({
                nick: 'nick',
                hostname: 'example.org',
                command: 'TEST',
                params: ['hello world']
            });
        });

        it('should parse a command with a "trailing" parameter that contains spaces and a nick!ident@hostname prefix', function() {
            const msgObj = parseIrcLine(':nick!ident@example.org TEST :hello world');

            expect(msgObj).to.containSubset({
                nick: 'nick',
                ident: 'ident',
                hostname: 'example.org',
                command: 'TEST',
                params: ['hello world']
            });
        });

        it('should parse a message that has a tag with no command', function() {
            const msgObj = parseIrcLine('@foo');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                },
            });
        });

        it('should parse a message that has a tag with no value', function() {
            const msgObj = parseIrcLine('@foo TEST');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                },
                command: 'TEST'
            });
        });

        it('should parse a message that has a tag with a value', function() {
            const msgObj = parseIrcLine('@foo=bar TEST');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'bar'
                },
                command: 'TEST'
            });
        });

        it('should parse a message that has equals but no value', function() {
            const msgObj = parseIrcLine('@foo= TEST');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: ''
                },
                command: 'TEST'
            });
        });

        it('should parse a message that has equals and semicolon right after', function() {
            const msgObj = parseIrcLine('@foo=; TEST');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: ''
                },
                command: 'TEST'
            });
        });

        it('should parse a message that has multiple tags with no value', function() {
            const msgObj = parseIrcLine('@foo;bar TEST');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                    bar: '',
                },
                command: 'TEST'
            });
        });

        it('should parse a message that has multiple tags where one has a value and one does not', function() {
            const msgObj = parseIrcLine('@foo=bar;baz TEST');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'bar',
                    baz: '',
                },
                command: 'TEST'
            });
        });

        it('should parse a message that has a tag with no value and a hostname prefix with no command', function() {
            const msgObj = parseIrcLine('@foo :irc.example.org');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                },
                command: '',
                prefix: 'irc.example.org'
            });
        });

        it('should parse a message that has a tag with no value and a hostname prefix', function() {
            const msgObj = parseIrcLine('@foo :irc.example.org TEST');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                },
                command: 'TEST',
                prefix: 'irc.example.org'
            });
        });

        it('should parse a message that has a tag with no value and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo :nick@example.org TEST');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                },
                command: 'TEST',
                nick: 'nick',
                hostname: 'example.org'
            });
        });

        it('should parse a message that has a tag with no value and a nick!ident@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo :nick!ident@example.org TEST');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                },
                command: 'TEST',
                nick: 'nick',
                ident: 'ident',
                hostname: 'example.org'
            });
        });

        it('should parse a message that has a tag with a value and a hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=bar :irc.example.org TEST');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'bar'
                },
                command: 'TEST',
                prefix: 'irc.example.org'
            });
        });

        it('should parse a message that has a tag with a value and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=bar :nick@example.org TEST');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'bar'
                },
                command: 'TEST',
                nick: 'nick',
                hostname: 'example.org'
            });
        });

        it('should parse a message that has a tag with a value and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=bar :nick@example.org TEST');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'bar'
                },
                command: 'TEST',
                nick: 'nick',
                hostname: 'example.org'
            });
        });

        it('should parse a message that has multiple tags with no value and a hostname prefix', function() {
            const msgObj = parseIrcLine('@foo;bar :irc.example.org TEST');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                    bar: '',
                },
                command: 'TEST',
                prefix: 'irc.example.org'
            });
        });

        it('should parse a message that has multiple tags with no value and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo;bar :nick@example.org TEST');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                    bar: '',
                },
                command: 'TEST',
                nick: 'nick',
                hostname: 'example.org'
            });
        });

        it('should parse a message that has multiple tags with no value and a nick!ident@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo;bar :nick!ident@example.org TEST');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                    bar: '',
                },
                command: 'TEST',
                nick: 'nick',
                ident: 'ident',
                hostname: 'example.org'
            });
        });

        it('should parse a message that has multiple tags where one has a value and one does not and a hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=bar;baz :irc.example.org TEST');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'bar',
                    baz: '',
                },
                command: 'TEST',
                prefix: 'irc.example.org'
            });
        });

        it('should parse a message that has multiple tags where one has a value and one does not and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=bar;baz :nick@example.org TEST');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'bar',
                    baz: '',
                },
                command: 'TEST',
                nick: 'nick',
                hostname: 'example.org'
            });
        });

        it('should parse a message that has multiple tags where one has a value and one does not and a nick!ident@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=bar;baz :nick!ident@example.org TEST');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'bar',
                    baz: '',
                },
                command: 'TEST',
                nick: 'nick',
                ident: 'ident',
                hostname: 'example.org'
            });
        });

        it('should parse a message that has a tag with no value, a single parameter and a hostname prefix', function() {
            const msgObj = parseIrcLine('@foo :irc.example.org TEST bar');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                },
                command: 'TEST',
                prefix: 'irc.example.org',
                params: ['bar']
            });
        });

        it('should parse a message that has a tag with no value, a single parameter and a hostname prefix', function() {
            const msgObj = parseIrcLine('@foo :irc.example.org TEST bar');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                },
                command: 'TEST',
                prefix: 'irc.example.org',
                params: ['bar']
            });
        });

        it('should parse a message that has a tag with no value, a single "trailing" parameter and a hostname prefix', function() {
            const msgObj = parseIrcLine('@foo :irc.example.org TEST :bar');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                },
                command: 'TEST',
                prefix: 'irc.example.org',
                params: ['bar']
            });
        });

        it('should parse a message that has a tag with no value, a single empty "trailing" parameter and a hostname prefix', function() {
            const msgObj = parseIrcLine('@foo :irc.example.org TEST :');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                },
                command: 'TEST',
                prefix: 'irc.example.org',
                params: ['']
            });
        });

        it('should parse a message that has a tag with no value, multiple parameters and a hostname prefix', function() {
            const msgObj = parseIrcLine('@foo :irc.example.org TEST bar baz');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                },
                command: 'TEST',
                prefix: 'irc.example.org',
                params: ['bar', 'baz']
            });
        });

        it('should parse a message that has a tag with no value, multiple parameters (one of which is "trailing") and a hostname prefix', function() {
            const msgObj = parseIrcLine('@foo :irc.example.org TEST bar :baz');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                },
                command: 'TEST',
                prefix: 'irc.example.org',
                params: ['bar', 'baz']
            });
        });

        it('should parse a message that has a tag with no value, a "trailing" parameter that has spaces and a hostname prefix', function() {
            const msgObj = parseIrcLine('@foo :irc.example.org TEST :hello world');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                },
                command: 'TEST',
                prefix: 'irc.example.org',
                params: ['hello world']
            });
        });

        it('should parse a message that has a tag with no value, a single parameter and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo :nick@example.org TEST bar');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                },
                command: 'TEST',
                nick: 'nick',
                hostname: 'example.org',
                params: ['bar']
            });
        });

        it('should parse a message that has a tag with no value, a single parameter and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo :nick@example.org TEST bar');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                },
                command: 'TEST',
                nick: 'nick',
                hostname: 'example.org',
                params: ['bar']
            });
        });

        it('should parse a message that has a tag with no value, a single "trailing" parameter and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo :nick@example.org TEST :bar');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                },
                command: 'TEST',
                nick: 'nick',
                hostname: 'example.org',
                params: ['bar']
            });
        });

        it('should parse a message that has a tag with no value, a single empty "trailing" parameter and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo :nick@example.org TEST :');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                },
                command: 'TEST',
                nick: 'nick',
                hostname: 'example.org',
                params: ['']
            });
        });

        it('should parse a message that has a tag with no value, multiple parameters and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo :nick@example.org TEST bar baz');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                },
                command: 'TEST',
                nick: 'nick',
                hostname: 'example.org',
                params: ['bar', 'baz']
            });
        });

        it('should parse a message that has a tag with no value, multiple parameters (one of which is "trailing") and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo :nick@example.org TEST bar :baz');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                },
                command: 'TEST',
                nick: 'nick',
                hostname: 'example.org',
                params: ['bar', 'baz']
            });
        });

        it('should parse a message that has a tag with no value, a "trailing" parameter that has spaces and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo :nick@example.org TEST :hello world');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                },
                command: 'TEST',
                nick: 'nick',
                hostname: 'example.org',
                params: ['hello world']
            });
        });

        it('should parse a message that has a tag with no value, a single parameter and a nick!ident@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo :nick!ident@example.org TEST bar');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                },
                command: 'TEST',
                nick: 'nick',
                ident: 'ident',
                hostname: 'example.org',
                params: ['bar']
            });
        });

        it('should parse a message that has a tag with no value, a single parameter and a nick!ident@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo :nick!ident@example.org TEST bar');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                },
                command: 'TEST',
                nick: 'nick',
                ident: 'ident',
                hostname: 'example.org',
                params: ['bar']
            });
        });

        it('should parse a message that has a tag with no value, a single "trailing" parameter and a nick!ident@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo :nick!ident@example.org TEST :bar');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                },
                command: 'TEST',
                nick: 'nick',
                ident: 'ident',
                hostname: 'example.org',
                params: ['bar']
            });
        });

        it('should parse a message that has a tag with no value, a single empty "trailing" parameter and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo :nick!ident@example.org TEST :');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                },
                command: 'TEST',
                nick: 'nick',
                ident: 'ident',
                hostname: 'example.org',
                params: ['']
            });
        });

        it('should parse a message that has a tag with no value, multiple parameters and a nick!ident@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo :nick!ident@example.org TEST bar baz');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                },
                command: 'TEST',
                nick: 'nick',
                ident: 'ident',
                hostname: 'example.org',
                params: ['bar', 'baz']
            });
        });

        it('should parse a message that has a tag with no value, multiple parameters (one of which is "trailing") and a nick!ident@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo :nick!ident@example.org TEST bar :baz');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                },
                command: 'TEST',
                nick: 'nick',
                ident: 'ident',
                hostname: 'example.org',
                params: ['bar', 'baz']
            });
        });

        it('should parse a message that has a tag with no value, a "trailing" parameter that has spaces and a nick!ident@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo :nick!ident@example.org TEST :hello world');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                },
                command: 'TEST',
                nick: 'nick',
                ident: 'ident',
                hostname: 'example.org',
                params: ['hello world']
            });
        });

        it('should parse a message that has a tag with a value, a single parameter and a hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=testvalue :irc.example.org TEST bar');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'testvalue'
                },
                command: 'TEST',
                prefix: 'irc.example.org',
                params: ['bar']
            });
        });

        it('should parse a message that has a tag with a value, a single parameter and a hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=testvalue :irc.example.org TEST bar');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'testvalue'
                },
                command: 'TEST',
                prefix: 'irc.example.org',
                params: ['bar']
            });
        });

        it('should parse a message that has a tag with a value, a single "trailing" parameter and a hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=testvalue :irc.example.org TEST :bar');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'testvalue'
                },
                command: 'TEST',
                prefix: 'irc.example.org',
                params: ['bar']
            });
        });

        it('should parse a message that has a tag with a value, a single empty "trailing" parameter and a hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=testvalue :irc.example.org TEST :');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'testvalue'
                },
                command: 'TEST',
                prefix: 'irc.example.org',
                params: ['']
            });
        });

        it('should parse a message that has a tag with a value, multiple parameters and a hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=testvalue :irc.example.org TEST bar baz');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'testvalue'
                },
                command: 'TEST',
                prefix: 'irc.example.org',
                params: ['bar', 'baz']
            });
        });

        it('should parse a message that has a tag with a value, multiple parameters (one of which is "trailing") and a hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=testvalue :irc.example.org TEST bar :baz');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'testvalue'
                },
                command: 'TEST',
                prefix: 'irc.example.org',
                params: ['bar', 'baz']
            });
        });

        it('should parse a message that has a tag with a value, a "trailing" parameter that has spaces and a hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=testvalue :irc.example.org TEST :hello world');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'testvalue'
                },
                command: 'TEST',
                prefix: 'irc.example.org',
                params: ['hello world']
            });
        });

        it('should parse a message that has a tag with a value, a single parameter and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=testvalue :nick@example.org TEST bar');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'testvalue'
                },
                command: 'TEST',
                nick: 'nick',
                hostname: 'example.org',
                params: ['bar']
            });
        });

        it('should parse a message that has a tag with a value, a single parameter and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=testvalue :nick@example.org TEST bar');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'testvalue'
                },
                command: 'TEST',
                nick: 'nick',
                hostname: 'example.org',
                params: ['bar']
            });
        });

        it('should parse a message that has a tag with a value, a single "trailing" parameter and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=testvalue :nick@example.org TEST :bar');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'testvalue'
                },
                command: 'TEST',
                nick: 'nick',
                hostname: 'example.org',
                params: ['bar']
            });
        });

        it('should parse a message that has a tag with a value, a single empty "trailing" parameter and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=testvalue :nick@example.org TEST :');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'testvalue'
                },
                command: 'TEST',
                nick: 'nick',
                hostname: 'example.org',
                params: ['']
            });
        });

        it('should parse a message that has a tag with a value, multiple parameters and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=testvalue :nick@example.org TEST bar baz');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'testvalue'
                },
                command: 'TEST',
                nick: 'nick',
                hostname: 'example.org',
                params: ['bar', 'baz']
            });
        });

        it('should parse a message that has a tag with a value, multiple parameters (one of which is "trailing") and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=testvalue :nick@example.org TEST bar :baz');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'testvalue'
                },
                command: 'TEST',
                nick: 'nick',
                hostname: 'example.org',
                params: ['bar', 'baz']
            });
        });
        it('should parse a message that has a tag with a value, a "trailing" parameter that has spaces and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=testvalue :nick@example.org TEST :hello world');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'testvalue'
                },
                command: 'TEST',
                nick: 'nick',
                hostname: 'example.org',
                params: ['hello world']
            });
        });

        it('should parse a message that has a tag with a value, a single parameter and a nick!ident@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=testvalue :nick!ident@example.org TEST bar');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'testvalue'
                },
                command: 'TEST',
                nick: 'nick',
                ident: 'ident',
                hostname: 'example.org',
                params: ['bar']
            });
        });

        it('should parse a message that has a tag with a value, a single parameter and a nick!ident@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=testvalue :nick!ident@example.org TEST bar');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'testvalue'
                },
                command: 'TEST',
                nick: 'nick',
                ident: 'ident',
                hostname: 'example.org',
                params: ['bar']
            });
        });

        it('should parse a message that has a tag with a value, a single "trailing" parameter and a nick!ident@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=testvalue :nick!ident@example.org TEST :bar');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'testvalue'
                },
                command: 'TEST',
                nick: 'nick',
                ident: 'ident',
                hostname: 'example.org',
                params: ['bar']
            });
        });

        it('should parse a message that has a tag with a value, a single empty "trailing" parameter and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=testvalue :nick!ident@example.org TEST :');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'testvalue'
                },
                command: 'TEST',
                nick: 'nick',
                ident: 'ident',
                hostname: 'example.org',
                params: ['']
            });
        });

        it('should parse a message that has a tag with a value, multiple parameters and a nick!ident@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=testvalue :nick!ident@example.org TEST bar baz');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'testvalue'
                },
                command: 'TEST',
                nick: 'nick',
                ident: 'ident',
                hostname: 'example.org',
                params: ['bar', 'baz']
            });
        });

        it('should parse a message that has a tag with a value, multiple parameters (one of which is "trailing") and a nick!ident@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=testvalue :nick!ident@example.org TEST bar :baz');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'testvalue'
                },
                command: 'TEST',
                nick: 'nick',
                ident: 'ident',
                hostname: 'example.org',
                params: ['bar', 'baz']
            });
        });

        it('should parse a message that has a tag with a value, a "trailing" parameter that has spaces and a nick!ident@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=testvalue :nick!ident@example.org TEST :hello world');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'testvalue'
                },
                command: 'TEST',
                nick: 'nick',
                ident: 'ident',
                hostname: 'example.org',
                params: ['hello world']
            });
        });

        it('should parse a message that has multiple tags with no values, a single parameter and a hostname prefix', function() {
            const msgObj = parseIrcLine('@foo;bar :irc.example.org TEST bar');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                    bar: '',
                },
                command: 'TEST',
                prefix: 'irc.example.org',
                params: ['bar']
            });
        });

        it('should parse a message that has multiple tags with no values, a single parameter and a hostname prefix', function() {
            const msgObj = parseIrcLine('@foo;bar :irc.example.org TEST bar');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                    bar: '',
                },
                command: 'TEST',
                prefix: 'irc.example.org',
                params: ['bar']
            });
        });

        it('should parse a message that has multiple tags with no values, a single "trailing" parameter and a hostname prefix', function() {
            const msgObj = parseIrcLine('@foo;bar :irc.example.org TEST :bar');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                    bar: '',
                },
                command: 'TEST',
                prefix: 'irc.example.org',
                params: ['bar']
            });
        });

        it('should parse a message that has multiple tags with no values, a single empty "trailing" parameter and a hostname prefix', function() {
            const msgObj = parseIrcLine('@foo;bar :irc.example.org TEST :');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                    bar: '',
                },
                command: 'TEST',
                prefix: 'irc.example.org',
                params: ['']
            });
        });

        it('should parse a message that has multiple tags with no values, multiple parameters and a hostname prefix', function() {
            const msgObj = parseIrcLine('@foo;bar :irc.example.org TEST bar baz');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                    bar: '',
                },
                command: 'TEST',
                prefix: 'irc.example.org',
                params: ['bar', 'baz']
            });
        });

        it('should parse a message that has multiple tags with no values, multiple parameters (one of which is "trailing") and a hostname prefix', function() {
            const msgObj = parseIrcLine('@foo;bar :irc.example.org TEST bar :baz');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                    bar: '',
                },
                command: 'TEST',
                prefix: 'irc.example.org',
                params: ['bar', 'baz']
            });
        });

        it('should parse a message that has multiple tags with no values, a "trailing" parameter that has spaces and a hostname prefix', function() {
            const msgObj = parseIrcLine('@foo;bar :irc.example.org TEST :hello world');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                    bar: '',
                },
                command: 'TEST',
                prefix: 'irc.example.org',
                params: ['hello world']
            });
        });

        it('should parse a message that has multiple tags with no values, a single parameter and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo;bar :nick@example.org TEST bar');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                    bar: '',
                },
                command: 'TEST',
                nick: 'nick',
                hostname: 'example.org',
                params: ['bar']
            });
        });

        it('should parse a message that has multiple tags with no values, a single parameter and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo;bar :nick@example.org TEST bar');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                    bar: '',
                },
                command: 'TEST',
                nick: 'nick',
                hostname: 'example.org',
                params: ['bar']
            });
        });

        it('should parse a message that has multiple tags with no values, a single "trailing" parameter and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo;bar :nick@example.org TEST :bar');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                    bar: '',
                },
                command: 'TEST',
                nick: 'nick',
                hostname: 'example.org',
                params: ['bar']
            });
        });

        it('should parse a message that has multiple tags with no values, a single empty "trailing" parameter and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo;bar :nick@example.org TEST :');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                    bar: '',
                },
                command: 'TEST',
                nick: 'nick',
                hostname: 'example.org',
                params: ['']
            });
        });

        it('should parse a message that has multiple tags with no values, multiple parameters and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo;bar :nick@example.org TEST bar baz');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                    bar: '',
                },
                command: 'TEST',
                nick: 'nick',
                hostname: 'example.org',
                params: ['bar', 'baz']
            });
        });

        it('should parse a message that has multiple tags with no values, multiple parameters (one of which is "trailing") and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo;bar :nick@example.org TEST bar :baz');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                    bar: '',
                },
                command: 'TEST',
                nick: 'nick',
                hostname: 'example.org',
                params: ['bar', 'baz']
            });
        });
        it('should parse a message that has multiple tags with no values, a "trailing" parameter that has spaces and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo;bar :nick@example.org TEST :hello world');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                    bar: '',
                },
                command: 'TEST',
                nick: 'nick',
                hostname: 'example.org',
                params: ['hello world']
            });
        });

        it('should parse a message that has multiple tags with no values, a single parameter and a nick!ident@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo;bar :nick!ident@example.org TEST bar');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                    bar: '',
                },
                command: 'TEST',
                nick: 'nick',
                ident: 'ident',
                hostname: 'example.org',
                params: ['bar']
            });
        });

        it('should parse a message that has multiple tags with no values, a single parameter and a nick!ident@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo;bar :nick!ident@example.org TEST bar');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                    bar: '',
                },
                command: 'TEST',
                nick: 'nick',
                ident: 'ident',
                hostname: 'example.org',
                params: ['bar']
            });
        });

        it('should parse a message that has multiple tags with no values, a single "trailing" parameter and a nick!ident@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo;bar :nick!ident@example.org TEST :bar');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                    bar: '',
                },
                command: 'TEST',
                nick: 'nick',
                ident: 'ident',
                hostname: 'example.org',
                params: ['bar']
            });
        });

        it('should parse a message that has multiple tags with no values, a single empty "trailing" parameter and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo;bar :nick!ident@example.org TEST :');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                    bar: '',
                },
                command: 'TEST',
                nick: 'nick',
                ident: 'ident',
                hostname: 'example.org',
                params: ['']
            });
        });

        it('should parse a message that has multiple tags with no values, multiple parameters and a nick!ident@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo;bar :nick!ident@example.org TEST bar baz');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                    bar: '',
                },
                command: 'TEST',
                nick: 'nick',
                ident: 'ident',
                hostname: 'example.org',
                params: ['bar', 'baz']
            });
        });

        it('should parse a message that has multiple tags with no values, multiple parameters (one of which is "trailing") and a nick!ident@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo;bar :nick!ident@example.org TEST bar :baz');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                    bar: '',
                },
                command: 'TEST',
                nick: 'nick',
                ident: 'ident',
                hostname: 'example.org',
                params: ['bar', 'baz']
            });
        });

        it('should parse a message that has multiple tags with no values, a "trailing" parameter that has spaces and a nick!ident@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo;bar :nick!ident@example.org TEST :hello world');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: '',
                    bar: '',
                },
                command: 'TEST',
                nick: 'nick',
                ident: 'ident',
                hostname: 'example.org',
                params: ['hello world']
            });
        });

        it('should parse a message that has multiple tags one with a value, a single parameter and a hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=bar;baz :irc.example.org TEST bar');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'bar',
                    baz: '',
                },
                command: 'TEST',
                prefix: 'irc.example.org',
                params: ['bar']
            });
        });

        it('should parse a message that has multiple tags one with a value, a single parameter and a hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=bar;baz :irc.example.org TEST bar');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'bar',
                    baz: '',
                },
                command: 'TEST',
                prefix: 'irc.example.org',
                params: ['bar']
            });
        });

        it('should parse a message that has multiple tags one with a value, a single "trailing" parameter and a hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=bar;baz :irc.example.org TEST :bar');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'bar',
                    baz: '',
                },
                command: 'TEST',
                prefix: 'irc.example.org',
                params: ['bar']
            });
        });

        it('should parse a message that has multiple tags one with a value, a single empty "trailing" parameter and a hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=bar;baz :irc.example.org TEST :');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'bar',
                    baz: '',
                },
                command: 'TEST',
                prefix: 'irc.example.org',
                params: ['']
            });
        });

        it('should parse a message that has multiple tags one with a value, multiple parameters and a hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=bar;baz :irc.example.org TEST bar baz');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'bar',
                    baz: '',
                },
                command: 'TEST',
                prefix: 'irc.example.org',
                params: ['bar', 'baz']
            });
        });

        it('should parse a message that has multiple tags one with a value, multiple parameters (one of which is "trailing") and a hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=bar;baz :irc.example.org TEST bar :baz');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'bar',
                    baz: '',
                },
                command: 'TEST',
                prefix: 'irc.example.org',
                params: ['bar', 'baz']
            });
        });

        it('should parse a message that has multiple tags one with a value, a "trailing" parameter that has spaces and a hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=bar;baz :irc.example.org TEST :hello world');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'bar',
                    baz: '',
                },
                command: 'TEST',
                prefix: 'irc.example.org',
                params: ['hello world']
            });
        });

        it('should parse a message that has multiple tags one with a value, a single parameter and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=bar;baz :nick@example.org TEST bar');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'bar',
                    baz: '',
                },
                command: 'TEST',
                nick: 'nick',
                hostname: 'example.org',
                params: ['bar']
            });
        });

        it('should parse a message that has multiple tags one with a value, a single parameter and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=bar;baz :nick@example.org TEST bar');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'bar',
                    baz: '',
                },
                command: 'TEST',
                nick: 'nick',
                hostname: 'example.org',
                params: ['bar']
            });
        });

        it('should parse a message that has multiple tags one with a value, a single "trailing" parameter and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=bar;baz :nick@example.org TEST :bar');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'bar',
                    baz: '',
                },
                command: 'TEST',
                nick: 'nick',
                hostname: 'example.org',
                params: ['bar']
            });
        });

        it('should parse a message that has multiple tags one with a value, a single empty "trailing" parameter and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=bar;baz :nick@example.org TEST :');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'bar',
                    baz: '',
                },
                command: 'TEST',
                nick: 'nick',
                hostname: 'example.org',
                params: ['']
            });
        });

        it('should parse a message that has multiple tags one with a value, multiple parameters and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=bar;baz :nick@example.org TEST bar baz');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'bar',
                    baz: '',
                },
                command: 'TEST',
                nick: 'nick',
                hostname: 'example.org',
                params: ['bar', 'baz']
            });
        });

        it('should parse a message that has multiple tags one with a value, multiple parameters (one of which is "trailing") and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=bar;baz :nick@example.org TEST bar :baz');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'bar',
                    baz: '',
                },
                command: 'TEST',
                nick: 'nick',
                hostname: 'example.org',
                params: ['bar', 'baz']
            });
        });

        it('should parse a message that has multiple tags one with a value, a "trailing" parameter that has spaces and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=bar;baz :nick@example.org TEST :hello world');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'bar',
                    baz: '',
                },
                command: 'TEST',
                nick: 'nick',
                hostname: 'example.org',
                params: ['hello world']
            });
        });

        it('should parse a message that has multiple tags one with a value, a single parameter and a nick!ident@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=bar;baz :nick!ident@example.org TEST bar');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'bar',
                    baz: '',
                },
                command: 'TEST',
                nick: 'nick',
                ident: 'ident',
                hostname: 'example.org',
                params: ['bar']
            });
        });

        it('should parse a message that has multiple tags one with a value, a single parameter and a nick!ident@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=bar;baz :nick!ident@example.org TEST bar');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'bar',
                    baz: '',
                },
                command: 'TEST',
                nick: 'nick',
                ident: 'ident',
                hostname: 'example.org',
                params: ['bar']
            });
        });

        it('should parse a message that has multiple tags one with a value, a single "trailing" parameter and a nick!ident@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=bar;baz :nick!ident@example.org TEST :bar');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'bar',
                    baz: '',
                },
                command: 'TEST',
                nick: 'nick',
                ident: 'ident',
                hostname: 'example.org',
                params: ['bar']
            });
        });

        it('should parse a message that has multiple tags one with a value, a single empty "trailing" parameter and a nick@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=bar;baz :nick!ident@example.org TEST :');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'bar',
                    baz: '',
                },
                command: 'TEST',
                nick: 'nick',
                ident: 'ident',
                hostname: 'example.org',
                params: ['']
            });
        });

        it('should parse a message that has multiple tags one with a value, multiple parameters and a nick!ident@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=bar;baz :nick!ident@example.org TEST bar baz');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'bar',
                    baz: '',
                },
                command: 'TEST',
                nick: 'nick',
                ident: 'ident',
                hostname: 'example.org',
                params: ['bar', 'baz']
            });
        });

        it('should parse a message that has multiple tags one with a value, multiple parameters (one of which is "trailing") and a nick!ident@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=bar;baz :nick!ident@example.org TEST bar :baz');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'bar',
                    baz: '',
                },
                command: 'TEST',
                nick: 'nick',
                ident: 'ident',
                hostname: 'example.org',
                params: ['bar', 'baz']
            });
        });

        it('should parse a message that has multiple tags one with a value, a "trailing" parameter that has spaces and a nick!ident@hostname prefix', function() {
            const msgObj = parseIrcLine('@foo=bar;baz :nick!ident@example.org TEST :hello world');

            expect(msgObj).to.containSubset({
                tags: {
                    foo: 'bar',
                    baz: '',
                },
                command: 'TEST',
                nick: 'nick',
                ident: 'ident',
                hostname: 'example.org',
                params: ['hello world']
            });
        });

        it('should parse a message that has params that contain, but do not start with, a colon', function() {
            const msgObj = parseIrcLine(':irc.example.org 005 nick SECURELIST SILENCE=32 SSL=[::]:6697 STATUSMSG=!@%+ TOPICLEN=1000 UHNAMES USERIP VBANLIST WALLCHOPS WALLVOICES WATCH=64 :are supported by this server');

            expect(msgObj).to.containSubset({
                command: '005',
                hostname: 'irc.example.org',
                params: ['nick', 'SECURELIST', 'SILENCE=32', 'SSL=[::]:6697', 'STATUSMSG=!@%+', 'TOPICLEN=1000', 'UHNAMES', 'USERIP', 'VBANLIST', 'WALLCHOPS', 'WALLVOICES', 'WATCH=64', 'are supported by this server']
            });
        });

        it('should remove all new lines', function() {
            const msgObj = parseIrcLine('\n\r:irc.example.org TEST foo :bar  \r\n');

            expect(msgObj).to.containSubset({
                prefix: 'irc.example.org',
                command: 'TEST',
                params: ['foo', 'bar  ']
            });
        });

        it('should keep whitespace in trailing parameter', function() {
            const msgObj = parseIrcLine(':irc.example.org TEST foo :bar  ');

            expect(msgObj).to.containSubset({
                prefix: 'irc.example.org',
                command: 'TEST',
                params: ['foo', 'bar  ']
            });
        });
    });
});
