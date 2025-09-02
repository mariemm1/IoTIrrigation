import { Component, Inject, OnDestroy, OnInit, Optional } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { PLATFORM_ID } from '@angular/core';
import { catchError, finalize, forkJoin, map, of, timeout, from } from 'rxjs';

import { AuthService } from '../../services/authService/auth.service';
import { DeviceService } from '../../services/endNodeDeviceService/end-node-device';
import { SensorReadingService } from '../../services/sensorReadingService/sensor-reading';
import { OrganizationService } from '../../services/organizationService/organization';

import { EndNodeDevice } from '../../models/end-node-device.model';
import { SensorReading } from '../../models/sensor-reading.model';
import { DeviceWithLatest, MetricKey } from '../../models/device-with-latest.model';

import { HeaderComponent } from '../header/header.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { DeviceCard } from '../device-card/device-card';
import { InsightsPanel } from '../insights-panel/insights-panel';
import { RangeExplorerDrawer } from '../range-explorer-drawer/range-explorer-drawer';
import { MapDrawer } from '../map-drawer/map-drawer';

import { AddDeviceDrawer, AddBanner } from '../devices/add-device-drawer/add-device-drawer';
import { EditDeviceDrawer } from '../devices/edit-device-drawer/edit-device-drawer';
import { IrrigationDrawer } from '../irrigation-drawer/irrigation-drawer';

type RichDevice = DeviceWithLatest & { description?: string; location?: string; status?: string };

@Component({
  selector: 'app-client-dashboard',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatProgressSpinnerModule,
    HeaderComponent, SidebarComponent, DeviceCard,
    InsightsPanel, RangeExplorerDrawer, MapDrawer,
    AddDeviceDrawer, EditDeviceDrawer, IrrigationDrawer
  ],
  templateUrl: './client-dashboard.html',
  styleUrls: ['./client-dashboard.css']
})
export class ClientDashboard implements OnInit, OnDestroy {
  private readonly FRESH_WINDOW_MS = 2 * 60 * 1000;
  private readonly API_TIMEOUT_MS  = 15000;
  private readonly CACHE_KEY       = 'personnel-dashboard-cache-v4';

  // UI
  loading = false;
  error: string | null = null;

  userName = 'User';
  userId   = '';
  orgName  = '';
  orgId    = '';
  menuOpen = false;

  orgLat: number | null = null;
  orgLng: number | null = null;

  // devices
  devices: RichDevice[] = [];
  search = '';

  // KPIs
  total = 0;
  online = 0;
  offline = 0;
  avgSoil: number | null = null;

  // page-wide selections
  selectedDevEui: string | null = null;
  metric24: MetricKey = 'soilHumidity';

  // Drawers (charts)
  chartOpen = false;
  chartMetric: MetricKey = 'soilHumidity';
  chartDevice?: DeviceWithLatest;

  // Map drawer (top-level)
  mapOpen = false;
  mapFocus?: DeviceWithLatest;

  // Irrigation history drawer
  irrigationOpen = false;
  irrigationDevice?: DeviceWithLatest;

  // Add/Edit
  addOpen = false;
  addBusy = false;
  addStatus: AddBanner = null;

  editOpen = false;
  editDevice: EndNodeDevice | null = null;
  editBusy = false;
  editStatus: { kind: 'success' | 'error'; message: string } | null = null;

  // No commands in this build
  canCommand = false;

  private refreshTimer?: any;

