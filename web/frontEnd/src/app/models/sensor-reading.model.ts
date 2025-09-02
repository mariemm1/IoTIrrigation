export interface SensorReading {
  id?: string;
  applicationId: string;
  devEui: string;
  fPort: number;
  data: string;
  rxInfo: string;         // raw JSON
  objectJson: {
    humiditySensor:    Record<string, number>;
    barometer:         Record<string, number>;
    temperatureSensor: Record<string, number>;
    analogInput: Record<string, number>;
    illuminanceSensor: Record<string, number>;
    digitalOutput : Record<string, number>;
    gpsLocation: Record<string, number>;
    [key: string]: any;
  };

  timestamp:    string;

}
