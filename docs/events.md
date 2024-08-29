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

Or if you want to use them in your middleware...
~~~javascript
function MyMiddleware() {
    return function(client, raw_events, parsed_events) {
        parsed_events.use(theMiddleware);
    }


    function theMiddleware(command, event, client, next) {
        if (command === 'registered') {
            // ...
        }

        next();
    }
}
~~~


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


**socket close**

The client has disconnected from the network.
~~~javascript
{ }
~~~


**socket connected**

The client has a connected socket to the network. Network registration will automatically start at this point.
~~~javascript
{ }
~~~


**raw socket connected**

The client has a raw connected socket to the network but not yet completed any TLS handshakes yet. This is a good place to read any TCP port information for things like identd.
~~~javascript
{ }
~~~


**server options**
~~~javascript
{
    options: { ... },
    cap: { ... }
}
~~~


#### Raw connection and debugging
**raw**

A valid raw line sent or received from the IRC server.
~~~javascript
{
    line: ':server.ircd.net 265 prawnsalad :Current Local Users: 214  Max: 411',
    from_server: true
}
~~~


**unknown command**

This event gets emitted whenever no handler is registered for an IRC commmand.
The payload is an instance of an IrcCommand.
~~~javascript
IrcCommand {
  command: '250',
  params: [
    'prawnsbot',
    'Highest connection count: 2375 (2374 clients) (27822 connections received)'
  ],
  tags: {},
  prefix: 'copper.libera.chat',
  nick: '',
  ident: '',
  hostname: 'copper.libera.chat'
}
~~~


**debug**

Debugging messages.
~~~javascript
'Socket fully connected'
~~~

#### Channels
**channel info**
~~~javascript
{
    channel: '#channel',
    modes: [ ... ],
    raw_modes: '+o',
    raw_params: 'prawnsalad',
    tags: { ... }
}
~~~


**channel list start**
~~~javascript
{ }
~~~


**channel list**
~~~javascript
[
    {
        channel: '#channel1',
        num_users: 123,
        topic: 'My topic',
        tags: {},
    },
    {
        channel: '#channel2',
        num_users: 456,
        topic: 'My topic',
        tags: {},
    },
    ...
]
~~~


**channel list end**
~~~javascript
{ }
~~~


**channel info**
~~~javascript
{
    channel: '#channel',
    created_at: 000000000,
    tags: { ... }
}
~~~


**channel info**
~~~javascript
{
    channel: '#channel',
    url: 'http://channel-website.com/',
    tags: { ... }
}
~~~


**wholist**
~~~javascript
{
    target: '#channel',
    users: [ ... ],
    tags: { ... }
}
~~~


**userlist**
~~~javascript
{
    channel: '#channel',
    users: [ ... ],
    tags: { ... }
}
~~~


**invitelist**
~~~javascript
{
    channel: '#channel',
    invites: [ ... ],
    tags: { ... }
}
~~~


**banlist**
~~~javascript
{
    channel: '#channel',
    bans: [ ... ],
    tags: { ... }
}
~~~


**exceptlist**
~~~javascript
{
    channel: '#channel',
    excepts: [ ... ],
    tags: { ... }
}
~~~


**topic**
~~~javascript
{
    channel: '#channel',
    // topic will be empty if one is not set
    topic: 'The channel topic',

    // If the topic has just been changed, the following is also available
    nick: 'prawnsalad',
    time: 000000000
}
~~~


**topicsetby**
~~~javascript
{
    nick: 'prawnsalad',
    ident: 'prawnsalad',
    hostname: 'unaffiliated/prawnsalad',
    channel: '#channel',
    when: 000000000
}
~~~


**join**

The account name will only be available on supported networks.
~~~javascript
{
    nick: 'prawnsalad',
    ident: 'prawn',
    hostname: 'manchester.isp.net',
    gecos: 'prawns real name',
    channel: '#channel',
    time: 000000000,
    account: 'account_name'
}
~~~


**part**
~~~javascript
{
    nick: 'prawnsalad',
    ident: 'prawn',
    hostname: 'manchester.isp.net',
    channel: '#channel',
    message: 'My part message',
    time: 000000000
}
~~~


