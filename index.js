'use strict';

const Device = require('./device');

let Service, Characteristic;

module.exports = function (homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory('@bestander/homebridge-philips-hue', 'HueLamp', LedLamp);
};

function LedLamp(log, config, api) {
  this.log = log;
  this.config = config;
  this.homebridge = api;

  this.bulb = new Service.Lightbulb(this.config.name);
  // Set up Event Handler for bulb on/off
  this.bulb
    .getCharacteristic(Characteristic.On)
    .on('get', this.getPower.bind(this))
    .on('set', this.setPower.bind(this));
  this.bulb
    .getCharacteristic(Characteristic.Brightness)
    .on('get', this.getBrightness.bind(this))
    .on('set', this.setBrightness.bind(this));
  
  this.log('all event handler was setup.');

  if (!this.config.address) return;
  this.address = this.config.address;

  this.log('Device Address:', this.address);

  this.device = new Device(this.address, log);
}

LedLamp.prototype = {
  getServices: function () {
    if (!this.bulb) return [];
    this.log('Homekit asked to report service');
    const infoService = new Service.AccessoryInformation();
    infoService.setCharacteristic(Characteristic.Manufacturer, 'LedLamp');
    return [infoService, this.bulb];
  },
  getPower: function (callback) {
    this.log('Homekit Asked Power State', this.device.power);
    callback(null, this.device.power);
  },
  setPower: function (on, callback) {
    this.log('Homekit Gave New Power State' + ' ' + on);
    this.device.set_power(on);
    callback(null);
  },
  getBrightness: function (callback) {
    this.log('Homekit Asked Brightness');
    callback(null, this.device.brightness);
  },
  setBrightness: function (brightness, callback) {
    this.log('Homekit Set Brightness', brightness);
    this.device.set_brightness(brightness);
    callback(null);
  }
};