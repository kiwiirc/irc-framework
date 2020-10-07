'use strict';
/* globals describe, it */
const TestProtocol = require('../test_protocol/');

describe('protocol test runners', async function() {
    it('should run all protocol test scripts', async function() {
        await TestProtocol()
    });
});
