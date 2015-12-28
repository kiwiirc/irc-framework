var net = require('net'),
    dns = require('dns');

function getConnectionFamily(host, callback) {
    if (net.isIP(host)) {
        if (net.isIPv4(host)) {
            callback(null, 'IPv4', host);
        } else {
            callback(null, 'IPv6', host);
        }
    } else {
        dns.resolve4(host, function resolve4Cb(err, addresses) {
            if (!err) {
                callback(null, 'IPv4', addresses[0]);
            } else {
                dns.resolve6(host, function resolve6Cb(err, addresses) {
                    if (!err) {
                        callback(null, 'IPv6',addresses[0]);
                    } else {
                        callback(err);
                    }
                });
            }
        });
    }
}

module.exports = getConnectionFamily;
