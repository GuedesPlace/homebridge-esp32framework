import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { GPESP32Platform } from './platform';
import { ESP32DeviceStatusInformation } from './models/deviceStatus';
import { ColorPayload } from './models/ColorPayload';
import fetch from 'node-fetch';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class ESP32LEDPlatformAccessory {
  private service: Service;
  private currentPayload: ColorPayload | undefined;
  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private exampleStates = {
    On: false,
    Brightness: 100,
    Hue: 0,
  };

  constructor(
    private readonly platform: GPESP32Platform,
    private readonly accessory: PlatformAccessory<ESP32DeviceStatusInformation>,
    private ipAddress: string,
  ) {

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'GuedesPlace Ideas & Innovation')
      .setCharacteristic(this.platform.Characteristic.Model, 'ESP32LED')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.mac);

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.Lightbulb) || this.accessory.addService(this.platform.Service.Lightbulb);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.publicName);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    // register handlers for the On/Off Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this))                // SET - bind to the `setOn` method below
      .onGet(this.getOn.bind(this));               // GET - bind to the `getOn` method below

    // register handlers for the Brightness Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.Brightness)
      .onSet(this.setBrightness.bind(this))
      .onGet(this.getBrightness.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.Hue).onSet((value) => this.setHue(value));
    this.service.getCharacteristic(this.platform.Characteristic.ColorTemperature).onSet((value) => console.log('CT: ' + value));
    this.service.getCharacteristic(this.platform.Characteristic.Saturation).onSet((value) => console.log('SAT: ' + value));
  }

  async setOn(value: CharacteristicValue) {
    const newValue = value as boolean;
    const payload = await this.getCurrentColorPayload();
    this.platform.log.debug('Set Characteristic On ->', newValue);
    payload.poweron = newValue;
    await this.applyColorPayload(payload);
  }

  async getOn(): Promise<CharacteristicValue> {
    const payload = await this.getCurrentColorPayload();
    this.platform.log.debug('Get Characteristic On ESP ->', payload.poweron);
    return payload.poweron;
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, changing the Brightness
   */
  async setBrightness(value: CharacteristicValue) {
    const newValue = value as number;
    const payload = await this.getCurrentColorPayload();
    this.platform.log.debug('Set Characteristic Brightness -> ', value);
    payload.brightness = newValue;
    await this.applyColorPayload(payload);

  }

  async getBrightness():Promise<CharacteristicValue> {
    const payload = await this.getCurrentColorPayload();
    this.platform.log.debug('Get Characteristic Brightnesss ESP ->', payload.brightness);
    return payload.brightness;
  }


  async setHue(value: CharacteristicValue) {
    this.exampleStates.Hue = value as number;

    this.platform.log.debug('Set Characteristic Hue -> ', value);
  }

  getUID(): string {
    return this.accessory.UUID;
  }

  checkForUpdate(deviceStatus: ESP32DeviceStatusInformation) {
    //TODO:sos
  }

  private async getCurrentColorPayload(): Promise<ColorPayload> {
    if (this.currentPayload) {
      return { ...this.currentPayload };
    }
    const url = `http://${this.ipAddress}/api/led`;
    this.platform.log.info('Calling....' + url);
    const response = await fetch(url);
    const data = await response.json() as ColorPayload;
    this.currentPayload = data;
    return { ...this.currentPayload };
  }

  private async applyColorPayload(payload: ColorPayload): Promise<ColorPayload> {
    const url = `http://${this.ipAddress}/api/led`;
    const response = await fetch(url, {
      method: 'put',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json() as ColorPayload;
    this.currentPayload = data;
    return { ...this.currentPayload };
  }
}