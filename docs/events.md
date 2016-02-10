### Events available on an IRC client

Raw IRC events are parsed and turned into javascript friendly event objects. IRC events that are not parsed are triggered using their IRC command name.

You can bind to an event via the `.on` method.
~~~javascript
var client = new IRC.Client();
client.connect({
    host: 'irc.freenode.net',
    port: 6667,
    nick: 'prawnsbot'
});

client.on('registered', function(event) {
    // ...
});
~~~

*Note: These also apply when using the parsed events within middleware.*


#### Registration
**registered** / **connected**

Once the client has connected and successfully registered on the IRC network. This is a good place to start joining channels.
~~~javascript
{
    nick: nick
}
~~~


**reconnecting**

The client has disconnected from the network and will now automatically re-connect (if enabled).
~~~javascript
{ }
~~~


**close**

The client has disconnected from the network and failed to auto reconnect (if enabled).
~~~javascript
{ }
~~~


**socket connected**

The client has a connected socket to the network. Network registration will automatically start at this point.
~~~javascript
{ }
~~~


**socket close**

The client has disconnected from the network.
~~~javascript
{ }
~~~


**server options**
~~~javascript
{
    options: this.network.options,
    cap: this.network.cap.enabled
}
~~~


#### Channels
**channel info**
~~~javascript
{
    channel: channel,
    modes: modes
}
~~~


**channel info**
~~~javascript
{
    channel: channel,
    created_at: parseInt(command.params[2], 10)
}
~~~


**channel info**
~~~javascript
{
    channel: channel,
    url: command.params[command.params.length - 1]
}
~~~


**userlist**
~~~javascript
{
    channel: command.params[1],
    users: cache.members
}
~~~


**banlist**
~~~javascript
{
    channel: command.params[1],
    bans: cache.bans
}
~~~


**topic**
~~~javascript
{
    channel: command.params[1],
    // topic will be empty if one is not set
    topic: command.params[command.params.length - 1],

    // If the topic has just been changed, the following is also available
    nick: 'nick of the person changing the topic',
    time: time
}
~~~


**topicsetby**
~~~javascript
{
    nick: command.params[2],
    channel: command.params[1],
    when: command.params[3]
}
~~~


**join**
~~~javascript
{
    nick: command.nick,
    ident: command.ident,
    hostname: command.hostname,
    gecos: command.params[command.params - 1],
    channel: channel,
    time: time,
    account: extended-join cap enabled + user is logged in this account
}
~~~


**part**
~~~javascript
{
    nick: command.nick,
    ident: command.ident,
    hostname: command.hostname,
    channel: channel,
    message: message,
    time: time
}
~~~


**kick**
~~~javascript
{
    kicked: command.params[1],
    nick: command.nick,
    ident: command.ident,
    hostname: command.hostname,
    channel: command.params[0],
    message: command.params[command.params.length - 1],
    time: time
}
~~~


**quit**
~~~javascript
{
    nick: command.nick,
    ident: command.ident,
    hostname: command.hostname,
    message: command.params[command.params.length - 1],
    time: time
}
~~~


**invited**
~~~javascript
{
    nick: command.params[0],
    channel: command.params[1]
}
~~~



#### Messaging
**notice**

Also triggers a **message** event with .type = 'notice'
~~~javascript
{
    from_server: command.prefix === this.network.server ? true : false,
    nick: command.nick || undefined,
    ident: command.ident,
    hostname: command.hostname,
    target: target,
    group: target_group,
    msg: msg,
    tags: command.tags,
    time: time
}
~~~


**action**

Also triggers a **message** event with .type = 'action'
~~~javascript
{
    nick: command.nick,
    ident: command.ident,
    hostname: command.hostname,
    target: command.params[0],
    msg: msg.substring(8, msg.length - 1),
    tags: command.tags,
    time: time
}
~~~


**privmsg**

Also triggers a **message** event with .type = 'privmsg'
~~~javascript
{
    nick: command.nick,
    ident: command.ident,
    hostname: command.hostname,
    target: command.params[0],
    msg: msg,
    tags: command.tags,
    time: time
}
~~~


**ctcp response**
~~~javascript
{
    nick: command.nick,
    ident: command.ident,
    hostname: command.hostname,
    target: target,
    msg: msg.substring(1, msg.length - 1),
    time: time
}
~~~


**ctcp request**
~~~javascript
{
    nick: command.nick,
    ident: command.ident,
    hostname: command.hostname,
    target: command.params[0],
    type: (msg.substring(1, msg.length - 1).split(' ') || [null])[0],
    msg: msg.substring(1, msg.length - 1),
    time: time
}
~~~


**wallops**
~~~javascript
{
    from_server: false,
    nick: command.nick,
    ident: command.ident,
    hostname: command.hostname,
    msg: command.params[command.params.length - 1]
}
~~~


#### Users
**nick**
~~~javascript
{
    nick: command.nick,
    ident: command.ident,
    hostname: command.hostname,
    newnick: command.params[0],
    time: time
}
~~~


**away**
~~~javascript
{
    nick: command.nick,
    msg: command.params[command.params.length - 1],
    time: time
}
~~~



**nick in use**
~~~javascript
{
    nick: command.params[1],
    reason: command.params[command.params.length - 1]
}
~~~


**nick invalid**
~~~javascript
{
    nick: command.params[1],
    reason: command.params[command.params.length - 1]
}
~~~



**whois**

Not all of these options will be available. Some will be missing depending on the network.
~~~javascript
{
	away: 'away message',
	nick: '',
	user: '',
	host: '',
	actuallhost: 'sometimes set when using webirc',
	helpop: 'is available for help',
	bot: 'is a bot',
	server: 'irc.server.net',
	server_info: '',
	operator: 'is an operator',
	channels: 'is on these channels',
	modes: '',
	idle: 'idle for 34 secs',
	logon: 'logged on at X',
	registered_nick: 'prawnsalad',
	account: 'logged on account',
	secure: 'is using SSL/TLS',
	special: ''
}
~~~


**whowas**
~~~javascript
{
    nick: command.params[1],
    error: 'no_such_nick'
}
~~~
