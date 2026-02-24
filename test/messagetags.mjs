'use strict';
/* globals describe, it */
const chai = require('chai');
const MessageTags = require('../src/messagetags');
const expect = chai.expect;
const assert = chai.assert;

chai.use(require('chai-subset'));

describe('src/messagetags.js', function() {
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
