'use strict';

var Service, Characteristic;
var net = require("net");
var sprintf = require("sprintf-js").sprintf;


function ComfortPlatform(log, config) {
    this.log = log;
    this.host = config["host"];
    this.port = config["port"];
    this.login = config["login"];
    this.ComfortAccessories = config["accessories"];
    this.client = null;
    this.clientTimer = null;
}

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerPlatform("homebridge-comfort", "Comfort", ComfortPlatform);
};

ComfortPlatform.prototype = {
    accessories: function (callback) {
        this.log("Loading accessories...");

        var that = this;
        var foundAccessories = [];
        if (this.ComfortAccessories == null || this.ComfortAccessories.length == 0) {
            callback(foundAccessories);
            return;
        }
        this.ComfortAccessories.map(function (s) {
                that.log("Found: " + s.name);
                var accessory = null;

                if (s.type == 'blinds') {

                    var services = [];

                    var service = {
                        controlService: new Service.WindowCovering('Kitchen Blinds'),
                        characteristics: [Characteristic.CurrentPosition, Characteristic.TargetPosition, Characteristic.PositionState]
                    };

                    service.controlService.subtype = "KitchenBlindsSubtype";

                    that.log("Loading service: " + service.controlService.displayName + ", subtype: " + service.controlService.subtype);

                    services.push(service);

                    accessory = new ComfortAccessory(services);

                } else if (s.type == 'temp_sensor') {

                    var services = [];

                    var service = {
                        controlService: new Service.TemperatureSensor(s.name),
                        characteristics: [Characteristic.CurrentTemperature]
                    };

                    service.controlService.subtype = "BedroomTemperatureSensorSubtype";

                    that.log("Loading service: " + service.controlService.displayName + ", subtype: " + service.controlService.subtype);

                    services.push(service);

                    accessory = new ComfortAccessory(services);

                } else if (s.type == 'light') {

                    var services = [];

                    var service = {
                        controlService: new Service.Lightbulb(s.name),
                        characteristics: [Characteristic.On]
                    };

                    service.controlService.subtype = "Light" + s.name;
                    service.controlService.responseOn = s.responseOn;
                    service.controlService.responseOff = s.responseOff;
                    service.controlService.output = s.output;

                    that.log("Loading service: " + service.controlService.displayName + ", subtype: " + service.controlService.subtype);

                    services.push(service);

                    accessory = new ComfortAccessory(services);

                } else {

                    if (s.buttons.length != 0) {
                        var services = [];
                        for (var b = 0; b < s.buttons.length; b++) {
                            var service = {
                                controlService: new Service.Switch(s.buttons[b].caption),
                                characteristics: [Characteristic.On]
                            };
                            if (s.buttons[b].trigger != null)
                                service.controlService.subtype = s.buttons[b].trigger;
                            else
                                service.controlService.subtype = s.buttons[b].triggerOn + s.buttons[b].triggerOff;
                            service.controlService.trigger = s.buttons[b].trigger;
                            service.controlService.triggerOn = s.buttons[b].triggerOn;
                            service.controlService.triggerOff = s.buttons[b].triggerOff;
                            that.log("Loading service: " + service.controlService.displayName + ", subtype: " + service.controlService.subtype);
                            services.push(service);
                        }
                        accessory = new ComfortAccessory(services);
                    }
                }

                if (accessory != null) {
                    accessory.getServices = function () {
                        return that.getServices(accessory);
                    };
                    accessory.platform = that;
                    accessory.remoteAccessory = s;
                    accessory.name = s.name;
                    accessory.model = "Comfort";
                    accessory.manufacturer = "Cytech";
                    accessory.serialNumber = "<unknown>";
                    foundAccessories.push(accessory);

                }
            }
        )
        callback(foundAccessories);
    },

    convertResponseNumber: function (resposeNumber) {

        if (resposeNumber > 255) {
            var responseNumHigh = resposeNumber - 256;
            var responseNumLow = '01';

            return sprintf("%02X%02X", responseNumHigh, responseNumLow);
        } else {
            return sprintf("%02X", resposeNumber);
        }
    },

    prepareComfortCommand: function (command, that) {

        that.platform.log("Sending comfort command: " + command);

        return sprintf("%c%s%c", 3, command, 13);
    },

    command: function (command, that) {

        if (that.platform.client == null) {
            that.platform.client = new net.Socket();
            that.platform.client.connect(that.platform.port, that.platform.host, function () {

                that.platform.log('Connected to ' + that.platform.host + ':' + that.platform.port);

                that.platform.client.write(that.platform.prepareComfortCommand("LI" + that.platform.login, that));

            });
        } else {
            that.platform.client.write(that.platform.prepareComfortCommand(command, that));
        }

        var buf = "";
        that.platform.client.on('data', function (data) {

            that.platform.log('Incoming data: ' + data);

            buf += data.toString();

            if (data.toString().search(sprintf("%c", 13)) !== -1) {

                that.platform.log("Got message from comfort: " + buf + " / " + buf.substr(0, 2) );

                if (buf.substr(1, 2) == "LU") {

                    that.platform.log("Logged to comfort");
                    that.platform.client.write(that.platform.prepareComfortCommand(command, that));

                } else if (buf.substr(1, 2) == "IP") {

                    that.platform.log("Zone status changed: " + buf);

                } else {

                    clearTimeout( that.platform.clientTimer );
                    that.platform.clientTimer = null;
                    that.platform.clientTimer = setTimeout( function() {
                        that.platform.client.destroy();
                        that.platform.client = null;
                    }.bind( that ), 30000 );

                }

                buf = "";
            }
        });

        that.platform.client.on('close', function () {
            that.platform.log('Connection closed');
        });
    },
    getInformationService: function (homebridgeAccessory) {
        var informationService = new Service.AccessoryInformation();
        informationService
            .setCharacteristic(Characteristic.Name, homebridgeAccessory.name)
            .setCharacteristic(Characteristic.Manufacturer, homebridgeAccessory.manufacturer)
            .setCharacteristic(Characteristic.Model, homebridgeAccessory.model)
            .setCharacteristic(Characteristic.SerialNumber, homebridgeAccessory.serialNumber);
        return informationService;
    },
    bindCharacteristicEvents: function (characteristic, service, accessory) {
        var onOff = characteristic.props.format == "bool" ? true : false;
        characteristic
            .on('set', function (value, callback, context) {

                accessory.platform.log( value, context );

                if (accessory.remoteAccessory.type == 'light') {

                    if (value == 0) {
                        accessory.platform.command("R!" + accessory.platform.convertResponseNumber(service.controlService.responseOff), accessory);
                    } else {
                        accessory.platform.command("R!" + accessory.platform.convertResponseNumber(service.controlService.responseOn), accessory);
                    }

                } else if (accessory.remoteAccessory.type == 'blinds') {

                    accessory.platform.log("Set " + service.name + " blinds to " + value);
                    // jeigu value yra skaicius, tai reikia pasukti zaliuzes. 100 - Atidaryta. 0 - Uzdaryta

                } else {

                    // Cia mygtukai/ijungtuviai beleko, bet ne sviesu

                    // jeigu value == true, tai vadinas reikia ijungti
                    // jeigu value == false, tai vadinas reikia isjungti

                    accessory.platform.log(value, accessory, service, characteristic);

                    // Cia buvo geras kodas, kuris veikė su paprastais ijungtuviais
                    // if (context !== 'fromSetValue') {
                    //     var trigger = null;
                    //     if (service.controlService.trigger != null)
                    //         trigger = service.controlService.trigger;
                    //     else if (value == 0)
                    //         trigger = service.controlService.triggerOff;
                    //     else
                    //         trigger = service.controlService.triggerOn;
                    //
                    //     accessory.platform.command(trigger, "", accessory);
                    //
                    //     if (service.controlService.trigger != null) {
                    //         // In order to behave like a push button reset the status to off
                    //         setTimeout(function () {
                    //             characteristic.setValue(false, undefined, 'fromSetValue');
                    //         }, 100);
                    //     }
                    // }
                }
                callback();
            }.bind(this));
        characteristic.on('get', function (callback) {

            if (accessory.remoteAccessory.type == 'light') {

                var status = accessory.platform.command("O?" + accessory.remoteAccessory.output, accessory);

            } else {

                accessory.platform.log(accessory);

                var min = 10,
                    max = 35;

                var temperature = Math.floor(Math.random() * (max - min + 1)) + min;

            }

            // a push button is normally off
            callback(undefined, temperature);
        }.bind(this));
    },
    getServices: function (homebridgeAccessory) {
        var services = [];
        var informationService = homebridgeAccessory.platform.getInformationService(homebridgeAccessory);
        services.push(informationService);
        for (var s = 0; s < homebridgeAccessory.services.length; s++) {
            var service = homebridgeAccessory.services[s];
            for (var i = 0; i < service.characteristics.length; i++) {
                var characteristic = service.controlService.getCharacteristic(service.characteristics[i]);
                if (characteristic == undefined)
                    characteristic = service.controlService.addCharacteristic(service.characteristics[i]);
                homebridgeAccessory.platform.bindCharacteristicEvents(characteristic, service, homebridgeAccessory);
            }
            services.push(service.controlService);
        }
        return services;
    }
}

function ComfortAccessory(services) {
    this.services = services;
}