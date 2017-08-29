const {expect} = require('chai');
const ConfigProcessor = require('./index.js');

const minimal = {};

describe('exposing missing properties', function() {

	it('should not throw...', function(done) {
		expect(function() {
			done();
		}).to.not.throw();
	});

	it('should have property...', function() {
		const s;
		expect(s.property).to.exist;
	});

	it('should be equal...', function(done) {
		const s = {a:1};
		const t = {a:1};
		expect(t).to.deep.equal(s);
		done();
	});

});

describe('merge different configfiles', function() {

	it('should not throw...', function(done) {
		expect(function() {
			done();
		}).to.not.throw();
	});

	it('should have property...', function() {
		const s;
		expect(s.property).to.exist;
	});

	it('should be equal...', function(done) {
		const s = {a:1};
		const t = {a:1};
		expect(t).to.deep.equal(s);
		done();
	});

});
