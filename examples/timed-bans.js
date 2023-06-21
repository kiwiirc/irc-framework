var IRC = require('../');

var bot = new IRC.Client();
bot.use(TimedBanMiddleware());
bot.connect({
    host: 'irc.network.org',
    nick: 'unban-bot',
    gecos: 'unban-bot',
    account: 'unban-bot',
    password: '***'
});

// Config
var ignore_extbans = true, // Set true to ignore extended bans
    chanlist = ['#testoz', '#testouille'], // List of channels for the bot
    ban_ttl = 10800; // Ban expiry duration (in seconds)



function TimedBanMiddleware() {
    var channels = [];

    setInterval(getBanlist, 60000);

    return function(client, raw_events, parsed_events) {
        parsed_events.use(theMiddleware);
    }

    function getBanlist() {
        for(channel_index in channels) {
            bot.banlist(channels[channel_index].name);
        }
    }

    function expireBans(event, chan) {
        var time = Math.floor(Date.now() / 1000);

        if(ignore_extbans) {
            var extban_regex = new RegExp("~?[a-zA-Z]{1}:");
        }

        for(ban_index in event.bans) {
            var ban_mask = event.bans[ban_index].banned,
                ban_time = event.bans[ban_index].banned_at;

            // Check if ban has expired
            if((time - ban_time) > ban_ttl) {
                //console.log('EXPIRED:', chan.name, ban_mask);
                // Only unban if the ban is not an exception type
                if(ignore_extbans === false || (ignore_extbans && !extban_regex.test(ban_mask))) {
                    chan.unban(ban_mask);
                }
            } else {
                // Ban is still valid, do nothing
                //console.log('NOT EXPIRED:', ban_mask);
            }
        }
    }


    function theMiddleware(command, event, client, next) {
        if (command === 'registered') {
            for(channel_index in chanlist) {
                chan = bot.channel(chanlist[channel_index]);
                chan.join();
                channels[chan.name] = chan;
                // Collect banlist on join
                bot.banlist(channels[chanlist[channel_index]].name);
            }
        }

        if (command === 'banlist') {
            expireBans(event, channels[event.channel]);
        }

        next();
    }
}
