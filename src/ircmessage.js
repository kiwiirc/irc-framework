const MessageTags = require('./messagetags');

module.exports = class IrcMessage {
    constructor(command, ...args) {
        this.tags = Object.create(null);
        this.prefix = '';
        this.nick = '';
        this.ident = '';
        this.hostname = '';
        this.command = command || '';
        this.params = args || [];
    }

    to1459() {
        const parts = [];

        const tags = MessageTags.encode(this.tags);
        if (tags) {
            parts.push('@' + tags);
        }

        if (this.prefix) {
            // TODO: If prefix is empty, build it from the nick!ident@hostname
            parts.push(':' + this.prefix);
        }

        parts.push(this.command);

        if (this.params.length > 0) {
            this.params.forEach((param, idx) => {
                if (idx === this.params.length - 1 && (param.indexOf(' ') > -1 || param[0] === ':')) {
                    parts.push(':' + param);
                } else {
                    parts.push(param);
                }
            });
        }

        return parts.join(' ');
    }

    toJson() {
        return {
            tags: Object.assign({}, this.tags),
            source: this.prefix,
            command: this.command,
            params: this.params,
        };
    }
};
