import { Injectable } from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import { Observable } from 'rxjs';
import { SensorReading } from '../../models/sensor-reading.model';

@Injectable({ providedIn: 'root' })
export class SensorReadingService {
  private base = '/api/readings';

  constructor(private http: HttpClient) {}

  getLatest(devEui: string, limit = 10): Observable<SensorReading[]> {
    return this.http.get<SensorReading[]>(
      `${this.base}/latest/${devEui}`,
      { params: new HttpParams().set('limit', limit) }
    );
  }

  getRange(devEui: string, from: string, to: string): Observable<SensorReading[]> {
    return this.http.get<SensorReading[]>(
      `${this.base}/range/${devEui}`,
      { params: new HttpParams().set('from', from).set('to', to) }
    );
  }

  getLast2h(devEui: string): Observable<SensorReading[]> {
    return this.http.get<SensorReading[]>(`${this.base}/last2h/${devEui}`);
  }

  getLast24h(devEui: string): Observable<SensorReading[]> {
    return this.http.get<SensorReading[]>(`${this.base}/last24h/${devEui}`);
  }

  getLastMonth(devEui: string): Observable<SensorReading[]> {
    return this.http.get<SensorReading[]>(`${this.base}/lastMonth/${devEui}`);
  }

  getLastYear(devEui: string): Observable<SensorReading[]> {
    return this.http.get<SensorReading[]>(`${this.base}/lastYear/${devEui}`);
  }
}
