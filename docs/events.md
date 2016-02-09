### Events available on an IRC client

Raw IRC events are parsed and turned into javascript friendly event objects. IRC events that are not parsed are triggered using their IRC command name.

#### Registration
**registered**
~~~javascript
{
    nick: nick
}
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


**notice**
~~~javascript
{
    from_server: command.prefix === this.network.server ? true : false,
    nick: command.nick || undefined,
    ident: command.ident,
    hostname: command.hostname,
    target: target,
    group: target_group,
    msg: msg,
    time: time
}
~~~


**action**
~~~javascript
{
    nick: command.nick,
    ident: command.ident,
    hostname: command.hostname,
    target: command.params[0],
    msg: msg.substring(8, msg.length - 1),
    time: time
}
~~~


**privmsg**
~~~javascript
{
    nick: command.nick,
    ident: command.ident,
    hostname: command.hostname,
    target: command.params[0],
    msg: msg,
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
