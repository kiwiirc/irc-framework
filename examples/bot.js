var IRC = require('../');


/**
 * Example middleware structure to handle NickServ authentication
 * Accepts a `nickserv` object from the client connect() options
 */
function NickservMiddleware(command, event, client, next) {
	if (command === '005') {
		if (client.options.nickserv) {
			var options = client.options.nickserv;
			client.say('nickserv', 'identify ' + options.account + ' ' + options.password);
		}
	}

	if (command === 'PRIVMSG' && event.params[0].toLowerCase() === 'nickserv') {
		// Handle success/retries/failures
	}

	next();
}



function MyIrcMiddleware(command, event, client, next) {
	console.log('[MyMiddleware]', command, event);
	if (command === 'PRIVMSG' && event.params[1].indexOf('omg') === 0) {
		event.params[1] += '!!!!!';
	}
	next();
}


var bot = new IRC.Client();
bot.use(MyIrcMiddleware);
bot.connect({
	host: 'irc.snoonet.org',
	nick: 'prawnsbot'
});
bot.on('registered', function() {
	console.log('Connected!');
	bot.join('#prawnsalad');
	//var channel = bot.channel('#prawnsalad');
	//channel.join();
	//channel.say('Hi!');
	//channel.updateUsers(function() {
	//	console.log(channel.users);
	//});
});

bot.on('close', function() {
	console.log('Connection close');
});

bot.on('message', function(event) {
	console.log('<' + event.target + '>', event.msg);
	if (event.msg.indexOf('whois') === 0) {
		bot.whois(event.msg.split(' ')[1]);
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
