
<span align="center">

# GPESP32Framework Plugin for Homebridge

</span>

This plugin is designed to use with Homebridge. The mainpurpose of this plugin is to scan for LEDStripe controlled by an ESP32
leveraging the ESP32 Code written in the following repository
[ESPHomeBaseLEDStrip](https://github.com/GuedesPlace/ESP32HomeBaseLEDStripe).

### How it works
The Plugin listen on the upd port 8266 for devices that broadcast theire state. The state is parsed an the plugin register the device, if the device is not already registered. The device is handled as Lightbulb and exposes On/Off, Brightness, ColorTemperatur and HUE/SAT to HomeKit.

### Personal note
This is the result of a vaccation project, with my son. To learn and experience ESP32 technology and the integration in our home system.
### Licence
The code is available under Apache-V2.0. See [LICENCE](LICENCE)