**kick**
~~~javascript
{
    kicked: 'someabuser',
    nick: 'prawnsalad',
    ident: 'prawn',
    hostname: 'manchester.isp.net',
    channel: '#channel',
    message: 'Reason why someabuser was kicked',
    time: 000000000
}
~~~


**quit**
~~~javascript
{
    nick: 'prawnsalad',
    ident: 'prawn',
    hostname: 'manchester.isp.net',
    message: 'Reason why I'm leaving IRC,
    time: 000000000
}
~~~


**invited**
~~~javascript
{
    nick: 'inviteduser',
    channel: '#channel'
}
~~~



#### Messaging
**notice**

Also triggers a **message** event with .type = 'notice'. from_server indicates if this notice was
sent from the server or a user.
~~~javascript
{
    from_server: false,
    nick: 'prawnsalad',
    ident: 'prawn',
    hostname: 'manchester.isp.net',
    target: '#channel',
    group: '@',
    message: 'A message to all channel ops',
    tags: [],
    time: 000000000,
    account: 'account_name'
}
~~~


**action**

Also triggers a **message** event with .type = 'action'
~~~javascript
{
    nick: 'prawnsalad',
    ident: 'prawn',
    hostname: 'manchester.isp.net',
    target: '#channel',
    message: 'slaps someuser around a bit with a large trout',
    tags: [],
    time: 000000000,
    account: 'account_name'
}
~~~


**privmsg**

Also triggers a **message** event with .type = 'privmsg'
~~~javascript
{
    nick: 'prawnsalad',
    ident: 'prawn',
    hostname: 'manchester.isp.net',
    target: '#channel',
    message: 'Hello everybody',
    tags: [],
    time: 000000000,
    account: 'account_name'
}
~~~

**tagmsg**

~~~javascript
{
    nick: 'prawnsalad',
    ident: 'prawn',
    hostname: 'manchester.isp.net',
    target: '#channel',
    tags: {
        example: 'hello'
    },
    time: 000000000,
    account: 'account_name'
}
~~~

**ctcp response**
~~~javascript
{
    nick: 'prawnsalad',
    ident: 'prawn',
    hostname: 'manchester.isp.net',
    target: 'someuser',
    message: 'VERSION kiwiirc',
    time: 000000000,
    account: 'account_name'
}
~~~


**ctcp request**

The `VERSION` CTCP is handled internally and will not trigger this event, unless you set the
`version` option to `null`
~~~javascript
{
    nick: 'prawnsalad',
    ident: 'prawn',
    hostname: 'manchester.isp.net',
    target: 'someuser',
    type: 'VERSION',
    message: 'VERSION and remaining text',
    time: 000000000,
    account: 'account_name'
}
~~~


**wallops**
~~~javascript
{
    from_server: false,
    nick: 'prawnsalad',
    ident: 'prawn',
    hostname: 'manchester.isp.net',
    message: 'This is a server-wide message',
    account: 'account_name'
}
~~~


#### Users
**nick**
~~~javascript
{
    nick: 'prawnsalad',
    ident: 'prawn',
    hostname: 'isp.manchester.net',
    new_nick: 'prawns_new_nick',
    time: 000000000
}
~~~


**account**

`account` will be `false` if the user has logged out.
~~~javascript
{
    nick: 'prawnsalad',
    ident: 'prawn',
    hostname: 'isp.manchester.net',
    account: 'prawns_account_name',
    time: 000000000
}
~~~


**user info**

May be sent upon connecting to a server or when a `MODE <nick>` was executed.
Corresponds to 'RPL_UMODEIS'.
~~~javascript
  {
      nick: 'prawnsalad',
      raw_modes: '+Ri',
      tags: {}
  }
~~~



**away**

`self` will be `true` if this is a response to your `away` command.
~~~javascript
{
    self: false,
    nick: 'prawnsalad',
    message: 'Time to go eat some food.',
    time: 000000000
}
~~~


**back**

`self` will be `true` if this is a response to your `away` command.
~~~javascript
{
    self: false,
    nick: 'prawnsalad',
    message: 'You are now back',
    time: 000000000
}
~~~


**monitorlist**
~~~javascript
{
    nicks: ['nick1', 'nick2', 'nick3']
}
~~~


**nick in use**
~~~javascript
{
    nick: 'attempted_nick',
    reason: 'That nickname is already in use'
}
~~~


