"use strict";
/*globals describe, it */
let chai = require('chai'),
    IrcClient = require('../src/client'),
    expect = chai.expect;

chai.use(require('chai-subset'));

describe('src/client.js', function () {
    describe('stringToBlocks', function () {
        it('should return an array if input fits in a single block', function () {
            expect((new IrcClient()).stringToBlocks("test")).to.deep.equal(["test"]);
        });

        it('should correctly split complicated emojis', function () {
            const family = "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}"; // full family emoji - 11 characters
            let plain = `testing emoji splitting ${family}${family}${family} test string ${family}`;
            let blocks = [
                'testing emoji s',
                'plitting ',
                family,
                family,
                family + ' tes',
                't string ',
                family
            ];

            expect((new IrcClient()).stringToBlocks(plain, 15)).to.deep.equal(blocks);
        });
        
        it('should split ascii string', function () {
            let plain = 'just a normal string, testing word splitting :)';
            let blocks = [
                'just a normal s',
                'tring, testing ',
                'word splitting ',
                ':)'
            ];

            expect((new IrcClient()).stringToBlocks(plain, 15)).to.deep.equal(blocks);
        });
        
        it('should still split if input is bad in second block', function () {
            let plain = "test \u200d\u200d\u200d\u200d\u200d\u200d\u200d";
            let blocks = [
                'te',
                'st',
                " \u200d",
                "\u200d\u200d",
                "\u200d\u200d",
                "\u200d\u200d"
            ];
            
            expect((new IrcClient()).stringToBlocks(plain, 2)).to.deep.equal(blocks);
        });
        
        it('should still split if input is bad', function () {
            let plain = "\u200d".repeat(10);
            let blocks = [
                "\u200d\u200d",
                "\u200d\u200d",
                "\u200d\u200d",
                "\u200d\u200d",
                "\u200d\u200d"
            ];
            
            expect((new IrcClient()).stringToBlocks(plain, 2)).to.deep.equal(blocks);
        });
    });
});
