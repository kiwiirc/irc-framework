const fs = require('fs');
const TestRunner = require('./testrunner');
const TestRunnerTransport = require('./testrunnertransport');
const IRC = require('../src/');

(async function () {
    // Run through each test runner script and run it
    let scriptsDir = __dirname + '/test_scripts/';
    let scripts = fs.readdirSync(scriptsDir);
    for(let i=0; i<scripts.length; i++) {
        let scriptContent = fs.readFileSync(scriptsDir + scripts[i], 'utf8');
        await runScript(scriptContent);
    }
})();

async function runScript(script) {
    const r = new TestRunner();
    r.load(script);

    // Start running the test runner before creating the client to be sure all events are caught
    let scriptRun = r.run();

    const bot = new IRC.Client();
    bot.use(CatchAllMiddleware(r));
    bot.connect({
        transport: createTestRunnerTransport(r),
        host: 'irc.example.net',
        nick: 'ircfrw_testrunner',
    });
    bot.on('registered', function() {
        bot.join('#prawnsalad');
    });
    bot.on('join', event => {
        if (event.nick === bot.user.nick) {
            bot.who(event.channel);
        }
    });
    //bot.on('debug', l => console.log('[debug]', l));
    bot.on('raw', event => console.log(`[raw ${event.from_server?'s':'c'}]`, event.line));

    await scriptRun;
    bot.connection.end();
};

// Create an irc-framework transport
function createTestRunnerTransport(r) {
    return function(...args) {
        return new TestRunnerTransport(r, ...args)
    };
}

// Pass all framework events to TestRunner r
function CatchAllMiddleware(r) {
    return function(client, raw_events, parsed_events) {
        parsed_events.use(theMiddleware);
    };

    function theMiddleware(command, event, client, next) {
        r.addEventFromClient(command, event)
        next();
    }
}
