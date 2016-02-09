var util            = require('util');
var DuplexStream    = require('stream').Duplex;

module.exports = MiddlewareStream;

/**
 * Taking a middlware object and its associated client, create a stream to
 * pipe events into the middleware and spit them back out once completed.
 */

function MiddlewareStream(middleware_handler, client) {
    DuplexStream.call(this, { objectMode: true });
    this.middleware = middleware_handler;
    this.client = client;
    this.buffer = [];
    this._reading = false;
}

util.inherits(MiddlewareStream, DuplexStream);



MiddlewareStream.prototype._write = function(chunk, encoding, callback) {
    var that = this;

    this.middleware.handle([chunk.command, chunk, this.client], function(err) {
        if (err) {
            console.error('Middleware error', err);
            return;
        }

        that.buffer.push(chunk);
        if (that._reading) {
            that._read();
        }
    });

    callback();
};

MiddlewareStream.prototype._read = function() {
    var message;

    this._reading = true;

    while (this.buffer.length > 0) {
        message = this.buffer.shift();
        if (!this.push(message)) {
            this._reading = false;
        }
    }
};
