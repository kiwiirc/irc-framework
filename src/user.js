function User(opts) {
    opts = opts || {};

    this.nick = opts.nick || '';
    this.username = opts.username || '';
    this.gecos = opts.gecos || '';
    this.host = opts.host || '';
    this.away = !!opts.away;

    this.modes = new Set(opts.modes || []);
}

module.exports = User;

User.prototype.toggleModes = function(modestr) {
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
            this.modes[adding ? 'set' : 'delete'](modestr[i]);
        }
    }
};
