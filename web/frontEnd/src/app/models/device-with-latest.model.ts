export type MetricKey = 'soilHumidity' | 'luminosity' | 'humidity' | 'barometer' | 'temperature';

export interface DeviceWithLatest {
  id: string;
  devEui: string;
  name?: string;
  lat?: number | null;
  lng?: number | null;
  altitude?: number | null;
  latest?: {
    timestamp: string;
    soilHumidity: number | null; soilHumidityMax :number | null;
    luminosity: number | null; luminosityMax :number | null;
    humidity: number | null;   humidityMax: number | null;
    barometer: number | null;  barometerMax: number | null;
    temperature: number | null; temperatureMax: number | null;
    command: number | null;

    fresh: boolean;
  };
}
