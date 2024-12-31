import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import dgram from 'dgram';
import { ESP32LEDPlatformAccessory } from './ESP32LEDPlatformAccessory.js';
import { ESP32DeviceStatusInformation } from './models/deviceStatus.js';

export class GPESP32Platform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;
  private udpListner: dgram.Socket | undefined;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];
  public readonly connectedLEDS: ESP32LEDPlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = this.api.hap.Service;
    this.Characteristic = this.api.hap.Characteristic;
    this.log.debug('Finished initializing platform:', this.config.name);

    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });
    this.api.on('shutdown', ()=>{
      if (this.udpListner) {
        this.udpListner.close();
      }
    });
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

  discoverDevices() {

    this.udpListner = dgram.createSocket('udp4');
    this.udpListner.on('message', (msg, rinfo) => {
      this.log.info(`Found: ${rinfo.address}`);
      const deviceStatus: ESP32DeviceStatusInformation = JSON.parse(msg + '');
      this.log.info(`MAC: ${deviceStatus.mac}`);
      const uuid = this.api.hap.uuid.generate(deviceStatus.mac);
      this.log.info('UUUUID=>' + uuid);
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
      if (!existingAccessory) {
        const accessory = new this.api.platformAccessory<ESP32DeviceStatusInformation>(deviceStatus.publicName, uuid);
        accessory.context = deviceStatus;
        const esp32LEDPlatformAccessory = new ESP32LEDPlatformAccessory(this, accessory, rinfo.address);
        this.connectedLEDS.push(esp32LEDPlatformAccessory);
        this.log.info('Register as new Device');
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.accessories.push(accessory);
      } else {
        const findConnected = this.connectedLEDS.find(accessory => accessory.getUID() === uuid);
        if (findConnected) {
          findConnected.checkForUpdate(deviceStatus);
        } else {
          this.log.info('Activate device');
          existingAccessory.context = deviceStatus;
          const esp32LEDPlatformAccessory = new ESP32LEDPlatformAccessory(this, existingAccessory as PlatformAccessory<ESP32DeviceStatusInformation>, rinfo.address);
          this.connectedLEDS.push(esp32LEDPlatformAccessory);
        }
      }

    });
    this.udpListner.bind(8266);
  }
}
