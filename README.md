# irc-framework
A better IRC framework for node.js. For bots and full clients. (a work in progress)

### Aims
* Lightweight
* Performant
* Very easy to get going out of the box
* Grows as needed for larger applications
* IRCv3 compliant
* Multiple (+ auto detected) encoding support
* Complete test suite

### Status
Currently ripped out of the Kiwi IRC project and running independently.

Todo:
* Remove all references to any Kiwi IRC specific internals.
* Implement an event proxy for `Channel` objects to enable `channel.on('event', ..)`.
* Do something nice with all the commands in commands/misc.js, maybe even delete them and expect the application to handle these via the `raw` event.
* Rename `commands/` to `command_handlers/`
* Implement some form of debugging. Look into the `debug` module?


#### A simple and low-boilerplate framework to build IRC bots.
~~~javascript
var bot = new IRC.Client('irc.freenode.net', 6667, 'prawnsbot');
bot.connect();

bot.on('message', function(event) {
  	if (event.msg.indexOf('hello') === 0) {
  		  event.reply('Hi!');
  	}
  	
  	if (event.msg.match(/^!join /)) {
  	    var to_join = event.msg.split(' ');
  		event.reply('Joining ' + to_join + '..');
  		bot.join(to_join);
  	}
});


// Or a quicker to match messages...
bot.matchMessage(/^hi/, function(event) {
	event.reply('hello there!');
});
~~~

#### A more fleshed out framework for clients
~~~javascript
var bot = new IRC.Client('irc.freenode.net', 6667, 'prawnsbot');
bot.connect();

var buffers = [];
bot.on('registered', function() {
	var channel = bot.channel('#prawnsalad');
	buffers.push(channel);
	
	channel.join();
	channel.say('Hi!');
	
	channel.updateUserList(function() {
		console.log(channel.users);
	});
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