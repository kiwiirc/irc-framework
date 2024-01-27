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

* <a name="sasl"></a>sasl

  Two SASL authentication mechanisms are natively supported.

  * EXTERNAL

    The EXTERNAL mechanism is used with a pre-arranged out-of-band identification and authentication system. This means that no identity or authentication information is exchanged over the IRC connection during login. In theory this out-of-band system could involve virtually anything; in practice, SASL EXTERNAL authentication on IRC is generally used with client TLS certificates and a list of user hashes.

  * PLAIN

    The PLAIN mechanism is essentially the usual username-and-password authentication, with the exception that two different usernames may be specified (see [authzid and authcid](#authzid-and-authcid) below.) The use of this functionality is uncommon, and the desired username may be specified simply as `account.account` if a user will be logging in and acting under the same account.

  * Other simple mechanisms

    Any mechanism for SASL authentication that doesn't require a challenge-and-response and which follows the general format of PLAIN may be used. This includes e.g. authentication with transient cookies. To make use of this, configure the Client instance API constructor as normal, with `sasl_mechanism` set to the name of the mechanism and `account.secret` set to the secret used by the mechanism. Either `account` or the combination of `authzid` and `authcid` may be set within the `account` object.

  * Challenge-response mechanisms and more

    Arbitrary mechanisms may be supported by providing a helper function in the `options.sasl_function` field. When called, this function will receive the `command` and `handler` objects as parameters, and should return a UTF-8 string. (Do _not_ encode the string to Base64, as the framework will handle that.) Note that the function is responsible for maintianing state between calls if that is required by the desired mechanism.