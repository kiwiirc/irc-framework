'use strict';

import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';

import * as mocks from '../../mocks.mjs';

import misc from '../../../src/commands/handlers/misc.js';
import IrcCommand from '../../../src/commands/command.js';

use(sinonChai);

describe('src/commands/handlers/misc.js', function() {
    describe('PING handler', function() {
        const mock = mocks.IrcCommandHandler([misc]);
        const cmd = new IrcCommand('PING', {
            params: ['example.com'],
            tags: {
                time: '2021-06-29T16:42:00Z',
            },
        });
        mock.handlers.PING(cmd, mock.spies);

        it('should respond with the appropriate PONG message', function() {
            expect(mock.spies.connection.write).to.have.been.calledOnce;
            expect(mock.spies.connection.write).to.have.been.calledWith('PONG example.com');
        });

        it('should emit the appropriate PING event', function() {
            expect(mock.spies.emit).to.have.been.calledOnce;
            expect(mock.spies.emit).to.have.been.calledWith('ping', {
                message: undefined,
                time: 1624984920000,
                tags: {
                    time: '2021-06-29T16:42:00Z',
                },
            });
        });
    });

    describe('PONG handler', function() {
        it('should emit the appropriate PONG event', function() {
            const mock = mocks.IrcCommandHandler([misc]);
            const cmd = new IrcCommand('PONG', {
                params: ['one.example.com', 'two.example.com'],
                tags: {
                    time: '2011-10-10T14:48:00Z',
                },
            });
            mock.handlers.PONG(cmd, mock.spies);
            expect(mock.spies.network.addServerTimeOffset).to.have.been.calledOnce;
            expect(mock.spies.emit).to.have.been.calledOnce;
            expect(mock.spies.emit).to.have.been.calledWith('pong', {
                message: 'two.example.com',
                time: 1318258080000,
                tags: {
                    time: '2011-10-10T14:48:00Z',
                },
            });
        });
    });
});
