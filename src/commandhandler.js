var isPlainObject = require('is-plain-object');

function Handler(client) {
    this.client = client;
    this.handlers = [];
}

module.exports = Handler;

Handler.prototype.use = function () {
    var that = this,
        obj;

    switch (typeof arguments[0]) {
    case 'function':
        this.handlers.unshift(arguments[0]);
        break;
    case 'string':
        if (typeof arguments[1] === 'function') {
            this.handlers.unshift({command: arguments[0], handler: arguments[1]});
        }
        break;
    case 'object':
        if (isPlainObject(arguments[0])) {
            obj = arguments[0];
            Object.keys(obj).forEach(function (command) {
                if (typeof obj[command] === 'function') {
                    that.handlers.unshift({command: command, handler: obj[command].bind(obj)});
                }
            });
        }
        break;
    }
};

Handler.prototype.dispatch = function(message) {
    var handlers = this.handlers.slice(),
        that = this,
        stored_message = message,
        next;

    next = function (returned_message) {
        var handler;

        if (returned_message) {
            stored_message = returned_message;
        }

        handler = handlers.shift();

        if (handler) {
            if (handler.command && handler.handler) {
                if (handler.command.toUpperCase() !== message.command) {
                    return next(stored_message);
                } else {
                    setImmediate(handler.handler, that.client, stored_message, next);
                }
            } else {
                setImmediate(handler, that.client, stored_message, next);
            }
        }
    };

    next(stored_message);
};
