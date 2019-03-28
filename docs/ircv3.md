### IRCv3 Support

#### IRCv3.1 support
* CAP
* sasl
* multi-prefix
* account-notify
* away-notify
* extended-join

#### IRCv3.2 support
* CAP
* account-tag
* batch
* chghost
* echo-message
* invite-notify
* sasl
* server-time
* userhost-in-names
* message-tags

#### Extra notes
* chghost

  Only enabled if the client `enable_chghost` option is `true`. Clients may need to specifically handle this to update their state if the username or hostname suddenly changes.

* echo-message

  Only enabled if the client `enable_echomessage` option is `true`. Clients may not be expecting their own messages being echoed back by default so it must be enabled manually.
  Until IRCv3 labelled replies are available, sent message confirmations will not be available. More information on the echo-message limitations can be found here https://github.com/ircv3/ircv3-specifications/pull/284/files
