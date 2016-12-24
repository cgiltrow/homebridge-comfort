# homebridge-comfort

Supports Cytech Comfort on the HomeBridge Platform and allows HomeKit to execute responses.
This module currently supports only switching Lightbulbs on/off.

# Installation

1. Install homebridge using: npm install -g homebridge
2. Install homebridge-http using: npm install -g homebridge-comfort
3. Update your configuration file. See sample-config.json in this repository for a sample. 

# Configuration

Comfort is added to HomeKit as a platform that holds all the accessories.

It is recommended to have Fixed Response Numbers so this configuration wouldn't crash after modifying your CCLX files.

You have to specify your Comfort system IP address, port and user login.

To create a working lightbulb you have to specify two Response numbers. One response to turn it on and one to turn it off.
Current version doesn't use Output numbers but they will be required in the future when accessory status reading will be finished.

Configuration sample:

 ```
  "platforms": [
    {
      "platform": "homebridge-comfort.Comfort",
      "name": "Comfort",
      "login": "XXXX",
      "host": "192.168.15.253",
      "port": "1001",
      "accessories": [
        {
          	"name": "Office Light",
          	"type": "light",
          	"output": 8,
          	"responseOn": 15,
          	"responseOff": 16
        },
        {
			"name": "Bedroom",
			"type": "temp_sensor",
			"convertToCelsius": true,
			"scsNumber": 8
		},
		{
			"name" : "Office Blinds",
			"type": "blinds",
			"outputUp": 12,
			"outputDown": 44,
			"timeToOpen" : 24,
			"responseUpOn": 430,
			"responseUpOff": 427,
			"responseDownOn": 428,
			"responseDownOff": 425
		},		
		{
			"name": "Home Security System",
			"type": "security"
		},	
		{
			"name" : "TV",
			"type": "switch",
			"output": 8,
			"responseOn": 15,
			"responseOff": 16
		},
		{
			"name": "Fan",
			"type": "fan",
			"output": 8,
			"responseOn": 15,
			"responseOff": 16					
		},
		{
			"name": "Office PIR",
			"type": "motion_sensor",
			"input": 18
		}

      ]
    }
  ]
```

#ToDo

- add support for partial rollerblind opening
- add Outlets
- finish motion sensor support
- add Smoke sensor support
- add garage door opener support 
- Create events for Inputs
