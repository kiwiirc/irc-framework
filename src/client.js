var EventEmitter = require('events').EventEmitter,
    utils = require('utils'),
    _ = require('lodash'),
    Commands = require('./commands'),
    Connection = require('./connection'),
    Server = require('./server'),
    User = require('./user');

function Client() {
    EventEmitter.call(this);
    this.command_handler = new Commands.Handler();
}

utils.inherits(Client, EventEmitter);

module.exports = Client;

Client.prototype.connect = function(opts) {
    var client = this;

    if (this.connection && this.connection.connected) {
        this.connection.end();
    }

    this.connection = new Connection(opts);
    
    this.connection.on('connected', function () {
        if (client.command_handler) {
            client.command_handler.removeAllListeners();
        }
        client.command_handler = new Commands.Handler();
        client.server = new Server();
        client.user = new User();

        client.addCommandHandlerListeners();

        this.emit('connected');
    });

    this.connection.on('readable', function () {
        var message,
            keep_reading = true;

        while(keep_reading) {
            keep_reading = ((message = this.read()) !== null);

            if (keep_reading) {
                client.command_handler.dispatch(new Commands.Command(message.command.toUpperCase(), message));
            }
        }
    });
};

Object.defineProperty(Client.prototype, 'conneted', {
    enumerable: true,
    get: function () {
        return this.connection && this.connection.connected;
    }
});

Client.prototype.addCommandHandlerListeners = function() {
    this.command_handler.on('server options', function (event) {
        _.each(event.options, function (opt) {
            this.server.ISUPPORT.add(opt[0], opt[1]);
        });
    });
};
