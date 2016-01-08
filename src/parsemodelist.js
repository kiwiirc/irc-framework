var _ = require('lodash');

function parseModeList(chanmodes, prefixes, mode_string, mode_params) {
    var always_param = (chanmodes[0] || '').concat((chanmodes[1] || '')),
        modes = [],
        has_param, i, j, add;

    prefixes = _.reduce(prefixes, function (list, prefix) {
        list.push(prefix.mode);
        return list;
    }, []);
    always_param = always_param.split('').concat(prefixes);

    has_param = function (mode, add) {
        if (_.find(always_param, function (m) {
            return m === mode;
        })) {
            return true;
        } else if (add && _.find((chanmodes[2] || '').split(''), function (m) {
            return m === mode;
        })) {
            return true;
        } else {
            return false;
        }
    };

    j = 0;
    for (i = 0; i < mode_string.length; i++) {
        switch (mode_string[i]) {
            case '+':
                add = true;
                break;
            case '-':
                add = false;
                break;
            default:
                if (has_param(mode_string[i], add)) {
                    modes.push({mode: (add ? '+' : '-') + mode_string[i], param: mode_params[j]});
                    j++;
                } else {
                    modes.push({mode: (add ? '+' : '-') + mode_string[i], param: null});
                }
        }
    }

    return modes;
}

module.exports = parseModeList;
