### IRCv3 Support

#### IRCv3.1 support

- CAP
- sasl
- multi-prefix
- account-notify
- away-notify
- extended-join

#### IRCv3.2 support

- CAP
- account-tag
- batch
- chghost
- echo-message
- invite-notify
- sasl
- server-time
- userhost-in-names
- message-tags
- labeled-response

#### Drafts

- draft/multiline

#### Extra notes

- chghost

  Only enabled if the client `enable_chghost` option is `true`. Clients may need to specifically handle this to update their state if the username or hostname suddenly changes.

- echo-message

  Only enabled if the client `enable_echomessage` option is `true`. Clients may not be expecting their own messages being echoed back by default so it must be enabled manually.

- labeled-response

  Automatically enabled when `enable_echomessage` is `true` (requires batch, which is always requested). Pass `{ label: true }` as options to `say()`, `notice()`, or `action()` to attach a label. The server's response will trigger a `labeled response` event on the client with the matching label. See [events.md](events.md) for the event format.

- draft/multiline

  Only enabled if the client `enable_multiline` option is `true` and the
  network advertises the capability. Inbound batches are concatenated and emitted
  as a single `privmsg` / `notice` event with `multiline: true` set, using the
  prefix and tags from the `BATCH` start command. The parsed `max-bytes` /
  `max-lines` limits are reachable via `client.network.multilineLimits()`.
