const Bluez = require("bluez");

const bluetooth = new Bluez();

const Characteristics = Object.freeze({
  OnOff: Symbol("OnOff"),
  Brightness: Symbol("Brightness"),
  Color: Symbol("Color"),
});

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

module.exports = class Device {
  constructor(deviceAddress) {
    this.deviceAddress = deviceAddress;

    this.power = false;
    this.brightness = 100;
    this.hue = 0;
    this.saturation = 0;
    this.l = 0.5;
    this.connectionPromise = null;

    bluetooth.on("device", async (address, props) => {
      if (this.deviceAddress !== address) {
        return;
      }
      this.connected = props.Connected;
      console.log(`Found device ${address}, connected = ${props.Connected}`);
      const onOffCharacteristic = await this.connectAndGetWriteCharacteristics(
        Characteristics.OnOff
      );
      const onOffValue = await onOffCharacteristic.ReadValue();
      this.power = Uint8Array.from(onOffValue)[0] === 1;

      const brightnessCharacteristic =
        await this.connectAndGetWriteCharacteristics(
          Characteristics.Brightness
        );
      const brightnessValue = await onOffCharacteristic.ReadValue();
      this.brightness = Math.round(
        (Uint8Array.from(brightnessValue)[0] / 255) * 100
      );
    });
  }

  async connectAndGetWriteCharacteristics(characteristic) {
    console.log("connect")
    const device = await bluetooth.getDevice(this.deviceAddress);
    const connected = await device.Connected();
    console.log("connect is connected?", connected)
    if (!connected) {
      console.log("connect is in promise?", this.connectionPromise !== null)
      if (this.connectionPromise) {
        await this.connectionPromise;
      } else {
        this.connectionPromise = new Promise(async (resolve) => {
          console.log(`Got device ${this.deviceAddress}`);
          // TODO reconnect in a cycle
          await device.Connect();

          console.log("Connected");
          if (!(await device.Paired())) {
            console.log("Pairing");
            await device.Pair();
          }
          console.log("Paired");
          this.connectionPromise = null;
        });
        await this.connectionPromise;
      }
    }

    // get the Service
    const service = await device.getService(
      "932c32bd-0000-47a2-835a-a8d455b859dd"
    );
    if (!service) {
      throw new Error("No Service");
    }
    if (characteristic === Characteristics.OnOff) {
      return await service.getCharacteristic(
        "932c32bd-0002-47a2-835a-a8d455b859dd"
      );
    }
    if (characteristic === Characteristics.Brightness) {
      return await service.getCharacteristic(
        "932c32bd-0003-47a2-835a-a8d455b859dd"
      );
    }
    if (characteristic === Characteristics.Color) {
      return await service.getCharacteristic(
        "932c32bd-0005-47a2-835a-a8d455b859dd"
      );
    }
  }

  async set_power(status) {
    this.power = status;
    const onOffCharacteristic = await this.connectAndGetWriteCharacteristics(
      Characteristics.OnOff
    );
    await onOffCharacteristic.WriteValue([status ? 1 : 0]);
  }

  async set_brightness(level) {
    this.brightness = level;
    if (level > 0) {
      const brightnessCharacteristic =
        await this.connectAndGetWriteCharacteristics(
          Characteristics.Brightness
        );
      await brightnessCharacteristic.WriteValue([
        Math.round((level / 100) * 254),
      ]);
    }
  }

  async set_rgb(r, g, b) {
    const colorCharacteristic = await this.connectAndGetWriteCharacteristics(
      Characteristics.Color
    );
    await colorCharacteristic.WriteValue(convert_rgb(r, g, b));
  }

  async set_hue(hue) {
    this.hue = hue;
    const rgb = hslToRgb(hue / 360, this.saturation / 100, this.l);
    this.set_rgb(rgb[0], rgb[1], rgb[2]);
  }

  async set_saturation(saturation) {
    this.saturation = saturation;
    // const rgb = hslToRgb(this.hue / 360, saturation / 100, this.l);
    // this.set_rgb(rgb[0], rgb[1], rgb[2]);
  }
};

function convert_rgb(red, green, blue) {
  const scale = 0xff;
  const adjusted = [Math.max(1, red), Math.max(1, green), Math.max(1, blue)];
  total = adjusted[0] + adjusted[1] + adjusted[2];
  return [
    0x1,
    Math.round((adjusted[0] / total) * scale),
    Math.round((adjusted[2] / total) * scale),
    Math.round((adjusted[1] / total) * scale),
  ];
}

function hslToRgb(h, s, l) {
  var r, g, b;

  if (s == 0) {
    r = g = b = l; // achromatic
  } else {
    var hue2rgb = function hue2rgb(p, q, t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