  constructor(
    private auth: AuthService,
    private deviceSvc: DeviceService,
    private readingSvc: SensorReadingService,
    @Optional() private orgSvc: OrganizationService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  // ==== lifecycle ====
  ngOnInit(): void {
    this.userName = this.auth.getUsername?.() || 'User';
    this.userId   = this.auth.getUserIdFromToken?.() || '';
    this.orgId    = this.auth.getOrganizationFromToken?.() || '';
    this.orgName  = this.auth.getOrganizationNameFromToken?.() || this.orgId;

    if (!this.orgId) { this.error = 'Missing organization in token.'; return; }

    this.restoreCache();

    if (this.orgSvc?.getById) {
      this.orgSvc.getById(this.orgId)
        .pipe(catchError(() => of(null)))
        .subscribe((org: any) => {
          if (org?.name) {
            this.orgName = org.name;
            try { localStorage.setItem('orgName', org.name); } catch {}
          }
          this.orgLat = this.toNumOrNull((org as any)?.lat);
          this.orgLng = this.toNumOrNull((org as any)?.lng);
        });
    }

    this.refresh();
    if (isPlatformBrowser(this.platformId)) {
      this.refreshTimer = setInterval(() => this.refresh(), 10 * 60 * 1000);
      document.addEventListener('visibilitychange', this.handleVisibility);
    }
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    if (isPlatformBrowser(this.platformId)) {
      document.removeEventListener('visibilitychange', this.handleVisibility);
    }
  }

  private handleVisibility = () => { if (document.visibilityState === 'visible') this.refresh(); };

  // ==== data ====
  refresh(): void {
    this.error = null;
    this.loading = true;

    this.deviceSvc.getByOrganization(this.orgId)
      .pipe(
        timeout(this.API_TIMEOUT_MS),
        catchError(err => {
          console.error('[Dashboard] getByOrganization failed', err);
          this.error = 'Error loading your devices.';
          return of([] as EndNodeDevice[]);
        }),
        finalize(() => { this.loading = false; })
      )
      .subscribe((devs: EndNodeDevice[]) => {
        if (!devs?.length) {
          this.devices = [];
          this.recomputeKpis();
          this.saveCache();
          return;
        }

        const requests = devs.map(d => {
          const deviceId = (d as any).id ?? (d as any)._id ?? (d as any).deviceId ?? d.devEui;

          const latestReads$ = this.readingSvc.getLatest(d.devEui, 1).pipe(
            timeout(this.API_TIMEOUT_MS),
            catchError(() => of([] as SensorReading[]))
          );

          return forkJoin({ latestReads: latestReads$ }).pipe(
            map(({ latestReads }) => {
              const r = latestReads?.[0];
              const o: any = this.payloadOf(r);

              const soilHumidity = this.getFirstNumeric(o?.analogInput)       ?? this.getFirstNumeric(o?.soilHumidity);
              const luminosity   = this.getFirstNumeric(o?.illuminanceSensor) ?? this.getFirstNumeric(o?.luminosity);
              const humidity     = this.getFirstNumeric(o?.humiditySensor)    ?? this.getFirstNumeric(o?.humidity);
              const barometer    = this.getFirstNumeric(o?.barometer);
              const temperature  = this.getFirstNumeric(o?.temperatureSensor) ?? this.getFirstNumeric(o?.temperature);
              const command      = this.findCommandValue(o);

              const soilHumidityMax = 100;
              const luminosityMax   = 100000;
              const humidityMax     = 100;
              const barometerMax    = 1100;
              const temperatureMax  = 60;

              let latest: DeviceWithLatest['latest'] | undefined;
              if (r) {
                const ts = new Date((r as any).timestamp).getTime();
                const fresh = Number.isFinite(ts) && (Date.now() - ts) <= this.FRESH_WINDOW_MS;
                latest = {
                  timestamp: (r as any).timestamp,
                  soilHumidity: this.toNumOrNull(soilHumidity), soilHumidityMax,
                  luminosity:   this.toNumOrNull(luminosity),   luminosityMax,
                  humidity:     this.toNumOrNull(humidity),     humidityMax,
                  barometer:    this.toNumOrNull(barometer),    barometerMax,
                  temperature:  this.toNumOrNull(temperature),  temperatureMax,
                  command:      this.toNumOrNull(command),
                  fresh
                };
              }

              const devCoords = this.pickCoordsFromDevice(d as any) || this.pickCoordsFromReading(o);
              const lat = devCoords?.lat ?? this.orgLat ?? null;
              const lng = devCoords?.lng ?? this.orgLng ?? null;
              const altitude = this.toNumOrNull((d as any).altitude ?? (o?.gpsLocation?.altitude));

              return {
                id: deviceId,
                devEui: d.devEui,
                name: d.name,
                latest,
                lat, lng, altitude,
                description: d.description,
                location: d.address,
                status: (latest?.fresh ? 'ONLINE' : 'OFFLINE')
              } as RichDevice;
            })
          );
        });

        forkJoin(
          requests.map(r$ => r$.pipe(timeout(this.API_TIMEOUT_MS), catchError(() => of(undefined as unknown as DeviceWithLatest))))
        ).subscribe(list => {
          this.devices = (list.filter(Boolean) as RichDevice[]);
          this.recomputeKpis();
          if (!this.selectedDevEui && this.devices.length) this.selectedDevEui = this.devices[0].devEui;
          this.saveCache();
        });
      });
  }

  // ==== cache + KPIs ====
  private saveCache(): void {
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify({
        ts: Date.now(), orgId: this.orgId, devices: this.devices, selectedDevEui: this.selectedDevEui
      }));
    } catch {}
  }
  private restoreCache(): void {
    try {
      const raw = localStorage.getItem(this.CACHE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || data.orgId !== this.orgId) return;
      this.devices = data.devices || [];
      this.selectedDevEui = data.selectedDevEui || (this.devices[0]?.devEui ?? null);
      this.recomputeKpis();
    } catch {}
  }

  private recomputeKpis(): void {
    this.total = this.devices.length;
    this.online = this.devices.filter(d => d.latest?.fresh).length;
    this.offline = this.total - this.online;

    const soilVals = this.devices
      .map(d => d.latest?.soilHumidity)
      .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
    this.avgSoil = soilVals.length ? Math.round((soilVals.reduce((a,b)=>a+b,0)/soilVals.length) * 10) / 10 : null;
  }

  // ==== header + selectors ====
  onSearchChange(q: string) { this.search = q; }
  toggleMenu() { this.menuOpen = !this.menuOpen; }
  goProfile()  { this.menuOpen = false; }
  logout(): void {
    const orgId   = this.orgId   || this.auth.getOrganizationFromToken?.() || '';
    const orgName = this.orgName || this.auth.getOrganizationNameFromToken?.() || '';

    this.menuOpen = false;
    this.auth.logout?.();
    localStorage.removeItem(this.CACHE_KEY);

    this.router.navigate(['/login', orgId], { state: { orgName }, replaceUrl: true });
  }

  // selected device getter
  get selectedDevice(): RichDevice | null {
    if (!this.selectedDevEui) return this.devices[0] ?? null;
    return this.devices.find(d => d.devEui === this.selectedDevEui) ?? this.devices[0] ?? null;
  }

  // ==== sidebar actions ====
  onSidebarDeviceClick(d: RichDevice) { this.selectedDevEui = d.devEui; }

  onAddDevice() { this.addStatus = null; this.addBusy = false; this.addOpen = true; }

  onEditDevice(d: RichDevice) {
    const id = (d as any).id ?? d.devEui;
    this.editStatus = null; this.editBusy = false; this.editDevice = null;

    this.deviceSvc.getById(id).pipe(catchError(() => of(null as unknown as EndNodeDevice)))
      .subscribe((full: EndNodeDevice | null) => {
        const record: EndNodeDevice = full ?? {
          id,
          devEui: d.devEui,
          name: d.name || '',
          description: d.description || '',
          address: d.location || '',
          organizationId: this.orgId,
          userId: this.userId,
          lat: d.lat ?? null, lng: d.lng ?? null, altitude: d.altitude ?? null,
          createdAt: undefined, updatedAt: undefined, lastSeen: undefined
        };
        record.organizationId = record.organizationId || this.orgId;
        record.userId = record.userId || this.userId;
        this.editDevice = record; this.editOpen = true;
      });
  }

  onDeleteDevice(d: DeviceWithLatest) {
    const ok = window.confirm(`Delete device ${ (d as any).name || d.devEui }?`); if (!ok) return;
    const id = (d as any).id ?? d.devEui;
    (this.deviceSvc as any).delete?.(id)?.pipe(catchError(() => of(null)))
      .subscribe(() => {
        this.devices = this.devices.filter(x => (x as any).id !== id);
        this.recomputeKpis(); this.saveCache();
        window.alert('Device deleted.');
      });
  }

  // ==== add & edit drawer callbacks ====

  onDeviceCreated(payload: EndNodeDevice) {
    if (!payload?.devEui) return;
    this.addBusy = true; this.addStatus = null;

    this.deviceSvc.create({
      ...payload,
      organizationId: this.orgId,
      userId: this.userId
    }).pipe(
      timeout(this.API_TIMEOUT_MS),
      catchError((err: any) => {
        const status = err?.status;
        if (status === 404) {
          this.addStatus = { kind: 'error', message: 'Device not found in ChirpStack.' };
        } else if (status === 409) {
          this.addStatus = { kind: 'error', message: 'Device already exists in database.' };
        } else {
          this.addStatus = { kind: 'error', message: 'Failed to add device.' };
        }
        return of(null);
      }),
      finalize(() => { this.addBusy = false; })
    ).subscribe(res => {
      if (res) {
        this.addStatus = { kind: 'success', message: 'Device added.' };
        this.addOpen = false;
        this.refresh();
      }
    });
  }

  /** EDIT: backend pushes to ChirpStack; 502 => “not in sync” banner */
  onDeviceSaved(payload: EndNodeDevice) {
    if (!payload?.id) return;
    this.editBusy = true; this.editStatus = null;

    // Only the fields the user can actually edit
    const patch: Partial<EndNodeDevice> = {
      name: payload.name?.trim() || '',
      description: payload.description?.trim() || undefined,
      address: payload.address ?? undefined,
      // include coords only if you allow editing them in the UI
      lat: payload.lat ?? undefined,
      lng: payload.lng ?? undefined,
      altitude: payload.altitude ?? undefined,
    };

    this.deviceSvc.update(payload.id, patch).pipe(
      timeout(this.API_TIMEOUT_MS),
      catchError((err: any) => {
        const status = err?.status;
        if (status === 502) {
          this.editStatus = { kind: 'error', message: 'Failed to sync with ChirpStack.' };
        } else if (status === 400 || status === 404) {
          // show backend message like “userId is immutable.”
          this.editStatus = { kind: 'error', message: (err?.error || 'Failed to save device.') };
        } else {
          this.editStatus = { kind: 'error', message: 'Failed to save device.' };
        }
        return of(null);
      }),
      finalize(() => { this.editBusy = false; })
    ).subscribe(res => {
      if (res) {
        this.editStatus = { kind: 'success', message: 'Device saved.' };
        this.editOpen = false;
        this.refresh();
      }
    });
  }


  // ==== chart + map + irrigation drawers ====
  openChart(device: DeviceWithLatest, metric: MetricKey) { this.chartDevice = device; this.chartMetric = metric; this.chartOpen = true; }
  closeChart() { this.chartOpen = false; }

  openMap(d?: DeviceWithLatest) { this.mapFocus = d; this.mapOpen = true; }
  closeMap() { this.mapOpen = false; }

  openIrrigationFor(d: DeviceWithLatest) { this.irrigationDevice = d; this.irrigationOpen = true; }
  closeIrrigation() { this.irrigationOpen = false; }

  // ==== ChirpStack helpers (HTTP via proxy) ====
  private getAuthHeader(): Record<string,string> {
    const token =
      (this.auth as any)?.getToken?.() ||
      (this.auth as any)?.getAccessToken?.() ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : '') ||
      '';
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /** Check if device exists in ChirpStack (try a couple of common endpoints). */
  private async chirpExists(devEui: string): Promise<boolean> {
    const headers: any = this.getAuthHeader();
    const attempts: Array<{ url: string; method?: string }> = [
      { url: `/api/chirpstack/devices/${encodeURIComponent(devEui)}`, method: 'GET' },
      { url: `/api/chirpstack/exists/${encodeURIComponent(devEui)}`, method: 'GET' }
    ];
    for (const a of attempts) {
      try {
        const res = await fetch(a.url, { method: a.method || 'GET', headers });
        if (res.ok) return true;
        // handle JSON `{ exists: true }`
        if (res.headers.get('content-type')?.includes('application/json')) {
          const j: any = await res.json().catch(() => ({}));
          if (j?.exists === true) return true;
        }
      } catch {}
    }
    return false;
  }

  /** Update/rename device on ChirpStack; returns true if any attempt succeeds. */
  private async chirpUpdateName(devEui: string, name: string): Promise<boolean> {
    const headers: any = { 'Content-Type': 'application/json', ...this.getAuthHeader() };
    const body = JSON.stringify({ name });
    const attempts: Array<{ url: string; method: string; body?: any }> = [
      { url: `/api/chirpstack/devices/${encodeURIComponent(devEui)}`, method: 'PATCH', body },
      { url: `/api/chirpstack/devices/${encodeURIComponent(devEui)}`, method: 'PUT',   body },
      { url: `/api/chirpstack/devices/${encodeURIComponent(devEui)}/rename`, method: 'POST', body },
      { url: `/api/chirpstack/sync/${encodeURIComponent(devEui)}`, method: 'POST', body: JSON.stringify({ name }) }
    ];
    for (const a of attempts) {
      try {
        const res = await fetch(a.url, { method: a.method, headers, body: a.body ?? body });
        if (res.ok) return true;
      } catch {}
    }
    return false;
  }

  // ==== helpers (payload parsing etc.) ====
  private parseMaybeJson(v: any): any {
    if (v == null) return null;
    if (typeof v === 'string') { try { return JSON.parse(v); } catch { return null; } }
    return (typeof v === 'object') ? v : null;
  }
  private looksLikePayload(o: any): boolean {
    if (!o || typeof o !== 'object') return false;
    const keys = ['humiditySensor','temperatureSensor','analogInput','illuminanceSensor','barometer','digitalOutput','gpsLocation'];
    return keys.some(k => Object.prototype.hasOwnProperty.call(o, k));
  }
  private payloadOf(r: any): any {
    if (!r || typeof r !== 'object') return {};
    const directKeys = ['sensorsReading','object_json','objectJson','object','payload','data','dataJson'];
    for (const k of directKeys) {
      if (r[k] !== undefined) {
        const parsed = this.parseMaybeJson(r[k]) ?? r[k];
        if (parsed && this.looksLikePayload(parsed)) return parsed;
      }
    }
    const deepSearch = (node: any): any => {
      if (!node || typeof node !== 'object') return null;
      if (this.looksLikePayload(node)) return node;
      for (const v of Object.values(node)) {
        const pv = this.parseMaybeJson(v) ?? v;
        const found = deepSearch(pv);
        if (found) return found;
      }
      return null;
    };
    return deepSearch(r) || {};
  }
  private toNumOrNull(v: unknown): number | null {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const n = Number(v as any);
    return Number.isFinite(n) ? n : null;
  }
  private getFirstNumeric(mapLike: any): number | null {
    if (mapLike == null) return null;
    if (typeof mapLike === 'number' || typeof mapLike === 'string') {
      const n = Number(mapLike); return Number.isFinite(n) ? n : null;
    }
    if (typeof mapLike !== 'object') return null;
    if ('value' in mapLike) {
      const n = Number((mapLike as any).value);
      if (Number.isFinite(n)) return n;
    }
    let out: number | null = null;
    for (const [, v] of Object.entries(mapLike as Record<string, any>)) {
      if (v && typeof v === 'object') {
        if ('value' in v) {
          const n = Number((v as any).value);
          if (Number.isFinite(n)) out = n;
        } else {
          for (const vv of Object.values(v)) {
            const n = Number(vv as any);
            if (Number.isFinite(n)) out = n;
          }
        }
      } else {
        const n = Number(v as any);
        if (Number.isFinite(n)) out = n;
      }
    }
    return out;
  }
  private findCommandValue(o: any): number | null {
    if (!o || typeof o !== 'object') return null;
    const norm = (x: any): number | null => {
      const n = Number(x); if (Number.isFinite(n)) return n >= 0.5 ? 1 : 0;
      const s = String(x).trim().toUpperCase();
      if (['1','ON','OPEN','TRUE'].includes(s))  return 1;
      if (['0','OFF','CLOSE','FALSE'].includes(s)) return 0;
      return null;
    };
    const keys = ['digitalInput','digital_input','relay','relayState','valve','valveState','input','actuator','pump','command','cmd'];
    for (const k of keys) {
      const v = (o as any)[k];
      if (v === undefined) continue;
      const d = norm(v); if (d !== null) return d;
      if (v && typeof v === 'object') {
        if ('value' in v) { const nv = norm((v as any).value); if (nv !== null) return nv; }
        for (const vv of Object.values(v)) { const nv = norm(vv); if (nv !== null) return nv; }
      }
    }
    for (const fb of [o?.analogOutput, o?.digitalInput, o?.digital_input]) {
      if (!fb) continue;
      if (typeof fb === 'object' && 'value' in fb) { const nv = norm((fb as any).value); if (nv !== null) return nv; }
      if (typeof fb === 'object') { for (const vv of Object.values(fb)) { const nv = norm(vv); if (nv !== null) return nv; } }
      else { const nv = norm(fb); if (nv !== null) return nv; }
    }
    return null;
  }
  private pickCoordsFromDevice(d: any): { lat: number; lng: number } | null {
    if (!d) return null;
    const lat = this.toNumOrNull(d.lat);
    const lng = this.toNumOrNull(d.lng);
    if (lat != null && lng != null) return { lat, lng };
    return null;
  }
  private pickCoordsFromReading(o: any): { lat: number; lng: number } | null {
    if (!o || typeof o !== 'object') return null;
    const gps = o?.gpsLocation ?? o?.gps ?? o?.location;
    const tryGps = (g: any): {lat:number,lng:number}|null => {
      if (!g || typeof g !== 'object') return null;
      const lat = this.toNumOrNull(g.latitude ?? g.lat);
      const lng = this.toNumOrNull(g.longitude ?? g.lng ?? g.lon ?? g.long);
      return (lat != null && lng != null) ? { lat, lng } : null;
    };
    const direct = tryGps(gps);
    if (direct) return direct;
    if (gps && typeof gps === 'object') {
      for (const v of Object.values(gps)) {
        const nested = tryGps(v);
        if (nested) return nested;
      }
    }
    for (const v of Object.values(o)) {
      const nested = tryGps(v);
      if (nested) return nested;
    }
    return null;
  }
}
