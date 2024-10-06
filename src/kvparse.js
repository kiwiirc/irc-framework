// Parse 'key=val key="val" key="val val2" "key name"=val' into an object
module.exports = function kvParse(inp) {
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
