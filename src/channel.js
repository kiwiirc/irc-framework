var _ = require('lodash');
var DuplexStream = require('stream').Duplex;

module.exports = IrcChannel;


function IrcChannel(irc_client, channel_name, key) {
    var that = this;

    this.irc_client = irc_client;
    this.name = channel_name;

    // TODO: Proxy channel related events from irc_bot to this instance

    this.say = _.partial(irc_client.say.bind(irc_client), channel_name);
    this.notice = _.partial(irc_client.notice.bind(irc_client), channel_name);
    // this.action = _.partial(irc_client.action.bind(irc_client), channel_name);
    this.part = _.partial(irc_client.part.bind(irc_client), channel_name);
    this.join = _.partial(irc_client.join.bind(irc_client), channel_name);
    this.mode = _.partial(irc_client.mode.bind(irc_client), channel_name);
    this.banlist = _.partial(irc_client.banlist.bind(irc_client), channel_name);
    this.ban = _.partial(irc_client.ban.bind(irc_client), channel_name);
    this.unban = _.partial(irc_client.unban.bind(irc_client), channel_name);


    this.users = [];
    irc_client.on('userlist', function(event) {
        if (event.channel === that.name) {
            this.users = event.users;
        }
    });

    this.join(key);
}

/**
 * Relay messages between this channel to another
 * @param  {IrcChannel|String} target_chan Target channel
 * @param  {Object} opts        Extra options
 *
 * opts may contain the following properties:
 * one_way (false) Only relay messages to target_chan, not the reverse
 * replay_nicks (true) Include the sending nick as part of the relayed message
 */
IrcChannel.prototype.relay = function(target_chan, opts) {
    opts = _.extend({
        one_way: false,
        replay_nicks: true
    }, opts);

    if (typeof target_chan === 'string') {
        target_chan = this.irc_client.channel(target_chan);
    }
    var this_stream = this.stream(opts);
    var other_stream = target_chan.stream(opts);

    this_stream.pipe(other_stream);
    if (!opts.one_way) {
        other_stream.pipe(this_stream);
    }
};

IrcChannel.prototype.stream = function(stream_opts) {
    var that = this;
    var read_queue = [];
    var is_reading = false;

    var stream = new DuplexStream({
        objectMode: true,

        write: function(chunk, encoding, next) {
            // Support piping from one irc buffer to another
            if (typeof chunk === 'object' && typeof chunk.message === 'string') {
                if (stream_opts.replay_nicks) {
                    chunk = '<' + chunk.nick + '> ' + chunk.message;
                } else {
                    chunk = chunk.message;
                }
            }

            that.say(chunk.toString());
            next();
        },

        read: function() {
            var message;

            is_reading = true;

            while (read_queue.length > 0) {
                message = read_queue.shift();
                if (this.push(message) === false) {
                    is_reading = false;
                    break;
                }
            }
        }
    });

    this.irc_client.on('privmsg', function(event) {
        if (event.target.toLowerCase() === that.name.toLowerCase()) {
            read_queue.push(event);

            if (is_reading) {
                stream._read();
            }
        }
    });

    return stream;
};

IrcChannel.prototype.updateUsers = function(cb) {
    var that = this;
    this.irc_client.on('userlist', function updateUserList(event) {
        if (event.channel === that.name) {
            that.irc_client.removeListener('userlist', updateUserList);
            if (typeof cb === 'function') { cb(this); }
        }
    });
    this.irc_client.raw('NAMES', this.name);
};
