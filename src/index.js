'use strict';

/**
 * The default irc-framework interface for nodejs
 * Usage: var IrcFramework = require('irc-framework');
 */

module.exports.Client = require('./client');
module.exports.Client.setDefaultTransport(require('./transports/default'));

module.exports.ircLineParser = require('./irclineparser');
module.exports.Message = require('./ircmessage');
module.exports.MessageTags = require('./messagetags');
module.exports.Helpers = require('./helpers');

module.exports.Channel = require('./channel');
