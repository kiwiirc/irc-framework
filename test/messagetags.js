'use strict';
/* globals describe, it */
const chai = require('chai');
const MessageTags = require('../src/messagetags');
const expect = chai.expect;
const assert = chai.assert;

chai.use(require('chai-subset'));

describe('src/messagetags.js', function() {
    describe('CLIENTTAGDENY= parsing', function() {
        it('should parse CLIENTTAGDENY=', function() {
            assert.deepEqual(MessageTags.parseDenylist(''), {
                allBlockedByDefault: false,
                explicitlyDenied: [],
                explicitlyAccepted: []
            });
        });

        it('should parse CLIENTTAGDENY=*,-a', function() {
            assert.deepEqual(MessageTags.parseDenylist('*,-a'), {
                allBlockedByDefault: true,
                explicitlyAccepted: ['a'],
                explicitlyDenied: []
            });
        });

        it('should parse CLIENTTAGDENY=a,b', function() {
            assert.deepEqual(MessageTags.parseDenylist('a,b'), {
                allBlockedByDefault: false,
                explicitlyAccepted: [],
                explicitlyDenied: ['a', 'b']
            });
        });
    });

    describe('CLIENTTAGDENY= logic', function() {
        it('should block all tags (`b`) with * and no exception', function() {
            assert.isTrue(MessageTags.isBlocked(MessageTags.parseDenylist('*'), 'b'));
        });

        it('should not block all tags with * and exceptions (`c`, `a`)', function() {
            assert.isFalse(MessageTags.isBlocked(MessageTags.parseDenylist('*,-c,-a'), 'a'));
            assert.isFalse(MessageTags.isBlocked(MessageTags.parseDenylist('*,-c,-a'), 'c'));
            assert.isTrue(MessageTags.isBlocked(MessageTags.parseDenylist('*,-c,-a'), 'b'));
        });

        it('should block a specific tag if no * is present', function() {
            assert.isTrue(MessageTags.isBlocked(MessageTags.parseDenylist('a'), 'a'));
            assert.isFalse(MessageTags.isBlocked(MessageTags.parseDenylist('a'), 'b'));
        });
    });

    describe('value encoding', function() {
        it('should decode characters to correct strings', function() {
            const plain = "Some people use IRC; others don't \\o/ Note: Use IRC\r\n";
            const encoded = "Some\\speople\\suse\\sIRC\\:\\sothers\\sdon't\\s\\\\o/\\sNote:\\sUse\\sIRC\\r\\n";

            assert.equal(MessageTags.decodeValue(encoded), plain);
        });

        it('should encode characters to correct strings', function() {
            const plain = "Some people use IRC; others don't \\o/ Note: Use IRC\r\n";
            const encoded = "Some\\speople\\suse\\sIRC\\:\\sothers\\sdon't\\s\\\\o/\\sNote:\\sUse\\sIRC\\r\\n";

            assert.equal(MessageTags.encodeValue(plain), encoded);
        });
    });

    describe('encoding', function() {
        it('should encode from an object', function() {
            const plain = {
                foo: 'bar',
                tls: true,
                string: 'with space',
            };
            const encoded = 'foo=bar;tls;string=with\\sspace';

            assert.equal(MessageTags.encode(plain), encoded);
        });

        it('should allow changing separator to space', function() {
            const plain = {
                foo: 'bar',
                tls: true,
                string: 'with space',
            };
            const encoded = 'foo=bar tls string=with\\sspace';

            assert.equal(MessageTags.encode(plain, ' '), encoded);
        });

        it('should return an empty string', function() {
            assert.equal(MessageTags.encode({}), '');
        });
    });

    describe('parsing', function() {
        it('should decode tag string into an object', function() {
            const plain = 'foo=bar;baz;';
            const tags = MessageTags.decode(plain);
            expect(tags).to.containSubset({
                foo: 'bar',
                baz: '',
            });
        });

        it('should decode a tag string into an object with correct characters', function() {
            const plain = 'foo=bar;baz;name=prawn\\ssalad';
            const tags = MessageTags.decode(plain);
            expect(tags).to.deep.equal({
                foo: 'bar',
                baz: '',
                name: 'prawn salad',
            });
        });

        it('should handle equals signs in the tag value', function() {
            const plain = 'foo=bar=baz;hello;world=monde';
            const tags = MessageTags.decode(plain);
            expect(tags).to.deep.equal({
                foo: 'bar=baz',
                hello: '',
                world: 'monde',
            });
        });

        it('should work with duplicate tags', function() {
            const plain = 'foo;foo=one;foo=two;foo=lastvalue';
            const tags = MessageTags.decode(plain);
            expect(tags).to.deep.equal({
                foo: 'lastvalue',
            });
        });

        it('should work with empty values', function() {
            const plain = 'foo;bar=;baz;';
            const tags = MessageTags.decode(plain);
            expect(tags).to.deep.equal({
                foo: '',
                bar: '',
                baz: '',
            });
        });

        it('should handle invalid escapes', function() {
            const plain = 'foo=test\\;bar=\\b\\sinvalidescape';
            const tags = MessageTags.decode(plain);
            expect(tags).to.deep.equal({
                foo: 'test',
                bar: 'b invalidescape',
            });
        });
    });
});
