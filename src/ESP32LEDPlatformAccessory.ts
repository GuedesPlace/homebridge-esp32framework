import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { GPESP32Platform } from './platform';
import { ESP32DeviceStatusInformation } from './models/deviceStatus';
import { ColorPayload } from './models/ColorPayload';
import fetch from 'node-fetch';
import convert from 'color-convert';
import colorTemperature from 'color-temperature';
import { LEDStatus } from './models/LEDStatus';
import { debounceTime, Subject } from 'rxjs';

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
  private state: LEDStatus = { hue: 0, saturation: 0 };
  private stateSubject: Subject<LEDStatus> = new Subject();

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

    this.service.getCharacteristic(this.platform.Characteristic.Hue).onSet(this.setHue.bind(this));
    this.service.getCharacteristic(this.platform.Characteristic.ColorTemperature).onSet(this.setColorTemperature.bind(this));
    this.service.getCharacteristic(this.platform.Characteristic.Saturation).onSet(this.setSaturation.bind(this));

    //Handling SAT/HUE Change as one call by using debounce by 100ms
    this.stateSubject.pipe(debounceTime(100)).subscribe(async res => {
      const rgb = convert.hsv.rgb(res.hue, res.saturation, 100);
      const payload = await this.getCurrentColorPayload();
      payload.red = rgb[0];
      payload.green = rgb[1];
      payload.blue = rgb[2];
      this.platform.log.info(JSON.stringify(payload));
      await this.applyColorPayload(payload);
    });
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

  async getBrightness(): Promise<CharacteristicValue> {
    const payload = await this.getCurrentColorPayload();
    this.platform.log.debug('Get Characteristic Brightnesss ESP ->', payload.brightness);
    return payload.brightness;
  }


  async setHue(value: CharacteristicValue) {
    this.state.hue = value as number;
    this.platform.log.debug('Set Characteristic Hue -> ', value);
    this.stateSubject.next({ ...this.state });
  }

  async setSaturation(value: CharacteristicValue) {
    this.state.saturation = value as number;
    this.platform.log.debug('Set Characteristic SAT -> ', value);
    this.stateSubject.next({ ...this.state });
  }

  getUID(): string {
    return this.accessory.UUID;
  }

  checkForUpdate(deviceStatus: ESP32DeviceStatusInformation) {
    if (deviceStatus.publicName !== this.accessory.context.publicName) {
      this.accessory.context.publicName = deviceStatus.publicName;
      this.service.setCharacteristic(this.platform.Characteristic.Name, deviceStatus.publicName);
    }
    if (this.accessory.context.status !== 'up') {
      this.accessory.context.status = 'up';
    }
    this.accessory.context.lastUpdate = new Date().toISOString();
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

  private async setColorTemperature(value: CharacteristicValue) {
    this.state.saturation = value as number;
    this.platform.log.debug('Set Characteristic ColorTemperature -> ', value);
    const rgb = colorTemperature.colorTemperature2rgb(value);
    const payload = await this.getCurrentColorPayload();
    payload.red = rgb.red;
    payload.green = rgb.green;
    payload.blue = rgb.blue;
    await this.applyColorPayload(payload);
  }

}