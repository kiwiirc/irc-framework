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

    this.time_offsets = [];
    this.time_offset = 0;

    this.timeToLocal = function timeToLocal(serverTimeMs) {
        return serverTimeMs - this.getServerTimeOffset();
    };

    this.timeToServer = function timeToServer(localTimeMs) {
        return localTimeMs + this.getServerTimeOffset();
    };

    this.getServerTimeOffset = function getServerTimeOffset() {
        var sortedOffsets = this.time_offsets.slice(0).sort(function (a, b) {  return a - b;  });
        return sortedOffsets[Math.floor(this.time_offsets.length / 2)] || 0;
    };

    this.addServerTimeOffset = function addServerTimeOffset(time) {
        // add our new offset
        let newOffset = time - Date.now();
        this.time_offsets.push(newOffset);

        // limit out offsets array to 7 enteries
        if (this.time_offsets.length > 7) {
            this.time_offsets = this.time_offsets.slice(this.time_offsets.length - 7);
        }

        let currentOffset = this.getServerTimeOffset();
        if (newOffset - currentOffset > 2000 || newOffset - currentOffset < -2000) {
            // skew was over 2 seconds, invalidate all but last offset
            // > 2sec skew is a little large so just use that. Possible
            // that the time on the IRCd actually changed
            this.time_offsets = this.time_offsets.slice(-1);
        }

        this.time_offset = this.getServerTimeOffset();
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
