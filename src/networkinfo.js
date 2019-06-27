'use strict';

var _ = {
    find: require('lodash/find'),
};

module.exports = NetworkInfo;

function NetworkInfo() {
    // Name of the network
    this.name = 'Network';

    // Name of the connected server
    this.server = '';

    // The reported IRCd type
    this.ircd = '';

    // Network provided options
    this.options = {
        PREFIX: [
            {symbol: '~', mode: 'q'},
            {symbol: '&', mode: 'a'},
            {symbol: '@', mode: 'o'},
            {symbol: '%', mode: 'h'},
            {symbol: '+', mode: 'v'}
        ]
    };

    this.supports = function supports(support_name) {
        return this.options[support_name.toUpperCase()];
    };

    this.isChannelName = function isChannelName(channel_name) {
        if (typeof channel_name !== 'string' || channel_name === '') {
            return false;
        }
        const chanPrefixes = this.supports('CHANTYPES') || '&#';
        return chanPrefixes.indexOf(channel_name[0]) > -1;
    };

    // Support '@#channel' and '++channel' formats
    this.extractTargetGroup = function extractTargetGroup(target) {
        var statusMsg = this.supports('STATUSMSG');

        if (!statusMsg) {
            return null;
        }

        var target_group = _.find(statusMsg, function(prefix) {
            if (prefix === target[0]) {
                target = target.substring(1);

                return prefix;
            }
        });

        if (!target_group) {
            return null;
        }

        return {
            target: target,
            target_group: target_group,
        };
    }

    // Network capabilities
    this.cap = {
        negotiating: false,
        requested: [],
        enabled: [],
        isEnabled: function(cap_name) {
            return this.enabled.indexOf(cap_name) > -1;
        }
    };
}
