// Parse 'key=val key="val" key="val val2" "key name"=val' into an object
function kvParse(inp) {
    let data = {};
    let pos = 0;
    let escapeChar = '\\';

    while (pos < inp.length) {
        let key = '';
        let val = '';

        key = readToken();
        ffwd();
        if (inp[pos] === '=') {
            skip();
            val = readToken({isValue: true});
        } else {
            ffwd();
            val = true;
        }

        data[key] = val;
    }

    return data;

    // Fast forward past whitespace
    function ffwd() {
        while (inp[pos] === ' ' && pos < inp.length) {
            pos++;
        }
    }

    // Skip the current position
    function skip() {
        pos++;
    }

    // Read a block of characters. Quoted allows spaces
    function readToken(opts={isValue:false}) {
        let inQuote = false;
        let buffer = '';

        ffwd();
        do {
            let cur = inp[pos];
            if (!cur) {
                break;
            }
    
            //  Opening quote
            if (!inQuote && isQuote(cur)) {
                inQuote = true;
                continue;
            }
    
            // Escaped closing quote = not a closing quote
            if (inQuote && isQuote(cur) && isEscaped()) {
                buffer += cur;
                continue;
            }
    
            // Closing quote
            if (inQuote && isQuote(cur)) {
                inQuote = false;
                skip();
                break;
            }

            if (!opts.isValue) {
                if (!inQuote && (cur === ' ' || cur === '=')) {
                    break;
                }
            } else {
                // Values allow = characters
                if (!inQuote && cur === ' ') {
                    break;
                }
            }

            buffer += cur;
        } while(++pos < inp.length) 

        return buffer;
    }

    function isQuote(char) {
        return char === '"';
    }

    function isEscaped() {
        return inp[pos-1] === escapeChar;
    }
}

// Splits a string but stops at the first match
function splitOnce(inp, sep=' ') {
    let p1, p2 = '';
    let pos = inp.indexOf(sep);
    if (pos === -1) {
        p1 = inp;
    } else {
        p1 = inp.substr(0, pos);
        p2 = inp.substr(pos + 1);
    }
    return [p1, p2];
}

// A simple promise based Queue
class Queue {
    constructor() {
        this.items = [];
        this.waiting = [];
    }

    add(item) {
        this.items.push(item);
        setTimeout(() => {
            this.deliver();
        });
    }

    get() {
        let res = null;
        let prom = new Promise(resolve => res = resolve);
        prom.resolve = res;
        this.waiting.push(prom);
        setTimeout(() => {
            this.deliver();
        });
        return prom;
    }

    flush() {
        this.waiting.forEach(w => w.resolve());
    }

    deliver() {
        if (this.waiting.length > 0 && this.items.length > 0) {
            this.waiting.shift().resolve(this.items.shift());
        }
    }
}

class RunnerError extends Error {
    constructor(step, message, runner) {
        let errMessage = runner && runner.description ?
            `[${runner.description}] ` :
            '';
        if (step) {
            errMessage += `at test line ${step.sourceLineNum}: `
        }
        super(errMessage + message);
        this.name = 'RunnerError';
    }
}

// A single actionable step from a test script
class TestStep {
    constructor(command, args) {
        this.command = command;
        this.args = args;
        this.sourceLineNum = 0;
    }
}


// Execute a test script
class TestRunner {
    constructor() {
        this.description = '';
        this.steps = [];
        this.vars = new Map();
        this.clientBuffer = new Queue();
        this.clientEvents = new Queue();
        this.onSendLine = (line) => {};
    }

    load(input) {
        let firstComment = '';

        let steps = [];
        input.split('\n').forEach((line, lineNum) => {
            // Strip out empty lines and comments, keeping track of line numbers for kept lines
            let trimmed = line.trim();
            if (!trimmed) {
                return;
            }

            // Comment
            if (trimmed[0] === '#') {
                firstComment = firstComment || trimmed.replace(/^[# ]+/, '').trim();
                return;
            }

            let pos = trimmed.indexOf(' ');
            let command = trimmed.substr(0, pos).toUpperCase();
            let args = trimmed.substr(pos).trim();
            let step = new TestStep(command, args);
            step.sourceLineNum = lineNum;
            steps.push(step);
        });
        
        this.description = firstComment;
        this.steps = steps;
    }

    async run() {
        for(let i=0; i<this.steps.length; i++) {
            let step = this.steps[i];
            let fnName = 'command' + step.command.toUpperCase();
            if (typeof this[fnName] !== 'function') {
                throw new RunnerError(step, `Unknown command '${step.command}'`, this);
            }

            await this[fnName].call(this, step);
        }
    }

    addEventFromClient(name, event) {
        this.clientEvents.add({name, event});
    }

    addLineFromClient(newLine) {
        this.clientBuffer.add(newLine);
    }

    getLineFromClient() {
        return this.clientBuffer.get();
    }

    async commandREAD(step) {
        let line = await this.getLineFromClient();
        let lineParts = line.split(/\ +/);
        let stepParts = step.args.split(/\ +/);

        // Num. args in the READ command may be lower than what we have read, but we
        // must have enough EXPLAIN BETTER
        if (lineParts.length < stepParts.length) {
            throw new RunnerError(step, 'Not enough arguments read', this);
        }

        // Compare vars from each parts array
        stepParts.forEach((stepArg, idx) => {
            let varName = this.varName(stepArg);
            if (varName) {
                this.vars.set(varName, lineParts[idx]);
            } else if (varName === '') {
                // empty var name = ignore this value
            } else {
                if (stepArg !== lineParts[idx]) {
                    throw new RunnerError(step, `READ expected '${stepArg}', got '${lineParts[idx]}'`, this);
                }
            }
        });
    }

    async commandSEND(step) {
        let line = step.args.replace(/(^|\W)\$([a-z0-9_]+)/g, (_, prefix, varName) => {
            return prefix + (this.vars.get(varName) || '-');
        });

        if (typeof this.onSendLine === 'function') {
            this.onSendLine(line);
        }
    }

    async commandEXPECT(step) {
        let checks = kvParse(step.args);
        for (let prop in checks) {
            // Both the key or value could be a variable
            let key = this.varName(prop);
            key = key === false ?
                prop :
                this.vars.get(key);
            
            let val = this.varName(checks[prop]);
            val = val === false ?
                checks[prop] :
                this.vars.get(val);

            if (key !== val) {
                throw new RunnerError(step, `EXPECT failed to match '${key}'='${val}'`, this);
            }
        }
    }

    async commandEVENTWAIT(step) {
        let [eventName] = splitOnce(step.args);
        return this.commandEVENT(step, eventName);
    }

    async commandEVENT(step, waitForEventName='') {
        let pos = step.args.indexOf(' ');
        let eventName = step.args.substr(0, pos);
        let checks = kvParse(step.args.substr(pos));
        let name, event = null;

        if (waitForEventName) {
            // Ignore all events until we find the one we want
            while (name !== waitForEventName) {
                ({name, event} = await this.clientEvents.get());
            }
        } else {
            ({name, event} = await this.clientEvents.get());
        }

        if (name !== eventName) {
            throw new RunnerError(step, `EVENT expected event name of '${eventName}', found '${name}'`, this);
        }

        for (let key in checks) {
            let val = this.varName(checks[key]);
            val = val === false ?
                checks[key] :
                this.vars.get(val);

            if (event[key] !== val) {
                throw new RunnerError(step, `EVENT failed to match property '${key}'='${val}', found '${event[key]}'`, this);
            }
        }
    }

    varName(inp) {
        return inp[0] === '$' ?
            inp.substr(1) :
            false;
    }
}

module.exports = TestRunner;
