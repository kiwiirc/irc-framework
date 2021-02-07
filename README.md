# irc-framework

[![Codacy Badge](https://api.codacy.com/project/badge/Grade/bcf63150516b4911b2a7f6b0b4db4359)](https://app.codacy.com/gh/turkdevops/irc-framework?utm_source=github.com&utm_medium=referral&utm_content=turkdevops/irc-framework&utm_campaign=Badge_Grade)

A better IRC framework for node.js. For bots and full clients. Read the [documentation](https://github.com/kiwiirc/irc-framework/blob/master/docs/clientapi.md)

![SL Scan](https://github.com/turkdevops/irc-framework/workflows/SL%20Scan/badge.svg?branch=master)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/9e407202556b4e0b8fa544ccdc3b95a8)](https://www.codacy.com/gh/turkdevops/irc-framework/dashboard?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=turkdevops/irc-framework&amp;utm_campaign=Badge_Grade)

### Aims
* Lightweight
* Performant
* Very easy to get going out of the box
* Grows as needed for larger applications
* IRCv3 compliant
* Multiple (+ auto detected) encoding support
* Complete test suite


#### A simple and low-boilerplate framework to build IRC bots.
~~~javascript
var bot = new IRC.Client();
bot.connect({
	host: 'irc.freenode.net',
	port: 6667,
	nick: 'prawnsbot'
});

bot.on('message', function(event) {
  	if (event.message.indexOf('hello') === 0) {
  		  event.reply('Hi!');
  	}
  	
  	if (event.message.match(/^!join /)) {
  	    var to_join = event.message.split(' ');
  		event.reply('Joining ' + to_join + '..');
  		bot.join(to_join);
  	}
});


// Or a quicker to match messages...
bot.matchMessage(/^hi/, function(event) {
	event.reply('hello there!');
});
~~~

#### Channel/buffer objects. Great for building clients
~~~javascript
var bot = new IRC.Client();
bot.connect({
	host: 'irc.freenode.net',
	port: 6667,
	nick: 'prawnsbot'
});

var buffers = [];
bot.on('registered', function() {
	var channel = bot.channel('#prawnsalad');
	buffers.push(channel);
	
	channel.join();
	channel.say('Hi!');
	
	channel.updateUsers(function() {
		console.log(channel.users);
	});

	// Or you could even stream the channel messages elsewhere
	var stream = channel.stream();
	stream.pipe(process.stdout);
});
~~~


#### Middleware
~~~javascript
function ExampleMiddleware() {
	return function(client, raw_events, parsed_events) {
		parsed_events.use(theMiddleware);
	}


	function theMiddleware(command, event, client, next) {
		if (command === 'registered') {
			if (client.options.nickserv) {
				var options = client.options.nickserv;
				client.say('nickserv', 'identify ' + options.account + ' ' + options.password);
			}
		}

		if (command === 'message' && event.event.nick.toLowerCase() === 'nickserv') {
			// Handle success/retries/failures
		}

		next();
	}
}


var irc_bot = new IRC.Client();
irc_bot.use(ExampleMiddleware());
~~~
