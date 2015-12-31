/*globals describe, it, beforeEach */
var sinon = require('sinon'),
    chai = require('chai'),
    expect = chai.expect,
    Handler = require('../src/commandhandler');

chai.use(require('sinon-chai'));

describe('src/ircLineParser.js', function () {
    var client, handler;

    beforeEach(function () {
        client = {};
        handler = new Handler(client);
    });

    describe('Handler#use', function () {

        it('should add a function to the handlers queue', function () {
            var fn = function () {};

            handler.use(fn);

            expect(handler.handlers[0]).to.equal(fn);
        });

        it('should add a function for a specific command to the handlers queue', function () {
            var fn = function () {};

            handler.use('test', fn);

            expect(handler.handlers[0]).to.contain({
                command: 'test',
                handler: fn
            });
        });

        it('should add a functions to the handlers queue when given an object', function () {
            var fn = function () { return 'hello world'; };

            handler.use({
                'test': fn
            });

            expect(handler.handlers[0]).to.contain({
                command: 'test'
            });

            expect(handler.handlers[0].handler()).to.equal('hello world');
        });

    });

    describe('Handler#dispatch', function () {

        it('should call handlers in a LIFO manner', sinon.test(function (done) {
            var message = { command: 'TEST' },
                fn2 = sinon.stub().yields(),
                fn3 = sinon.stub().yields(),
                fn1 = sinon.spy(function () { 
                    expect(fn3).to.have.been.calledWith(client, message);
                    expect(fn2).to.have.been.calledWith(client, message);
                    sinon.assert.callOrder(fn3, fn2, fn1);
                    done();
                }),
                clock = sinon.useFakeTimers();

            handler.use(fn1);
            handler.use(fn2);
            handler.use(fn3);

            handler.dispatch(message);
            clock.tick(10);
        }));

        it('should call handlers that handle a specific command when that command is dispatched', sinon.test(function (done) {
            var message = { command: 'TEST' },
                clock = sinon.useFakeTimers();

            handler.use('test', function () { 
                done();
            });

            handler.dispatch(message);
            clock.tick(10);
        }));

        it('should not call handlers that handle a specific command when a different command is dispatched', sinon.test(function (done) {
            var message = { command: 'TEST' },
                clock = sinon.useFakeTimers(),
                fn = sinon.stub().yields();

            handler.use('test', function () {
                expect(fn).not.to.have.been.calledWith(client, message);
                done();
            });
            handler.use('nottest', fn);

            handler.dispatch(message);
            clock.tick(10);
        }));

    });

});
