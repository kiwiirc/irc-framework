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
