/**
 * The default irc-framework interface for nodejs
 * Usage: var IrcFramework = require('irc-framework');
 */

module.exports.Client = require('./src/client');
module.exports.Client.setDefaultTransport(require('./src/transports/net'));

module.exports.ircLineParser = require('./src/irclineparser');
