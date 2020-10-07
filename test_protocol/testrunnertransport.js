const EventEmitter = require('eventemitter3');

class Transport extends EventEmitter {
    constructor(r) {
        super();

        this.connected = false;
        this.r = r;
        this.r.onSendLine = line => {
            // server -> client data
            this.emit('line', line + '\n');
        };
    }

    isConnected() {
        return true;
    }

    writeLine(line, cb) {
        this.r.addLineFromClient(line);
        cb && setTimeout(cb);
    }

    connect() {
        setTimeout(() => {
            this.connected = true;
            this.emit('open');
        });
    }

    disposeSocket() {
        if (this.connected) {
            this.close();
        }
    }

    close() {
        if (this.connected) {
            setTimeout(() => {
                this.connected = false;
                this.emit('close', false);
            });
        }
    }

    setEncoding(encoding) {
    }
};

module.exports = Transport;
