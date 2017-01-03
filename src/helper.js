var Helper = {
	parseMask: parseMask,
};

module.exports = Helper;

function parseMask(mask) {
	let nick = '';
	let user = '';
	let host = '';

	let sep1 = mask.indexOf('!');
	let sep2 = mask.indexOf('@');

	if (sep1 === -1 && sep2 === -1) {
		// something
		nick = mask;
	} else if (sep1 === -1 && sep2 !== -1) {
		// something@something
		user = mask.substring(0, sep2);
		host = mask.substring(sep2 + 1);
	} else if (sep1 !== -1 && sep2 === -1) {
		// something!something
		nick = mask.substring(0, sep1);
		user = mask.substring(sep1 + 1);
	} else {
		// something!something@something
		nick = nick = mask.substring(0, sep1);
		user = mask.substring(sep1 + 1, sep2);
		host = mask.substring(sep2 + 1);
	}

	return {
		nick,
		user,
		host,
	}
}
