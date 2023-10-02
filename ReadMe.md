# @bestander/homebridge-philips-hue


Control On/Off, Hue, Saturation and Brightness of a Philips Hue White and Color Ambiance Smart Light without a Bridge.

## Prerequisite

Required Packages for [dbus](https://github.com/Shouqun/node-dbus):

- libglib2.0-dev
- libdbus-1-dev

## Installation

`npm i @bestander/homebridge-philips-hue`

## Configuration
```js
{
    "accessory": "HueLamp", // Dont change
    "name": "LED", // Accessory name
    "address": "DE:7E:3F:AB:50:A1" // BLE device UUID
}
```

To find your device uuid, use `hcitool lescan`, grab the device uuid.  
You need to make the lamp pairable before the plugin can connect to it, for that go to Hue App -> Settings -> Voice assistants -> Alexa -> Make discoverable
