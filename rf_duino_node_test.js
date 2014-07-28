var RFDuino = require('./index.js');
var debug = require('debug')('rf_duino_node_test');
var async = require('async');

/************************************************
 * rf_duino_node_test.js
 * test rf duino node
 *************************************************/

//object to test
var rfDuino = null;

/**************************************
 * Exit handlers
 ***************************************/
function cleanRFDuino() {
	debug('clean test');
	if (rfDuino !== null) {
		rfDuino.disconnect();
		rfDuino = null;
	}
	debug('rf_duino_node_test : TEST END');
}

function exitHandler(options, err) {
	if (options.cleanup) {cleanRFDuino();}
	if (err) {debug(err.stack);}
	if (options.exit) {process.exit();}
}

//do something when app is closing
process.on('exit', exitHandler.bind(null, {
	cleanup: true
}));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {
	exit: true
}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {
	exit: true
}));

/*******************************************
 * Start rf_duino_node_test scenario
 *******************************************/

debug('starting rf_duino_node_test');

async.series([
function (callback) {
	RFDuino.discover(function (discoveredRFDuino) {
		debug('rf_duino_node with uuid ' + discoveredRFDuino._uuid + ' discovered');
		rfDuino = discoveredRFDuino;
		callback();
	});
},

function (callback) {
	debug('connect to rf_duino_node');
	rfDuino.connect(function () {
		debug('connected to rf_duino_node');
		callback();
	});
},

function (callback) {
	debug('discover rf_duino_node services');
	rfDuino.discoverServicesAndCharacteristics(function () {
		debug('rf_duino_node services discovered');
		callback();
	});
},

function (callback) {
	rfDuino.readDeviceName(function (deviceName) {
		debug('rf_duino_node name is ' + deviceName);
		callback();
	});
},

function (callback) {
	rfDuino.readAppearance(function (appearance) {
		debug('rf_duino_node apparance bytes are name is : ');
		for (var index = 0; index < appearance.length; index++) {
			debug('0x' + appearance[index].toString(16) + ' ');
		}
		callback();
	});
},

function (callback) {
	rfDuino.readPreferredConnParams(function (preferredConnParams) {
		debug('rf_duino_node preferred conn params are : ');
		for (var index = 0; index < preferredConnParams.length; index++) {
			debug('0x' + preferredConnParams[index].toString(16) + ' ');
		}
		callback();
	});
},

function (callback) {
	debug('writing data to rf_duino_node');

	/** PREREQUISITIES : Some data must read on discovered RFDuino using serial interface */
	rfDuino.writeData(new Buffer([0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0]), function () {
		debug('data written to  rf_duino_node');
		callback();
	});
},

function (callback) {
	debug('notify for new data');

	/** PREREQUISITIES : Some data must written on discovered RFDuino using serial interface */
	rfDuino.on('dataReceived', function (data) {
		debug('data received : ');
		for (var index = 0; index < data.length; index++) {
			debug('0x' + data[index].toString(16) + ' ');
		}
	});
	rfDuino.notifyDataReceive(function () {
		debug('you will be notified on new data');
		callback();
	});
},

function (callback) {
	setTimeout(callback, 2000);
},

function (callback) {
	debug('unnotity for new data');
	rfDuino.unnotifyDataReceive(function () {
		debug('you will not be notified on new data');
		callback();
	});
},

function (callback) {
	setTimeout(callback, 2000);
},


function (callback) {
	debug('re-notity for new data');
	rfDuino.notifyDataReceive(function () {
		debug('you will be notified on new data');
		callback();
	});
},

function (callback) {
	debug('test on going...');
	// Insert other things to do...
}],

function (error, results) {
	if (error) {
		debug('rf_duino_node test : FAILED - error : ' + error + ' - exiting test...');
		cleanRFDuino();
	} else {
		debug('rf_duino_node test - SUCCESS');
	}
});
