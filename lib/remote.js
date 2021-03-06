var util = require('util')
	, Fiber = require('fibers')
	, Future = require('fibers/future')
	, Flight = require('./flight')
	, SSHTransport = require('./transport/ssh');

function RemoteFlight(flightplan, fn) {
	RemoteFlight.super_.call(this, flightplan, SSHTransport, fn);

	if(!this.flightplan.briefing()) {
		this.logger.error("You can\'t do remote flights without a briefing.");
		this.flightplan.abort();
	}
}

util.inherits(RemoteFlight, Flight);

RemoteFlight.prototype.__start = function() {
	var task = function(host) {
		var future = new Future();
		var flight = new RemoteFlight(this.flightplan, this.fn);
		Fiber(function() {
			var t = process.hrtime();

			var transport = new flight.transportClass(flight, host);
			try {
				flight.fn(transport);
			} catch(e) {
				this.status.aborted = true;
				this.status.crashRecordings = e.message || null;
				this.flightplan.abort();
			}
			transport.close();

			t = process.hrtime(t);
			flight.status.executionTime = Math.round(t[0]*1e3 + t[1]/1e6);
			if(flight.status.executionTime > this.status.executionTime) {
				this.status.executionTime = flight.status.executionTime;
			}
			return future.return();
		}.bind(this)).run();

		return future;
	}.bind(this);

	var tasks = [];
	for(var i=0, len=this.hosts.length; i < len; i++) {
		tasks.push(task(this.hosts[i]));
	}
	Future.wait(tasks);

	return this.status;
};



module.exports = RemoteFlight;