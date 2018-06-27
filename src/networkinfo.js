'use strict';

module.exports = NetworkInfo;

function NetworkInfo() {
    // Name of the network
    this.name = 'Network';

    // Name of the connected server
    this.server = '';

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
