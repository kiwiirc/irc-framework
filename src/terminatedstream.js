'use strict';

var stream = require('stream');

module.exports = class TerminatedStream extends stream.Transform {
	constructor(opts) {
		super();

		this.opts = Object.assign({}, {
			terminator: '\n',
			flush_remaining: false,
			max_buffer_size: 0
		}, opts);

		this.buffer = Buffer(0);
		this.terminator_len = Buffer.byteLength(this.opts.terminator);
		this.terminator_buf = new Buffer(this.opts.terminator);
	}


	_transform(chunk, encoding, done) {
		var buffer = Buffer.concat([this.buffer, chunk], this.buffer.length + chunk.length);
		var term = this.terminator_buf;
		var term_len = this.terminator_len;
		var last_terminator = -1;
		var found_terminator = false;
		var remaining_len = 0;

		for (var i=0; i<buffer.length; i++) {
			found_terminator = false;

			if (term_len === 1 && buffer[i] === term[0]) {
				found_terminator = true;
			} else if (term_len > 1 && buffer[i] === term[0]) {
				if (this._terminatorAt(buffer, i, term)) {
					found_terminator = true;
				}
			}

			if (found_terminator) {
				if (last_terminator === -1) {
					this.push(buffer.slice(0, i));
				} else {
					this.push(buffer.slice(last_terminator+term_len, i));
				}
				last_terminator = i;
			}
		}

		remaining_len = buffer.length - (last_terminator === -1 ? 0 : last_terminator);
		if (this.opts.max_buffer_size > 0 && remaining_len > this.opts.max_buffer_size) {
			this.emit('buffer_overflow');
			this.buffer = new Buffer(0);

		} else if (last_terminator !== -1) {
			this.buffer = buffer.slice(last_terminator+term_len);

		} else {
			this.buffer = buffer;
		}

		done();
	}


	_flush(done) {
		if (this.opts.flush_remaining && this.buffer.length > 0) {
			this.push(this.buffer);
		}

		done();
	}


	_terminatorAt(chunk, from_idx, terminator) {
		var len = terminator.length;

		for (var i=0; i<len; i++) {
			if (chunk[from_idx + i] !== terminator[i]) {
				return false;
			}
		}

		return true;
	}
};
