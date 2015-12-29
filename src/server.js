var Map = require('es6-map');

function Server() {
    this.ISUPPORT = new Map();
    this.capabilities = {
        supported: [],
        requested: [],
        enabled: []
    };
}

module.exports = Server;

Object.defineProperty(Server.prototype, 'prefix', {
    enumerable: true,
    get: function () {
        var mode,
            prefixes = [],
            prefix = this.ISUPPORT.get('PREFIX');

        if (!prefix) {
            return [];
        }

        var tokens = /^\(([^)]+)\)(.+)$/.exec(prefix);
        if (!tokens) {
            return [];
        }

        for (mode in tokens[1]) {
            prefixes.push({
                symbol: tokens[2][mode],
                mode: tokens[1][mode]
            });
        }

        return prefixes;
    }
});

Object.defineProperty(Server.prototype, 'network', {
    enumerable: true,
    get: function () {
        return this.ISUPPORT.get('NETWORK');
    }
});
