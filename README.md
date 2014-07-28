# rfduino_node

## general

[RF-Duino](http://www.rfduino.com/) nodejs object


## Prerequisities
Linux machine

### Bluetooth setup
   - needs a Bluetooth 4.0 dongle
   - bluez installed with bt 4.0 support - www.bluez.org - On debian based distributions :
   
        sudo apt-get install bluetooth bluez bluez-utils blueman libbluetooth-dev
	    sudo apt-get install libusb-dev libdbus-1-dev libglib2.0-dev
	    
	    # check bluetooth installed
        bluetoothd -v
        
   - to check your setup - with BT4.0 dongle plugged :

        # get local devices and identify your usb dongle
        hcitool dev 
        # Domi cube advertisements messages should be received - its name is SensorTag
        sudo hcitool lescan -i your_bt4.0_dongle 

### Nodejs
Get a nodejs recent version >= 0.10.2 On debian based distributions : 

    sudo apt-get install nodejs
    sudo apt-get install npm
    npm config set registry http://registry.npmjs.org/

For rpi, nodejs version too old, for newer version intall refer : http://joshondesign.com/2013/10/23/noderpi

## Test rf_duino node

Before running test, an RFDuino must be send data and listen on data received. 

To run test :

    sudo DEBUG=rf_duino_node,rf_duino_node_test node rf_duino_node_test.js
    
## RF-Duino  methods/events description

### usage

__discover__

    RFDuino.Discover(callback, uuid);

__connect__

    rfDuino.connect(callback);
    
__disconnect__

    rfDuino.disconnect(callback);

__discover services__

    rfDuino.discoverServicesAndCharacteristics(callback);

__read devices infos__

    rfDuino.readDeviceName(callback);
    rfDuino.readAppearance(callback);
    rfDuino.readPreferredConnParams(callback);
    rfDuino.readDeviceName(callback);

__receive data__
	rfDuino.notifyDataReceive(callback);
	rfDuino.unnotifyDataReceive(callback);

__write data__

    rfDuino.writeData(data, callback);

__emitted events__
	- 'disconnect'
	- 'connect'
    - 'connectionDrop'
    - 'reconnect'
    - 'dataReceived'

## references 

 http://forum.rfduino.com/index.php?topic=73.0
 https://epx.com.br/artigos/bluetooth_gatt.php