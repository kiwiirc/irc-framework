'use strict';

module.exports = class User {
    constructor(opts) {
        opts = opts || {};

        this.nick = opts.nick || '';
        this.username = opts.username || '';
        this.gecos = opts.gecos || '';
        this.host = opts.host || '';
        this.away = !!opts.away;

        this.modes = new Set(opts.modes || []);
    }

    toggleModes(modestr) {
        var adding = true;
        var i;

        for (i in modestr) {
            switch (modestr[i]) {
            case '+':
                adding = true;
                break;
            case '-':
                adding = false;
                break;
            default:
                this.modes[adding ? 'add' : 'delete'](modestr[i]);
            }
        }
    }
};