**nick invalid**
~~~javascript
{
    nick: 'attempted@nick',
    reason: 'That is an invalid nick'
}
~~~


**users online**
~~~javascript
{
    nicks: ['nick1', 'nick2', 'nick3'],
}
~~~


**users offline**
~~~javascript
{
    nicks: ['nick1', 'nick2', 'nick3'],
}
~~~



**whois**

Not all of these options will be available. Some will be missing depending on the network.
~~~javascript
{
    away: 'away message',
    nick: 'prawnsalad',
    ident: 'prawn',
    hostname: 'manchester.isp.net',
    actual_ip: 'sometimes set when using webirc, could be the same as actual_hostname',
    actual_hostname: 'sometimes set when using webirc',
    real_name: 'A real prawn',
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

The response root includes the latest data from `whowas[0]` to maintain backwards compatibility.
The `whowas` array contains all RPL_WHOWASUSER responses with the newest being first.

If the requested user was not found, `error` will contain 'no_such_nick'.

> Note: The available data can vary depending on the network.

~~~javascript
{
    nick: 'prawnsalad',
    ident: 'prawn',
    hostname: 'manchester.isp.net',
    actual_ip: 'sometimes set when using webirc, could be the same as actual_hostname',
    actual_hostname: 'sometimes set when using webirc',
    actual_username: 'prawn',
    real_name: 'A real prawn',
    server: 'irc.server.net',
    server_info: 'Thu Jun 14 09:15:51 2018',
    account: 'logged on account',
    error: ''
    whowas: [
        { ... },
        { ... },
    ]
}
~~~


**user updated**

Only on supporting IRC servers with CHGHOST capabilities and 'enable_chghost' set in the connection options.
~~~javascript
{
    nick: 'prawnsalad',
    ident: 'prawns_old_ident',
    hostname: 'prawns.old.hostname',
    new_ident: 'prawns_new_ident',
    new_hostname: 'prawns_new_host',
    time: time
}
~~~



#### Misc
**motd**
~~~javascript
{
    motd: 'combined motd text which will contain newlines',
    tags: {},
}
~~~

**info**
~~~javascript
{
    info: 'combined info text which will contain newlines (RPL_INFO)',
    tags: {},
}
~~~

**help**
~~~javascript
{
    help: 'combined help text which will contain newlines (RPL_HELPTXT)',
    tags: {},
}
~~~

**batch start**

On capable networks a set of commands may be batched together. The commands will be
executed automatically directly after this event as a transaction, each with a tag
`batch` matching this `event.id` value.

A `batch start <type>` event is also triggered.
~~~javascript
{
    id: 1,
    type: 'chathistory',
    params: [],
    commands: []
}
~~~

**batch end**

After a `batch start` event has been triggered along with all its commands, this event
will be triggered directly after.

A `batch end <type>` event is also triggered.
~~~javascript
{
    id: 1,
    type: 'chathistory',
    params: [],
    commands: []
}
~~~


**cap ls**, **cap ack**, **cap nak**, **cap list**, **cap new**, **cap del**

Triggered for each `CAP` command, lists the sent capabilities list.

~~~javascript
{
    command: 'LS',
    capabilities: {
        'sts': 'port=6697'
    }
}
~~~

### SASL

**loggedin** / **loggedout**

Trigged when the user logs in or out, can be triggered by either SASL or NickServ auth

~~~javascript
{
    nick: 'prawnsalad'
    ident: 'prawnsalad',
    hostname: 'manchester.isp.net',
    account: 'prawnsalad',
    time: 000000000,
    tags: { ... }
};
~~~


**sasl failed**

Triggered when an SASL auth fails

"reason" can be one of the following:
* `fail` - ERR_SASLFAIL (904)
* `too_long` - ERR_SASLTOOLONG (905)
* `nick_locked` - ERR_NICKLOCKED (902)
* `unsupported_mechanism` - A mechanism was requested that the server does not support
* `capability_missing` - An account was provided with the connection, but the server does not offer the SASL capability

~~~javascript
{
    reason: 'fail',

    // The following properties are only included when the event was triggered from an IRC event
    message: 'SASL authentication failed',
    nick: 'prawnsalad',
    time: 000000000,
    tags: { ... },
}
~~~
