/*globals describe, it */
/* jshint -W024 */
/* jshint expr:true */
var chai = require('chai'),
    expect = chai.expect,
    mocks = require('../../mocks'),
    parse = require('../../../src/ircLineParser'),
    sinonChai = require('sinon-chai'),
    misc = require('../../../src/commands/handlers/misc');

chai.use(sinonChai);

describe('src/commands/handlers/misc.js', function() {

    describe('PING handler', function() {

        it('should respond with the appropriate PONG message', function () {
            var mock = mocks.IrcCommandHandler([misc]);
            mock.handlers.PING(parse("PING example.com"));
            expect(mock.spies.connection.write).to.have.been.calledOnce;
            expect(mock.spies.connection.write).to.have.been.calledWith("PONG example.com");
        });

    });

    describe('PONG handler', function() {

        it('should respond with the appropriate PONG message', function () {
            var mock = mocks.IrcCommandHandler([misc]);
            mock.handlers.PONG(parse("PONG one.example.com two.example.com"));
            expect(mock.spies.emit).to.have.been.calledOnce;
            expect(mock.spies.emit).to.have.been.calledWith("pong", {
                message: "two.example.com"
            });
        });

    });

});
