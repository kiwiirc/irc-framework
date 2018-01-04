'use strict';

/**
 * The default irc-framework interface for browsers
 * Usage: var IrcFramework = require('irc-framework/browser');
 */

module.exports.Client = require('./build/client');
module.exports.Client.setDefaultTransport(require('./build/transports/websocket'));

module.exports.ircLineParser = require('./build/irclineparser');
