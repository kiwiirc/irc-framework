const EventEmitter = require('eventemitter3');
class Transport extends EventEmitter {
    constructor(r) {
        super();

        this.connected = false;
        this.r = r;
        this.r.onSendLine = line => {
            // server -> client data
            this.emit('line', line + '\n');
        };
    }

    isConnected() {
        return true;
    }

    writeLine(line, cb) {
        this.r.addLineFromClient(line);
        cb && setTimeout(cb);
    }

    connect() {
        setTimeout(() => {
            this.connected = true;
            this.emit('open');
        });
    }

    disposeSocket() {
        if (this.connected) {
            this.close();
        }
    }

    close() {
        if (this.connected) {
            setTimeout(() => {
                this.connected = false;
                this.emit('close', false);
            });
        }
    }

    setEncoding(encoding) {
    }
};

function createTestRunnerTransport(r) {
    return function(...args) {
        return new Transport(r, ...args)
    };
}

function CatchAllMiddleware(r) {
    return function(client, raw_events, parsed_events) {
        parsed_events.use(theMiddleware);
    };

    function theMiddleware(command, event, client, next) {
        r.addEventFromClient(command, event)
        next();
    }
}



const TestRunner = require('./testrunner');
const IRC = require('../src/');


const r = new TestRunner();
r.load(`
# Testing sending WHO after joining a channel
READ CAP LS 302
READ NICK $nick
READ USER $ $ $ $
SEND :src 001 $nick something :Welcome home
SEND :src 005 $nick a b c :is supported
READ JOIN $chan
SEND :$nick JOIN $chan
EVENTWAIT join channel="$chan" nick=$nick
READ WHO $1
EXPECT $1="#chan"
`);
(async function() {
    await r.run();
})();

const bot = new IRC.Client();
bot.use(CatchAllMiddleware(r));
bot.connect({
    transport: createTestRunnerTransport(r),
    host: 'irc.irc.com',
    nick: 'ircfrw_testrunner',
});
bot.on('registered', function() {
    bot.join('#prawnsalad');
});
//bot.on('debug', l => console.log('[debug]', l));
//bot.on('raw', event => console.log(`[raw ${event.from_server?'s':'c'}]`, event.line));
