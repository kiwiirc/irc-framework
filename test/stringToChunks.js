'use strict';
/* globals describe, it */
const chai = require('chai');
const {
    lineBreak,
    WordTooLargeForLineError,
    GraphemeTooLargeForLineError,
    CodepointTooLargeForLineError,
} = require('../src/linebreak');
const expect = chai.expect;

chai.use(require('chai-subset'));

describe('src/client.js', function() {
    describe('lineBreak', function() {
        it('should return an array if input fits in a single block', function() {
            expect(
                [...lineBreak('test', { bytes: 100, allowBreakingWords: true })]
            ).to.deep.equal(['test']);
        });

        it('should correctly split complicated emojis', function() {
            // full family emoji - 11 characters
            const family = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}';
            const plain = `testing emoji splitting ${family}${family}${family} test string ${family}`;
            const blocks = [
                'testing emoji splitting',
                family,
                family,
                family,
                'test string',
                family
            ];

            expect(
                [...lineBreak(plain, { bytes: 28, allowBreakingWords: true })]
            ).to.deep.equal(blocks);
        });

        it('should split even more complicated unicode', function() {
            const input = 'foo bar z̶͖̮̜̯̝͈̭̽̅̇̈́̓̐̈́̐́͜ȃ̶̖̹̰̭̘̩͙͎̰̠̳͛̓̕͝͝͝ĺ̶̢̢̢̺̪̯̮̘͕͎̜̮̂̌͊̾̒̈́́̈́̎̌͜͜͝͝g̴̱̟̤̞̤͙̦̗̹̦̠͋̊̈́̈́̓̈́̈́̕ȱ̶̧̡͓̜̥̝͊͜͜͝ 🏳️‍🌈 baz 👩‍👨‍👩‍👧‍👦‍👧‍👧‍👦 ok';

            const expected = [

                'foo bar z̶͖̮̜̯̝͈̭̽̅̇̈́̓̐̈́̐́͜', 'ȃ̶̖̹̰̭̘̩͙͎̰̠̳͛̓̕͝͝͝', 'ĺ̶̢̢̢̺̪̯̮̘͕͎̜̮̂̌͊̾̒̈́́̈́̎̌͜͜͝͝', 'g̴̱̟̤̞̤͙̦̗̹̦̠͋̊̈́̈́̓̈́̈́̕', 'ȱ̶̧̡͓̜̥̝͊͜͜͝ 🏳️‍🌈 baz', '👩‍👨‍👩‍👧‍👦‍👧‍👧‍👦 ok',
            ];

            expect(
                [...lineBreak(input, { bytes: 60, allowBreakingWords: true })]
            ).to.deep.equal(expected);
        });

        it('should split zalgo text by grapheme cluster', function() {
            const zalgo = ['z̸̩̉̿̐͗̾͘', 'a̷̮̭̠͍͐̋̏̈́̓̂̚', 'l̵̼̟̲̘̣͐̀̎̂', 'g̷̡̗̪̘̥͋͂͛́͘͝', 'ö̶̱̤̫̝̬̰́'];

            expect(
                [...lineBreak(zalgo.join(''), { bytes: 25, allowBreakingWords: true })]
            ).to.deep.equal(zalgo);
        });

        it('should split ascii string', function() {
            const plain = 'just a normal string, testing word splitting :)';
            const blocks = [
                'just a normal',
                'string, testing',
                'word splitting',
                ':)'
            ];

            expect(
                [...lineBreak(plain, { bytes: 15, allowBreakingWords: true })]
            ).to.deep.equal(blocks);
        });

        it('should still split if input is bad in second block', function() {
            const plain = 'testasdf \u200d\u200d\u200d\u200d\u200d\u200d\u200d';
            const blocks = [
                'testasd',
                'f \u200d',
                '\u200d\u200d',
                '\u200d\u200d',
                '\u200d\u200d',
            ];

            expect(
                [...lineBreak(plain, {
                    bytes: 7,
                    allowBreakingWords: true,
                    allowBreakingGraphemes: true,
                })]
            ).to.deep.equal(blocks);
        });

        it('should throw if word splitting is required but not allowed', function() {
            const plain = 'hsdfgjkhsdfjgkhsdkjfghsdkj';

            expect(
                () => [...lineBreak(plain, { bytes: 2 })]
            ).to.throw(WordTooLargeForLineError);
        });

        it('should throw if grapheme splitting is required but not allowed', function() {
            const plain = 'test \u200d\u200d\u200d\u200d\u200d\u200d\u200d';

            expect(
                () => [...lineBreak(plain, {
                    bytes: 10,
                    allowBreakingWords: true,
                    allowBreakingGraphemes: true,
                })]
            ).to.not.throw();

            expect(
                () => [...lineBreak(plain, {
                    bytes: 10,
                    allowBreakingWords: true,
                })]
            ).to.throw(GraphemeTooLargeForLineError);
        });

        it('should throw if codepoint splitting is required', function() {
            const plain = 'test \u200d\u200d\u200d\u200d\u200d\u200d\u200d';

            expect(
                () => [...lineBreak(plain, {
                    bytes: 1,
                    allowBreakingWords: true,
                    allowBreakingGraphemes: true,
                })]
            ).to.throw(CodepointTooLargeForLineError);
        });

        it('should still split if input is bad', function() {
            const plain = '\u200d'.repeat(10);
            const blocks = [
                '\u200d\u200d',
                '\u200d\u200d',
                '\u200d\u200d',
                '\u200d\u200d',
                '\u200d\u200d'
            ];

            expect([...lineBreak(plain, {
                bytes: 6,
                allowBreakingWords: true,
                allowBreakingGraphemes: true,
            })]).to.deep.equal(blocks);
        });
    });
});
