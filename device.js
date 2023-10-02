const Bluez = require("bluez");

const bluetooth = new Bluez();

class BluezAgent extends Bluez.Agent {
  constructor(bluez, DbusObject, pin) {
    super(bluez, DbusObject);
    this.pin = pin;
  }

  Release(callback) {
    console.log("Agent Disconnected");
    callback();
  }
}

bluetooth.init().then(async () => {
  // Register Agent that accepts everything and uses key 1234
  // TODO needed for this light?
  await bluetooth.registerAgent(
    new BluezAgent(bluetooth, bluetooth.getUserServiceObject(), "1234"),
    "KeyboardOnly"
  );
  console.log("Agent registered, starting discovery");

  // listen on first bluetooth adapter
  const adapter = await bluetooth.getAdapter();
  adapter.StartDiscovery();
  // TODO do we ever stop it?
});

const debounce = (callback, wait) => {
  let timeoutId = null;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      callback.apply(null, args);
    }, wait);
  };
};

module.exports = class Device {
  constructor(deviceAddress) {
    this.deviceAddress = deviceAddress;

    this.power = false;
    this.brightness = 100;
    this.discovered = false;
    this.updateGattCharacteristicsDebounced = debounce(() => {
      this.updateGattCharacteristics();
    }, 300);

    bluetooth.on("device", async (address, props) => {
      if (this.deviceAddress !== address) {
        return;
      }
      console.log(`Discovered device ${address}`, props);
      this.discovered = true;
      const { onOffCharacteristic, brightnessCharacteristic } =
        await this.getCharacteristics();
      console.log("got intial values");
      const onOffValue = await onOffCharacteristic.ReadValue();
      this.power = Uint8Array.from(onOffValue)[0] === 1;
      const brightnessValue = await onOffCharacteristic.ReadValue();
      this.brightness = Math.round(
        (Uint8Array.from(brightnessValue)[0] / 255) * 100
      );
    });
  }

  async getCharacteristics() {
    if (!this.discovered) {
      throw new Error("never discovered");
    }
    console.log("connect");
    const device = await bluetooth.getDevice(this.deviceAddress);
    console.log(`Got device ${this.deviceAddress}`);
    const connected = false; // await device.Connected();
    console.log("connect is connected?", connected);
    if (!connected) {
      console.log("connecting");
      await device.Connect();
      console.log("Connected");
      if (!(await device.Paired())) {
        console.log("Pairing");
        await device.Pair();
      }
      console.log("Paired");
    }
    console.log("getting service");
    const service = await device.getService(
      "932c32bd-0000-47a2-835a-a8d455b859dd"
    );
    if (!service) {
      throw new Error("No Service");
    }
    const onOffCharacteristic = await service.getCharacteristic(
      "932c32bd-0002-47a2-835a-a8d455b859dd"
    );
    const brightnessCharacteristic = await service.getCharacteristic(
      "932c32bd-0003-47a2-835a-a8d455b859dd"
    );
    return { onOffCharacteristic, brightnessCharacteristic };
  }

  async updateGattCharacteristics() {
    console.log("updateGattCharacteristics");
    const { onOffCharacteristic, brightnessCharacteristic } =
      await this.getCharacteristics();
    await onOffCharacteristic.WriteValue([this.power ? 1 : 0]);
    if (this.brightness > 0) {
      await brightnessCharacteristic.WriteValue([
        Math.round((this.brightness / 100) * 254),
      ]);
    }
  }

  async set_power(status) {
    console.log("set_power");
    this.power = status;
    this.updateGattCharacteristicsDebounced();
  }

  async set_brightness(level) {
    console.log("set_brightness");
    this.brightness = level;
    this.updateGattCharacteristicsDebounced();
  }
};
