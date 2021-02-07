/*globals describe, it, beforeEach */
var chai = require('chai'), sinon = require('sinon'), _ = require('lodash'),
    addRegistrationHandlers =
        require('../../../src/commands/handlers/registration'),
    Cap = require('../../../src/commands/cap'), expect = chai.expect;

chai.use(require('chai-subset'));

describe('src/commands/handlers.js', function() {
  var handlers, context;

  beforeEach(function() {
    handlers = {};
    context = {
      wanted_caps : [],
      request_extra_caps : [],
      network : {cap : {negotiating : true, enabled : []}},
      connection : {write : sinon.spy()}
    };

    var command_controller = {
      addHandler : function(command, handler) { handlers[command] = handler; }
    };

    addRegistrationHandlers(command_controller);
  });

  describe('CAP', function() {
    describe('LS', function() {
      it('should send "CAP END" if we are negotiating and want no caps',
         function() {
           handlers.CAP.call(context, {
             command : 'CAP',
             params : [ '*', 'LS', 'multi-prefix sasl batch' ]
           });

           expect(context.connection.write).to.have.been.calledWith('CAP END');
         });

      it('should not send "CAP END" if we are not negotiating and want no caps',
         function() {
           context.network.cap.negotiating = false;
           handlers.CAP.call(context, {
             command : 'CAP',
             params : [ '*', 'LS', 'multi-prefix sasl batch' ]
           });

           expect(context.connection.write)
               .not.to.have.been.calledWith('CAP END');
         });

      it('should request the caps that we want and are available if we are negotiating',
         function() {
           context.wanted_caps.push(new Cap.Wanted('multi-prefix'));
           context.wanted_caps.push(new Cap.Wanted('sasl'));

           handlers.CAP.call(context, {
             command : 'CAP',
             params : [ '*', 'LS', 'multi-prefix sasl batch' ]
           });

           expect(context.connection.write)
               .to.have.been.calledWith('CAP REQ :multi-prefix sasl');
         });

      it('should request a cap if it has a value but we dont care about it',
         function() {
           context.wanted_caps.push(new Cap.Wanted('test'));

           handlers.CAP.call(context, {
             command : 'CAP',
             params : [ '*', 'LS', 'test=testy-mc-testface' ]
           });

           expect(context.connection.write)
               .to.have.been.calledWith('CAP REQ :test');

           handlers.CAP.call(
               context, {command : 'CAP', params : [ '*', 'LS', 'test=foo' ]});

           expect(context.connection.write)
               .to.have.been.calledWith('CAP REQ :test');
         });

      it('should request a cap if its value matches what we expect',
         function() {
           context.wanted_caps.push(
               new Cap.Wanted('test', [ 'testy-mc-testface' ]));
           context.wanted_caps.push(new Cap.Wanted('test2', [ 'foo', 'bar' ]));

           handlers.CAP.call(context, {
             command : 'CAP',
             params : [ '*', 'LS', 'test=testy-mc-testface' ]
           });

           expect(context.connection.write)
               .to.have.been.calledWith('CAP REQ :test');

           handlers.CAP.call(
               context, {command : 'CAP', params : [ '*', 'LS', 'test=foo' ]});

           expect(context.connection.write)
               .to.have.been.calledWith('CAP REQ :test');
         });

      it('should request a cap if its value matches what we expect when given a comparator',
         function() {
           context.wanted_caps.push(new Cap.Wanted(
               'sasl', [ 'PLAIN', 'EXTERNAL' ],
               function(cap_value, wanted_value) {
                 return !!_.find(cap_value.split(','), wanted_value);
               }));

           handlers.CAP.call(
               context,
               {command : 'CAP', params : [ '*', 'LS', 'sasl=PLAIN' ]});

           expect(context.connection.write)
               .to.have.been.calledWith('CAP REQ :sasl');
         });

      it('should not request a cap if its value does not matches what we expect when given a comparator',
         function() {
           context.wanted_caps.push(new Cap.Wanted(
               'sasl', [ 'PLAIN', 'EXTERNAL' ],
               function(cap_value, wanted_value) {
                 return !!_.find(cap_value.split(','), wanted_value);
               }));

           handlers.CAP.call(context, {
             command : 'CAP',
             params : [ '*', 'LS', 'sasl=SCRAM-SHA-256,DH-BLOWFISH' ]
           });

           expect(context.connection.write)
               .not.to.have.been.calledWith('CAP REQ :sasl');
         });
    });
  });
});
