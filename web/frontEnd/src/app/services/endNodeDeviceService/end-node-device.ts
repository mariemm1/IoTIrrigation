// src/app/services/endNodeDeviceService/end-node-device.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { EndNodeDevice } from '../../models/end-node-device.model';

@Injectable({ providedIn: 'root' })
export class DeviceService {
  private base = '/api/devices';

  constructor(private http: HttpClient) {}

  /** Lowercase hex, strip separators — matches backend normalization */
  private normEui(eui: string): string {
    return (eui || '').replace(/[^0-9a-fA-F]/g, '').toLowerCase();
  }

  getAll(): Observable<EndNodeDevice[]> {
    return this.http.get<EndNodeDevice[]>(`${this.base}/all`);
  }

  getById(id: string): Observable<EndNodeDevice> {
    return this.http.get<EndNodeDevice>(`${this.base}/${id}`);
  }

  /** Backend returns ChirpStack “peek” (404 if not found there) */
  getByDevEui(devEui: string): Observable<EndNodeDevice> {
    const eui = this.normEui(devEui);
    return this.http.get<EndNodeDevice>(`${this.base}/eui/${eui}`);
  }

  getByCreatedBy(userId: string): Observable<EndNodeDevice[]> {
    return this.http.get<EndNodeDevice[]>(`${this.base}/CreatedBy/${userId}`);
  }

  getByOrganization(orgId: string): Observable<EndNodeDevice[]> {
    return this.http.get<EndNodeDevice[]>(`${this.base}/organization/${orgId}`);
  }

  /** Create: backend checks DB dup & ChirpStack existence */
  create(device: EndNodeDevice): Observable<EndNodeDevice> {
    const body: EndNodeDevice = { ...device, devEui: this.normEui(device.devEui) };
    return this.http.post<EndNodeDevice>(`${this.base}/create`, body);
  }

  /** Edit: backend syncs to ChirpStack first, then persists */
  // src/app/services/endNodeDeviceService/end-node-device.ts
  update(id: string, device: Partial<EndNodeDevice>): Observable<EndNodeDevice> {
    // Strip fields the backend treats as immutable
    const { devEui, organizationId, userId, ...allowed } = device || {};
    return this.http.put<EndNodeDevice>(`${this.base}/update/${id}`, allowed);
  }


  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/delete/${id}`);
  }



  sendCommand(devEui: string, action: 'OPEN'|'CLOSE') {
    const eui = this.normEui(devEui);
    const value = action === 'OPEN' ? 1 : 0;
    // we also send fPort explicitly (2)
    return this.http.post(`/api/commands/${encodeURIComponent(eui)}`, {
      devEui: eui,
      action,
      value,
      fPort: 2
    });
  }
}
