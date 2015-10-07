/*jshint loopfunc: true */

var debug = require('debug')('rf_duino_node');
var events = require('events');
var util = require('util');

var noble = require('noble');

/*********************************
 * bluetooth services
 *********************************/
//Generic access service
var GENERIC_ACCESS_UUID = '1800';
//service characteristics uuids
var DEVICE_NAME_UUID = '2a00';
var APPEARANCE_UUID = '2a01';
var PERIPHERAL_PREFERRED_CONNECTION_PARAMETERS_UUID = '2a04';

//Generic attribute service
var GENERIC_ATTRIBUTE_UUID = '1801';
//unknown char ???
//var UNKNOWN_UUID = '2a05';

//RF Duino specific service
var RF_DUINO_SERVICE_UUID = '2220';
//enable notification to this service to receive data
var RX_UUID = '2221';
//write data on this service to send data to rfduino
var TX_UUID = '2222';
var DISCONNECT_UUID = '2223';

function RFDuino(peripheral) {
	this._peripheral = peripheral;
	this._services = {};
	this._characteristics = {};
	this._bindings = {};

	//Attributes for restoration after a connection drop
	this._enabledNotifications = [];
	this._writtenCharacteristics = {};

	this._uuid = peripheral.uuid;

	this._peripheral.on('connectionDrop', this.onConnectionDrop.bind(this));
	this._peripheral.on('disconnect', this.onDisconnect.bind(this));
	this._peripheral.on('connect', this.onConnect.bind(this));

	//Set all bindings - workaround to Nodejs events listener implementation : two same methods binded won't be
	//recognized as same listener
	this._bindings.onDataReceived = this.onDataReceived.bind(this);
}

util.inherits(RFDuino, events.EventEmitter);

RFDuino.discover = function (callback, uuids) {
	 //RP - JS rules!!! 
    // needs if : static variable. At next discover call, RFDuino.discover.onDiscover !== RFDuino.discover.onDiscover (registered as 'discover' listener)
    if(!RFDuino.discover.onDiscover){
        RFDuino.discover.onDiscover = function (peripheral) {
            if (peripheral.advertisement.localName === 'RFduino' && (uuids === undefined || uuids.indexOf(peripheral.uuid) !== -1)) {
                noble.removeListener('discover', RFDuino.discover.onDiscover);
                noble.stopScanning();
                var rfDuino = new RFDuino(peripheral);
                callback(null, rfDuino);
            }
        };
    }

	var startScanningOnPowerOn = function () {
        if (noble.state === 'poweredOn') {
            if(noble.listeners('discover') 
                && noble.listeners('discover').length > 0
                && noble.listeners('discover').indexOf(RFDuino.discover.onDiscover) != -1)
            {
                //be sure to not register listener multiple times (in case of 'discover' listener not called)
                // listener already registered - no need to reregister it
            }
            else{
                noble.on('discover', RFDuino.discover.onDiscover);
            }
			noble.startScanning();
		} else if (noble.state === 'unknown') {
            //Wait for adapter to be ready
			noble.once('stateChange', startScanningOnPowerOn);
		} else {
            callback(new Error('Please be sure Bluetooth 4.0 supported / enabled on your system before trying to connect to sensortag-node'), null);
        }
    }.bind(this);
	startScanningOnPowerOn();
};

RFDuino.stopDiscover = function(callback){
    debug('stop discover');
	noble.stopScanning(callback);
};

RFDuino.prototype.onConnectionDrop = function () {
	this.emit('connectionDrop');
};

RFDuino.prototype.reconnect = function (callback) {
	this._peripheral.reconnect(callback);
};

RFDuino.prototype.onReconnectAfterCharsDiscovery = function () {
	this.restoreCharsAndNotifs(function () {
		this.emit('reconnect');
	}.bind(this));
};

RFDuino.prototype.onReconnectDuringCharsDiscovery = function (callback) {
	this.discoverServicesAndCharacteristics(function(){
		this.emit('reconnect');
	}.bind(this));
};

RFDuino.prototype.restoreCharsAndNotifs = function (callback) {
	var char_index;
	debug('restore written characteristics and notifications after connection drop');

	var loopIndex = 0;
	var iterateOverChars = function(){
		if(loopIndex < Object.keys(this._writtenCharacteristics).length){
			this._characteristics[Object.keys(this._writtenCharacteristics)[loopIndex]].write(this._writtenCharacteristics[Object.keys(this._writtenCharacteristics)[loopIndex]], false, iterateOverChars);
			loopIndex++;
		}
		else{
			// now restore enabled notifications
			char_index = 0;
			restoreEnabledNotif()
		}
	}.bind(this);

	var restoreEnabledNotif = function(){
		if(char_index < this._enabledNotifications.length){
			this._enabledNotifications[char_index].notify(true, restoreEnabledNotif);
			char_index++;
		}
		else{
			callback();
		}
	}.bind(this);

	iterateOverChars();
};


