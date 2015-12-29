var Set = require('es6-set');

function User(opts) {
    this.nick = opts.nick || '';
    this.ident = opts.ident || '';
    this.host = opts.host || '';
    this.away = !!opts.away;

    this.modes = new Set(opts.modes || []);
}

module.exports = User();

User.prototype.toggleModes = function(modestr) {
    var adding = true,
        i;

    for (i in modestr) {
        switch(modestr[i]) {
        case '+':
            adding = true;
            break;
        case '-':
            adding = false;
            break;
        default:
            this.modes[adding?'set':'delete'](modestr[i]);
        }
    }
};