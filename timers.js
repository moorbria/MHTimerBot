// timers.js
//   Define what a mousehunt timer is.

var Timer = function(area, seed_time, repeat_time, announce_string) {
	//Simple constructor. Takes input arguments and gives them names, sets a few next times
	this.area = area;
	this.seed_time = new Date(seed_time); //milliseconds since epoch, UTC
	this.repeat_time = repeat_time; // milliseconds between repeats
	this.announce_string = announce_string;
	
}

Timer.prototype.getNext = function() {
	var cur_time = Date.now();
	//returns the previous one
	return new Date(cur_time + ((this.seed_time.valueOf() - cur_time) % this.repeat_time) + this.repeat_time);  //division is numer of whole elapsed iterations, modulus is ms until next
//	return new Date(cur_time + (Math.abs(this.seed_time.valueOf() - cur_time) % this.repeat_time));  //division is numer of whole elapsed iterations, modulus is ms until next
}

Timer.prototype.getAnnounce = function() {
	return this.announce_string;
}

Timer.prototype.getInterval = function() {
	return this.seed_time;
}

module.exports = Timer;
