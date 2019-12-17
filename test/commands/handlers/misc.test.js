'use strict';

/*globals describe, it */
/* jshint -W024 */
/* jshint expr:true */
var chai = require('chai'),
    expect = chai.expect,
    mocks = require('../../mocks'),
    parse = require('../../../src/irclineparser'),
    sinonChai = require('sinon-chai'),
    misc = require('../../../src/commands/handlers/misc'),
    IrcCommand = require('../../../src/commands/command');

chai.use(sinonChai);

describe('src/commands/handlers/misc.js', function() {

    describe('PING handler', function() {

        it('should respond with the appropriate PONG message', function () {
            var mock = mocks.IrcCommandHandler([misc]);
            mock.handlers.PING(parse("PING example.com"), mock.spies);
            expect(mock.spies.connection.write).to.have.been.calledOnce;
            expect(mock.spies.connection.write).to.have.been.calledWith("PONG example.com");
        });

    });

    describe('PONG handler', function() {

        it('should emit the appropriate PONG event', function () {
            var mock = mocks.IrcCommandHandler([misc]);
            var cmd = new IrcCommand("PONG", {
                params: ["one.example.com", "two.example.com"],
                tags: {
                    time: '2011-10-10T14:48:00Z',
                }
            });
            mock.handlers.PONG(cmd, mock.spies);
            expect(mock.spies.network.addServerTimeOffset).to.have.been.calledOnce;
            expect(mock.spies.emit).to.have.been.calledOnce;
            expect(mock.spies.emit).to.have.been.calledWith('pong', {
                message: "two.example.com",
                time: 1318258080000,
                tags: {
                    time: '2011-10-10T14:48:00Z'
                }
            });
        });

    });

});
