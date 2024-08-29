'use strict';

import _ from 'lodash';
import sinon from 'sinon';

export function IrcCommandHandler(modules) {
    const handlers = {};

    modules.map(function(m) {
        return m({
            addHandler: function(command, handler) {
                handlers[command] = handler;
            },
        });
    });

    const stubs = {
        emit: sinon.stub(),
        connection: {
            write: sinon.stub(),
        },
        network: {
            addServerTimeOffset: sinon.stub(),
        },
    };

    const handler = _.mapValues(stubs, function spyify(value) {
        if (_.isFunction(value)) {
            return sinon.spy(value);
        } else if (_.isObject(value)) {
            return _.mapValues(value, spyify);
        }
    });

    return {
        handlers: handlers,
        stubs: stubs,
        spies: handler,
    };
}
