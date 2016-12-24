'use strict';

var Service, Characteristic;
var net = require("net");
var sprintf = require("sprintf-js").sprintf;
var console = {};

function ComfortPlatform( log, config) {
    console.log = log;
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
	
	securityStates: {
		OFF: "00",
		AWAY: "01",
		NIGHT: "02",
		DAY: "03",
		VACATION: "04"
	},
	
    accessories: function (callback) {
        console.log("Loading accessories...");

        var that = this;
        var foundAccessories = [];
        if (this.ComfortAccessories == null || this.ComfortAccessories.length == 0) {
            callback(foundAccessories);
            return;
        }
        this.ComfortAccessories.map(function (s) {
                console.log("Found: " + s.name);
                var accessory = null;

                if (s.type == 'blinds') {

                    var services = [];

                    var service = {
                        controlService: new Service.WindowCovering( s.name ),
                        characteristics: [Characteristic.CurrentPosition, Characteristic.TargetPosition, Characteristic.PositionState]
                    };

                    service.controlService.subtype = "Blinds"  + s.name;
                    service.controlService.responseUpOn = s.responseUpOn;
                    service.controlService.responseUpOff = s.responseUpOff;
                    service.controlService.responseDownOn = s.responseDownOn;
                    service.controlService.responseDownOff = s.responseDownOff;
                    service.controlService.timeToOpen = s.timeToOpen;
                    service.controlService.outputUp = s.outputUp;
                    service.controlService.outputDown = s.outputDown;

                    console.log("Loading service: " + service.controlService.displayName + ", subtype: " + service.controlService.subtype);

                    services.push(service);

                    accessory = new ComfortAccessory(services);

                } else if (s.type == 'temp_sensor') {

                    var services = [];

                    var service = {
                        controlService: new Service.TemperatureSensor(s.name),
                        characteristics: [Characteristic.CurrentTemperature]
                    };

                    service.controlService.subtype = "TemperatureSensor" + s.name;
                    service.controlService.scsNumber = s.scsNumber;
                    service.controlService.convertToCelsius = s.convertToCelsius;

                    console.log("Loading service: " + service.controlService.displayName + ", subtype: " + service.controlService.subtype);

                    services.push(service);

                    accessory = new ComfortAccessory(services);

				} else if (s.type == "security") {
					
                    var services = [];

                    var service = {
                        controlService: new Service.SecuritySystem(s.name),
                        characteristics: [Characteristic.SecuritySystemCurrentState, Characteristic.SecuritySystemTargetState]
                    };

                    service.controlService.subtype = "SecuritySystem" + s.name;

                    console.log("Loading service: " + service.controlService.displayName + ", subtype: " + service.controlService.subtype);

                    services.push(service);

                    accessory = new ComfortAccessory(services);
					

				} else if (s.type == "motion_sensor") {

                    var services = [];

                    var service = {
                        controlService: new Service.MotionSensor(s.name),
                        characteristics: [Characteristic.MotionDetected]
                    };

                    service.controlService.subtype = "TemperatureSensor" + s.name;
                    service.controlService.input = s.input;

                    console.log("Loading service: " + service.controlService.displayName + ", subtype: " + service.controlService.subtype);

                    services.push(service);

                    accessory = new ComfortAccessory(services);
			
                } else if (s.type == 'light' || s.type == 'switch' || s.type == 'fan') {

                    var services = [];

                    var service = {
	                    controlService: null,
                        characteristics: [Characteristic.On]
                    };
                    
                    
					if ( s.type == 'light') {
	                    service.controlService = new Service.Lightbulb(s.name);
					} else if ( s.type == 'switch' ) {
						service.controlService = new Service.Switch(s.name);
					} else if ( s.type == 'fan' ) {
						service.controlService = new Service.Fan(s.name);
					}
                   
                    service.controlService.subtype = s.type + s.name;
                    service.controlService.responseOn = s.responseOn;
                    service.controlService.responseOff = s.responseOff;
                    service.controlService.output = s.output;

                    console.log("Loading service: " + service.controlService.displayName + ", subtype: " + service.controlService.subtype);

                    services.push(service);

                    accessory = new ComfortAccessory(services);

                } else {

					that.log("Loading strange service: " + s )

/*
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
*/
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
            } )
        callback(foundAccessories);
    },

	hexToDec: function( hex ) {
		return parseInt( hex, 16 );	
	},
	
	toCelsius: function( fahrenheit ) {
		return Math.round( (fahrenheit - 32) * 5/9 *100 ) / 100;
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

        console.log("Sending comfort command: " + command);

        return sprintf("%c%s%c", 3, command, 13);
    },
    
    createComfortClient: function( that ) {
        that.platform.client = new net.Socket();
        that.platform.client.connect(that.platform.port, that.platform.host, function () {

//                 that.platform.log('Connected to ' + that.platform.host + ':' + that.platform.port);

            that.platform.client.write(that.platform.prepareComfortCommand("LI" + that.platform.login, that));

        }).on('error', function(err) {
                    
            if (err.code == "ECONNREFUSED") {
                console.log("[ERROR] Connection refused! Please check the IP.");
                device.clientSocket.destroy();
                return;
            } else {
                if (err.code == "ENOTFOUND") {
                    console.log("[ERROR] No device found at this address!");
                    device.clientSocket.destroy();
                    return;
                }	                
                	
                console.log("[CONNECTION] Unexpected error! " + err.message + "     RESTARTING SERVER");
                process.exit(1);
            }


		});
    },

    command: function (command, that, callback ) {

        if (that.platform.client == null) {		
			that.platform.createComfortClient(that)                        
        } else {
            that.platform.client.write(that.platform.prepareComfortCommand(command, that));
        }

		that.platform.addCommandHandler( command, that, callback )
    },
    
    addCommandHandler: function( command, that, callback ) {
	    
		var rand = new Date().getTime();		
        var buf = "";
        var completed = false;
        
        var dataReceived = function (data) {

//             that.platform.log('Incoming data: ' + data);
            buf += data.toString();
	            
            if (data.toString().search(sprintf("%c", 13)) !== -1) {

//                 that.platform.log("Got message from comfort ("+ rand +"): " + buf + " / " + buf.substr(0, 2) );

                if (buf.substr(1, 2) == "LU") {

//                     that.platform.log("Logged to comfort");

					if ( command != "" ) {
                    	that.platform.client.write(that.platform.prepareComfortCommand(command, that));
                    }

//                 } else if (buf.substr(1, 2) == "IP") {
//                     that.platform.log("Zone status changed: " + buf);

                } else {

					if ( typeof callback == 'function' && !completed ) {
						
// 						that.platform.log(buf.substr( 1, 2) +"--"+ buf.substr( 3, 2)+"--"+ buf.substr( 5 ))
						
						completed = callback( buf.substr( 1, 2), buf.substr( 3, 2), buf.substr( 5 ) )
												
						if ( completed ) {
							that.platform.client.removeListener('data', dataReceived )
						}
					}
					
                    clearTimeout( that.platform.clientTimer );
                    that.platform.clientTimer = null;
                    that.platform.clientTimer = setTimeout( function() {
                        that.platform.client.destroy();
                        that.platform.client = null;
                    }.bind( that ), 30000 );

                }

                buf = "";
            }
        };
        
                
        that.platform.client.on('data', dataReceived );
	    
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
	     
        characteristic.on('set', function (value, callback, context) {

//                 accessory.platform.log( value, context );

                if (accessory.remoteAccessory.type == 'light' || accessory.remoteAccessory.type == "switch" || accessory.remoteAccessory.type == "fan" ) {

                    if (value == 0) {
                        accessory.platform.command("R!" + accessory.platform.convertResponseNumber(service.controlService.responseOff), accessory, function() {
                            callback();
                            return true;
                        });
                    } else {
                        accessory.platform.command("R!" + accessory.platform.convertResponseNumber(service.controlService.responseOn), accessory, function() {
                            callback();
                            return true;
                        });
                    }

                } else if (accessory.remoteAccessory.type == 'blinds') {

                    console.log("Start blinds logic");
/*
                    // Turn off both directions
                    accessory.platform.command("R!" + accessory.platform.convertResponseNumber( service.controlService.responseDownOff ), accessory );
                    accessory.platform.command("R!" + accessory.platform.convertResponseNumber( service.controlService.responseUpOff ), accessory );

                    var onResponse, offResponse;

                    if ( value == 0 ) {
                        onResponse = service.controlService.responseDownOn;
                        offResponse = service.controlService.responseDownOff;
                    } else {
                        // We use these responses to completely open the blinds (even if we wan't them half opened)
                        onResponse = service.controlService.responseUpOn;
                        offResponse = service.controlService.responseUpOff;
                    }

                    // Turn on Up/Down response for timeToOpen
                    accessory.platform.command("R!" + accessory.platform.convertResponseNumber( onResponse ), accessory );

                    setTimeout( function( accessory, offResponse ) {
                        accessory.platform.command("R!" + accessory.platform.convertResponseNumber( offResponse ), accessory );
                    }.bind(undefined, accessory, offResponse ), service.controlService.timeToOpen * 1000 );

                    accessory.platform.log( "Turn off after " + service.controlService.timeToOpen * 1000 + " milliseconds");

                    // If we need partial opening close the blinds partially

                    if ( value != 0 && value != 100 ) {

                        var timeToClose = (service.controlService.timeToOpen * value / 100) * 1000;

                        accessory.platform.command("R!" + accessory.platform.convertResponseNumber( service.controlService.responseDownOn ), accessory );

                        setTimeout( function( accessory, offResponse ) {
                            accessory.platform.command("R!" + accessory.platform.convertResponseNumber( offResponse ), accessory );
                        }.bind(undefined, accessory, service.controlService.responseDownOff ), timeToClose );

                    }
*/

                    console.log("Set blinds to " + value, service );
                    callback();

				} else if ( accessory.remoteAccessory.type == "security") {
					
					console.log("Set security to " + value, service );
					
					var statusMap = {};
						statusMap[ Characteristic.SecuritySystemTargetState.STAY_ARM ] = accessory.platform.securityStates.DAY;
						statusMap[ Characteristic.SecuritySystemTargetState.AWAY_ARM ] = accessory.platform.securityStates.AWAY;
						statusMap[ Characteristic.SecuritySystemTargetState.NIGHT_ARM ] = accessory.platform.securityStates.NIGHT;
						statusMap[ Characteristic.SecuritySystemTargetState.DISARM ] = accessory.platform.securityStates.OFF;
					
					if ( statusMap[ value ] ) {
						
						accessory.platform.command("M!" + statusMap[ value ] + accessory.platform.login, accessory, function( command, status ) {
							
							console.log( command, status )							
														
							if ( command == "MD") {							
				                callback( undefined, value );	
				                return true;
							}
							
							return false;
							
							
						} )
						
					}
					
/*
					// The value property of SecuritySystemTargetState must be one of the following:
					Characteristic.SecuritySystemTargetState.STAY_ARM = 0;
					Characteristic.SecuritySystemTargetState.AWAY_ARM = 1;
					Characteristic.SecuritySystemTargetState.NIGHT_ARM = 2;
					Characteristic.SecuritySystemTargetState.DISARM = 3;
*/

                } else {

                    console.log("SET VALUE OF SOMETHING ", value, accessory.remoteAccessory );
					callback();
                }

            }.bind(this));
                        
        characteristic.on('get', function (callback) {

            if (accessory.remoteAccessory.type == 'light' || accessory.remoteAccessory.type == "switch" || accessory.remoteAccessory.type == "fan") {

                var status = accessory.platform.command("O?" + accessory.platform.convertResponseNumber( accessory.remoteAccessory.output ), accessory, function( command, output, status ) {	                
	                
	                if ( command == "O?" && accessory.platform.hexToDec( output ) == accessory.remoteAccessory.output ) {		                
		                var status = accessory.platform.hexToDec(  status.substr( 0, 2 ) );		               		                
						callback(undefined, status == 1 );		                		                					
						return true;
	                }	            
	                
	                return false;    
                });
                

            } else if ( accessory.remoteAccessory.type == "temp_sensor" ) {

                var result = accessory.platform.command("s?" + accessory.platform.convertResponseNumber( accessory.remoteAccessory.scsNumber ), accessory, function( command, sensor, temperature ) {	                
	                
	                if ( command == "s?" && accessory.platform.hexToDec( sensor ) == accessory.remoteAccessory.scsNumber ) {		        
		                
		                var temperature = accessory.platform.hexToDec( temperature.substr( 0, 2 ) );
		                
		                if ( accessory.remoteAccessory.convertToCelsius ) {
			                temperature = accessory.platform.toCelsius( temperature )
		                } 
		                   
		                callback( undefined, temperature );	                
		                return true;
	                }	                
	                
	                return false;
                } );
                
            } else if ( accessory.remoteAccessory.type == "motion_sensor") {

	            var result = accessory.platform.command("I?" + accessory.platform.convertResponseNumber( accessory.remoteAccessory.input ), accessory, function( command, input, status ) {	                
	                if ( command == "I?" && accessory.platform.hexToDec( input ) == accessory.remoteAccessory.input ) {		                
		                var motionDetected = accessory.platform.hexToDec( status.substr( 0, 2 ) )		                
		                callback( undefined, motionDetected == 1 );	                
		                return true;
	                }	                
	                
	                return false;
                } );

			} else if ( accessory.remoteAccessory.type == "security") {

				accessory.platform.command("M?", accessory, function( command, status, user ) {

					if ( command == "M?") {
					
						var statusMap = {};
							statusMap[ accessory.platform.securityStates.OFF ] = Characteristic.SecuritySystemCurrentState.DISARMED;
							statusMap[ accessory.platform.securityStates.AWAY ] = Characteristic.SecuritySystemCurrentState.AWAY_ARM;
							statusMap[ accessory.platform.securityStates.NIGHT ] = Characteristic.SecuritySystemCurrentState.NIGHT_ARM;
							statusMap[ accessory.platform.securityStates.DAY ] = Characteristic.SecuritySystemCurrentState.STAY_ARM;
							statusMap[ accessory.platform.securityStates.VACATION ] = "";
												
						if ( statusMap[ status ] ) {
							callback( undefined, statusMap[ status ] )
							return true;
						}
						
						return false;	
					}
				})
				
            } else {	            
	            
	            console.log( "READING SOMETHING", accessory.remoteAccessory.type );
	            
                callback( undefined, false );
            }

        }.bind(this));
    },
    
    addMotionEvent: function( characteristic, service, accessory ) {
	    
	    if ( accessory.platform.client == null ) {
		  	accessory.platform.createComfortClient( accessory );
	  	}
	  	
	  	accessory.platform.addCommandHandler( "", accessory, function( command, input, status ) {		
		 	if ( command == "IP" && accessory.remoteAccessory.input == accessory.platform.hexToDec( input ) ) {
			 	characteristic.setValue( accessory.platform.hexToDec( status ) > 0 )
		 	}		  			  	
	  	} )
	  		  	  
    },
    
    addTemperatureEvent: function( characteristic, service, accessory ) {
	  
	    if ( accessory.platform.client == null ) {
		  	accessory.platform.createComfortClient( accessory );
	  	}
	  	
	  	accessory.platform.addCommandHandler( "", accessory, function( command, scsNumber, temperature ) {		
		  	
		 	if ( command == "sr" && accessory.remoteAccessory.scsNumber == accessory.platform.hexToDec( scsNumber ) ) {
			 				 	
                var temperature = accessory.platform.hexToDec( temperature.substr( 0, 2 ) );
                
                if ( accessory.remoteAccessory.convertToCelsius ) {
	                temperature = accessory.platform.toCelsius( temperature )
                } 
                
                characteristic.setValue( temperature )			 	
		 	}		  			  	
	  	} )
	    
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
                    
                if ( service.characteristics[i] == Characteristic.CurrentTemperature ) {
		            homebridgeAccessory.platform.addTemperatureEvent( characteristic, service, homebridgeAccessory )
                }
                    
                if ( service.characteristics[i] == Characteristic.MotionDetected ) {	                
	                homebridgeAccessory.platform.addMotionEvent( characteristic, service, homebridgeAccessory )	                          
	            } else {
	                homebridgeAccessory.platform.bindCharacteristicEvents(characteristic, service, homebridgeAccessory);	                
                }
                    

            }
            services.push(service.controlService);
        }
        return services;
    }
}

function ComfortAccessory(services) {
    this.services = services;
}