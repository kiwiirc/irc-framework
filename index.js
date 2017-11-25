/**
 * The default irc-framework interface for nodejs
 * Usage: var IrcFramework = require('irc-framework');
 */

module.exports.Client = require('./build/client');
module.exports.Client.setDefaultTransport(require('./build/transports/net'));

module.exports.ircLineParser = require('./build/irclineparser');
