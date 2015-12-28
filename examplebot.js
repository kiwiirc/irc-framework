var IRC = require('./');

var bot = new IRC.Bot('5.39.86.47', 6667, false, 'prawnsbot', 'prawnsbot', {});
bot.connect();
bot.on('registered', function() {
	console.log('Connected!');
	//bot.join('#prawnsalad');
	var channel = bot.channel('#prawnsalad');
	channel.join();
	channel.say('Hi!');
	channel.updateUsers(function() {
		console.log(channel.users);
	});
});

bot.on('close', function() {
	console.log('Connection close');
});

bot.on('privmsg', function(event) {
	if (event.msg.indexOf('whois') === 0) {
		bot.whois(event.msg.split(' ')[1]);
	} else {
		event.reply('no');
	}
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