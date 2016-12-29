/**
 * The default irc-framework interface for browsers
 * Usage: var IrcFramework = require('irc-framework/browser');
 */

module.exports.Client = require('./src/client');
module.exports.Client.setDefaultTransport(require('./src/transports/websocket'));

module.exports.ircLineParser = require('./src/irclineparser');
