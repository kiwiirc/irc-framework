const IRC = require('../');

/**
 * Example middleware structure to handle NickServ authentication
 * Accepts a `nickserv` object from the client connect() options
 */
function NickservMiddleware() { // eslint-disable-line
    return function(client, raw_events, parsed_events) {
        raw_events.use(theMiddleware);
    };

    function theMiddleware(command, event, client, next) {
        if (command === '005') {
            if (client.options.nickserv) {
                const options = client.options.nickserv;
                client.say('nickserv', 'identify ' + options.account + ' ' + options.password);
            }
        }

        if (command === 'PRIVMSG' && client.caseCompare(event.params[0], 'nickserv')) {
            // Handle success/retries/failures
        }

        next();
    }
}

function MyIrcMiddleware() {
    return function(client, raw_events, parsed_events) {
        parsed_events.use(theMiddleware);
        client.requestCap('kiwiirc.com/user');
    };

    function theMiddleware(command, event, client, next) {
        // console.log('[MyMiddleware]', command, event);
        if (command === 'message' && event.message.indexOf('omg') === 0) {
            event.message += '!!!!!';
            event.reply('> appended extra points');
        }

        next();
    }
}

const bot = new IRC.Client();
bot.use(MyIrcMiddleware());
bot.connect({
    host: 'irc.snoonet.org',
    nick: 'prawnsbot'
});
bot.on('registered', function() {
    console.log('Connected!');
    bot.join('#prawnsalad');
    // var channel = bot.channel('#prawnsalad');
    // channel.join();
    // channel.say('Hi!');
    // channel.updateUsers(function() {
    //   console.log(channel.users);
    // });
});

bot.on('close', function() {
    console.log('Connection close');
});

bot.on('message', function(event) {
    console.log('<' + event.target + '>', event.message);
    if (event.message.indexOf('whois') === 0) {
        bot.whois(event.message.split(' ')[1]);
    }
});

bot.matchMessage(/^!hi/, function(event) {
    event.reply('sup');
});

bot.on('whois', function(event) {
    console.log(event);
});

bot.on('join', function(event) {
    console.log('user joined', event);
});

bot.on('userlist', function(event) {
    console.log('userlist for', event.channel, event.users);
});

bot.on('part', function(event) {
    console.log('user part', event);
});