RFDuino.prototype.onDisconnect = function () {
	this.emit('disconnect');
};

RFDuino.prototype.onConnect = function () {
	this.emit('connect');
};

RFDuino.prototype.toString = function () {
	return JSON.stringify({
		uuid: this.uuid
	});
};

RFDuino.prototype.connect = function (callback) {
	this._peripheral.connect(callback);
};

RFDuino.prototype.disconnect = function (callback) {
	//Empty data stored for reconnection
	this._enabledNotifications.length = 0;
	this._writtenCharacteristics = {};

	this._peripheral.disconnect(callback);
};

RFDuino.prototype.discoverServicesAndCharacteristics = function (callback) {
	this._peripheral.removeAllListeners('reconnect');
	this._peripheral.on('reconnect', this.onReconnectDuringCharsDiscovery.bind(this, callback));
	this._peripheral.discoverAllServicesAndCharacteristics(function (error, services, characteristics) {
		if (error === null) {
			for (var i in services) {
				if(services.hasOwnProperty(i)){
					var service = services[i];
					debug('service ' + service + 'discovered');
					this._services[service.uuid] = service;
				}
			}

			for (var j in characteristics) {
				if(characteristics.hasOwnProperty(j)){
					var characteristic = characteristics[j];
					debug('characteristic ' + characteristic + 'discovered');
					this._characteristics[characteristic.uuid] = characteristic;
				}
			}
		}

		this._peripheral.removeAllListeners('reconnect');
		this._peripheral.on('reconnect', this.onReconnectAfterCharsDiscovery.bind(this));
		callback();
	}.bind(this));
};

RFDuino.prototype.writeCharacteristic = function (uuid, data, callback) {
	this._characteristics[uuid].write(data, false, function () {
		//Keep written characteristics for a possible restoration
		this._writtenCharacteristics[uuid] = data;
		callback();
	}.bind(this));
};

RFDuino.prototype.notifyCharacteristic = function (uuid, notify, listener, callback) {
	var characteristic = this._characteristics[uuid];
	if (characteristic === undefined) {
		//TODO throw error
		debug('characteristic with uuid ' + uuid + ' not supported by rf_duino');
		callback();
	} else {
		characteristic.notify(notify, function (state) {
			if (notify) {
				characteristic.on('read', listener);
				//Keep notification state for a possible restoration
				this._enabledNotifications.push(characteristic);
			} else {
				characteristic.removeListener('read', listener);
				//Remove from notification array if notification have been disabled
				var charIndex = this._enabledNotifications.indexOf(characteristic);
				if (charIndex !== -1) {
					this._enabledNotifications.splice(charIndex, 1);
				}
			}
			callback();
		}.bind(this));
	}
};

RFDuino.prototype.readDataCharacteristic = function (uuid, callback) {
	if (this._characteristics[uuid] === undefined) {
		debug('characteristic with uuid ' + uuid + ' not supported by rf_duino');
	}
	else{
		this._characteristics[uuid].read(function (error, data) {
			callback(data);
		});
	}
};

RFDuino.prototype.readStringCharacteristic = function (uuid, callback) {
	this.readDataCharacteristic(uuid, function (data) {
		callback(data.toString());
	});
};

RFDuino.prototype.readDeviceName = function (callback) {
	this.readStringCharacteristic(DEVICE_NAME_UUID, callback);
};

RFDuino.prototype.readAppearance = function (callback) {
	this.readDataCharacteristic(APPEARANCE_UUID, callback);
};

RFDuino.prototype.readPreferredConnParams = function (callback) {
	this.readDataCharacteristic(PERIPHERAL_PREFERRED_CONNECTION_PARAMETERS_UUID, callback);
};

RFDuino.prototype.writeData = function (data, callback) {
	this.writeCharacteristic(TX_UUID, data, callback);
};

RFDuino.prototype.notifyDataReceive = function (callback) {
	this.notifyCharacteristic(RX_UUID, true, this._bindings.onDataReceived, callback);
};

RFDuino.prototype.unnotifyDataReceive = function (callback) {
	this.notifyCharacteristic(RX_UUID, false, this._bindings.onDataReceived, callback);
};

RFDuino.prototype.onDataReceived = function (data) {
	this.emit('dataReceived', data);
};

module.exports = RFDuino;