### irc-framework Client instance API

Inherits [EventEmitter](https://nodejs.org/api/events.html). Read more on the Events available [here](https://github.com/kiwiirc/irc-framework/blob/master/docs/events.md).

#### Constructor
~~~javascript
new Irc.Client({
    nick: 'ircbot',
    username: 'ircbot',
    gecos: 'ircbot',
    encoding: 'utf8',
    version: 'node.js irc-framework',
    enable_chghost: false,
    enable_echomessage: false,
    auto_reconnect: true,
    auto_reconnect_max_wait: 300000,
    auto_reconnect_max_retries: 3,
    ping_interval: 30,
    ping_timeout: 120,
    sasl_disconnect_on_fail: false,
    account: {
        account: 'username',
        password: 'account_password',
    },
    webirc: {
        password: '',
        username: '*',
        hostname: 'users.host.isp.net',
        ip: '1.1.1.1',
        options: {
            secure: true,
            'local-port': 6697,
            'remote-port': 21726,
        },
    },
    client_certificate: {
        private_key: '-----BEGIN RSA PRIVATE KEY-----[...]',
        certificate: '-----BEGIN CERTIFICATE-----[...]',
    },
});
~~~

#### Configuration
##### `account`
To accommodate backwards compatibility support, the `account` configuration can behave in different ways depending what data types its provided.

When the `account` property is falsy, `options.nick` and `options.password` will be used for SASL Auth.

If the `account` property is an object, `account.account` and `account.password` will be used for SASL Auth.

To Completely disable SASL Auth, set `account` to an empty object, eg: `account: {}`.


#### Properties
##### `.connected`
If connected to the IRC network and successfully registered

##### `.user`
Once connected to an IRC network, this object will have these properties:
* `.nick` The current nick you are currently using
* `.username` Your username (ident) that the network sees you as using
* `.gecos` Your current gecos (realname)
* `.host` On supported servers, the hostname that the networksees you as using
* `.away` Your current away status. Empty for not away
* `.modes` A Set() instance with your current user modes


#### Methods
##### `.requestCap('twitch.tv/membership')`
Request an extra IRCv3 capability

##### `.use(middleware_fn())`
Add middleware to handle the events for the client instance

##### `.connect([connect_options])`
Start connecting to the IRC network. If `connect_options` is provided it will
override any options given to the constructor.

##### `.raw(raw_data_line)`
Send a raw line to the IRC server

##### `.rawString('JOIN', '#channel')`
##### `.rawString(['JOIN', '#channel'])`
Generate a formatted line from either an array or arguments to be sent to the
IRC server.

##### `.quit([quit_message])`
Quit from the IRC network with the given message

##### `.ping([message])`
Ping the IRC server to show you're still alive.

##### `.changeNick(nick)`
Attempt to change the clients nick on the network

##### `.say(target, message [, tags])`
Send a message to the target, optionally with tags.

##### `.notice(target, message [, tags])`
Send a notice to the target, optionally with tags.

##### `.tagmsg(target, tags)`
Send a tagged message without content to the target

##### `.join(channel [, key])`
Join a channel, optionally with a key/password.

##### `.part(channel [, message])`
Part/leave a channel with an optional parting message.

##### `.setTopic(channel, newTopic)`
Set the topic of a channel, if newTopic is falsy or only whitespace then `.clearTopic()` will be called.

##### `.clearTopic(channel)`
Remove the topic of a channel.

##### `.ctcpRequest(target, type [, paramN])`
Send a CTCP request to target with any number of parameters.

##### `.ctcpResponse(target, type [, paramN])`
Send a CTCP response to target with any number of parameters.

##### `.action(target, message)`
Send an action message (typically /me) to a target.

##### `.whois(nick [, cb])`
Receive information about a user on the network if they exist. Optionally calls
`cb(event)` with the result if provided.

##### `.who(target [, cb])`
Receive a list of users on the network that matches the target. The target may be
a channel or wildcard nick. Optionally calls `cb(event)` with the result if
provided. Multiple calls to this function are queued up and run one at a time in
order.

##### `.list([, paramN])`
Request that the IRC server sends a list of available channels. Extra parameters
will be sent.

##### `.channel(channel_name, [key])`
Create a channel object with the following methods:
* `say(message)`
* `notice(message)`
* `action(message)`
* `part([part_message])`
* `join([key])`

##### `.caseCompare(string1, string2)`
Compare two strings using the networks casemapping setting.

##### `.caseUpper(string)`
Uppercase the characters in string using the networks casemapping setting.

##### `.caseLower(string)`
Lowercase the characters in string using the networks casemapping setting.

##### `.match(match_regex, cb[, message_type])`
Call `cb()` when any incoming message matches `match_regex`.

##### `.matchNotice(match_regex, cb)`
Call `cb()` when an incoming notice message matches `match_regex`.

##### `.matchMessage(match_regex, cb)`
Call `cb()` when an incoming plain message matches `match_regex`.

##### `.matchAction(match_regex, cb)`
Call `cb()` when an incoming action message matches `match_regex`.

##### `.addMonitor(target)`
Add `target` to the list of targets being monitored. `target` can be a comma-separated list of nicks.

##### `.removeMonitor(target)`
Remove `target` from the list of targets being monitored. `target` can be a comma-separated list of nicks.

##### `.clearMonitor()`
Clear the list of targets being monitored.

##### `.monitorlist([cb])`
Return the current list of targets being monitored. Optionally calls `cb()` with the result.

##### `.queryMonitor()`
Query the current list of targets being monitored. Will emit `users online` with targets that are online,
and `users offline` with targets that are offline.
