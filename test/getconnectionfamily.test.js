/*globals describe, it */
var dns = require('dns'),
    net = require('net'),
    sinon = require('sinon'),
    chai = require('chai'),
    expect = chai.expect,
    getConnectionFamily = require('../src/getconnectionfamily');

chai.use(require('sinon-chai'));

describe('src/getconnectionfamily.js', function () {

    it('should not perform a DNS lookup if the input is an IP address', sinon.test(function (done) {
        var resolve4 = this.stub(dns, 'resolve4');

        this.stub(net, 'isIP').returns(true);

        getConnectionFamily('ip_address', function (err/*, family, host*/) {
            expect(err).to.equal(null);
            expect(resolve4).not.to.have.been.calledWith('ip_address');

            done();
        });
    }));

    it('should call the callback with an IPv4 family if the input is an IPv4 adddress', sinon.test(function (done) {
        this.stub(net, 'isIP').returns(true);
        this.stub(net, 'isIPv4').returns(true);

        getConnectionFamily('ip_address', function (err, family/*, host*/) {
            expect(err).to.equal(null);
            expect(family).to.equal('IPv4');

            done();
        });
    }));

    it('should call the callback with an IPv6 family if the input is an IPv6 adddress', sinon.test(function (done) {
        this.stub(net, 'isIP').returns(true);
        this.stub(net, 'isIPv4').returns(false);

        getConnectionFamily('ip_address', function (err, family/*, host*/) {
            expect(err).to.equal(null);
            expect(family).to.equal('IPv6');

            done();
        });
    }));

    it('should perform an A DNS lookup if the input is not an IP address', sinon.test(function (done) {
        var resolve4 = this.stub(dns, 'resolve4').yieldsAsync(null, ['ip_address']);

        this.stub(net, 'isIP').returns(false);

        getConnectionFamily('dns_address', function (err/*, family, host*/) {
            expect(err).to.equal(null);
            expect(resolve4).to.have.been.calledWith('dns_address');

            done();
        });
    }));

    it('should call the callback with an IPv4 family if the input resolves to an IPv4 adddress', sinon.test(function (done) {
        this.stub(net, 'isIP').returns(false);
        this.stub(dns, 'resolve4').yieldsAsync(null, ['ip_address']);

        getConnectionFamily('dns_address', function (err, family/*, host*/) {
            expect(err).to.equal(null);
            expect(family).to.equal('IPv4');

            done();
        });
    }));

    it('should not perform a AAAA DNS lookup if the input is not an IP address and the A DNS lookup returns a result', sinon.test(function (done) {
        var resolve4 = this.stub(dns, 'resolve4').yieldsAsync(null, ['ip_address']),
            resolve6 = this.stub(dns, 'resolve6').yieldsAsync(null, ['ip_address']);

        this.stub(net, 'isIP').returns(false);

        getConnectionFamily('dns_address', function (err/*, family, host*/) {
            expect(err).to.equal(null);
            expect(resolve4).to.have.been.calledWith('dns_address');
            expect(resolve6).not.to.have.been.calledWith('dns_address');

            done();
        });
    }));

    it('should perform a AAAA DNS lookup if the input is not an IP address and the A DNS lookup does not return a result', sinon.test(function (done) {
        var resolve6 = this.stub(dns, 'resolve6').yieldsAsync(null, ['ip_address']);

        this.stub(net, 'isIP').returns(false);
        this.stub(dns, 'resolve4').yieldsAsync(true);

        getConnectionFamily('dns_address', function (err/*, family, host*/) {
            expect(err).to.equal(null);
            expect(resolve6).to.have.been.calledWith('dns_address');

            done();
        });
    }));

    it('should call the callback with an IPv6 family if the input does not resolve to an IPv4 adddress and does resolve to an IPv6 address', sinon.test(function (done) {
        this.stub(net, 'isIP').returns(false);
        this.stub(dns, 'resolve4').yieldsAsync(true);
        this.stub(dns, 'resolve6').yieldsAsync(null, ['ip_address']);

        getConnectionFamily('dns_address', function (err, family/*, host*/) {
            expect(err).to.equal(null);
            expect(family).to.equal('IPv6');

            done();
        });
    }));

    it('should call the callback with an error if the input does not resolve to an IPv4 adddress and does not resolve to an IPv6 address', sinon.test(function (done) {
        this.stub(net, 'isIP').returns(false);
        this.stub(dns, 'resolve4').yieldsAsync(true);
        this.stub(dns, 'resolve6').yieldsAsync(true);

        getConnectionFamily('dns_address', function (err/*, family, host*/) {
            expect(err).to.equal(true);

            done();
        });
    }));

});
