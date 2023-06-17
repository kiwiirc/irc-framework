'use strict';

/* globals describe, it */

const net = require('net');
const Connection = require('../src/transports/net');

const chai = require('chai');

chai.use(require('chai-subset'));

async function runTest(serialize_writes) {
    const numLines = 12;
    const timeSlice = 100;

    return new Promise((resolve) => {
        let conn;
        let server; // eslint-disable-line prefer-const
        let wroteLines = [];
        const bufferedLines = [];

        const clientHandler = (client) => {
            client.on('data', (data) => {
                const dataStr = data.toString('utf8');
                bufferedLines.push(dataStr);

                if (wroteLines.length && wroteLines.length === bufferedLines.length) {
                    conn.close();
                    server.close();
                    resolve({ wroteLines, bufferedLines });
                }
            });
        };

        server = net.createServer(clientHandler);
        server.listen(0, '0.0.0.0', () => {
            conn = new Connection({
                host: server.address().address,
                port: server.address().port,
                tls: false,
                serialize_writes,
            });

            wroteLines = Array.from({ length: numLines }).map((_, i) => i).map(String);
            let delay = wroteLines.length / timeSlice;
            const rudeHandler = {
                get(target, prop) {
                    if (prop === 'write') {
                        return (data, cb) => {
                            setTimeout(() => target[prop](data, cb), delay * 1000);
                            delay -= 1 / timeSlice;
                        };
                    } else {
                        return target[prop];
                    }
                }
            };

            conn.on('open', () => {
                conn.socket = new Proxy(conn.socket, rudeHandler);
                wroteLines.forEach((line) => conn.writeLine(line));
            });

            conn.connect();
        });
    });
}

function compareLines(wroteLines, bufferedLines) {
    return bufferedLines.map((l) => l.trim()).every((line, index) => line === wroteLines[index]);
}

describe('src/transports/net.js', function() {
    it('should recieve messages in reverse of the order sent when serialize_writes is false', function(done) {
        runTest(false).then(({ wroteLines, bufferedLines }) => {
            let error = null;
            if (compareLines(wroteLines, bufferedLines) === true) {
                error = new Error('Line order matches when it should not!');
            }
            done(error);
        });
    });

    it('should recieve messages in the order sent when serialize_writes is true', function(done) {
        runTest(true).then(({ wroteLines, bufferedLines }) => {
            let error = null;
            if (compareLines(wroteLines, bufferedLines) === false) {
                error = new Error('Line order does not match when it should!');
            }
            done(error);
        });
    });
});
