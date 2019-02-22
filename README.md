# irc-framework
A better IRC framework for node.js. For bots and full clients. Read the [documentation](https://github.com/kiwiirc/irc-framework/blob/master/docs/clientapi.md).

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
