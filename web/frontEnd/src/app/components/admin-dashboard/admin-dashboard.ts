import { Component, Inject, OnDestroy, OnInit, Optional } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { PLATFORM_ID } from '@angular/core';
import { catchError, finalize, forkJoin, map, of, switchMap, timeout } from 'rxjs';

import { AuthService } from '../../services/authService/auth.service';
import { DeviceService } from '../../services/endNodeDeviceService/end-node-device';
import { SensorReadingService } from '../../services/sensorReadingService/sensor-reading';
import { OrganizationService } from '../../services/organizationService/organization';
import { UserService } from '../../services/userService/user';

import { EndNodeDevice } from '../../models/end-node-device.model';
import { Organization } from '../../models/organization.model';
import { SensorReading } from '../../models/sensor-reading.model';
import { DeviceWithLatest, MetricKey } from '../../models/device-with-latest.model';
import { User } from '../../models/user.model';

import { HeaderComponent } from '../header/header.component';
import { DeviceCard } from '../device-card/device-card';
import { InsightsPanel } from '../insights-panel/insights-panel';
import { RangeExplorerDrawer } from '../range-explorer-drawer/range-explorer-drawer';
import { MapDrawer } from '../map-drawer/map-drawer';
import { AddDeviceDrawer, AddBanner } from '../devices/add-device-drawer/add-device-drawer';
import { EditDeviceDrawer } from '../devices/edit-device-drawer/edit-device-drawer';
import { DevicesList } from '../devices/devices-list/devices-list';
import { AdminNavComponent } from '../admin-nav/admin-nav.component';
import { OrgListComponent } from '../organizations/org-list/org-list';
import { OrgAddComponent } from '../organizations/org-add/org-add';
import { UserListComponent } from '../users/user-list/user-list';
import { UserAddComponent } from '../users/user-add/user-add';
import { IrrigationDrawer } from '../irrigation-drawer/irrigation-drawer';

type RichDevice = DeviceWithLatest & {
  description?: string;
  location?: string;
  status?: string;
  organizationId?: string;
  userId?: string;
  lat?: number | null;
  lng?: number | null;
  altitude?: number | null;
};

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatProgressSpinnerModule,
    HeaderComponent, DeviceCard, InsightsPanel,
    RangeExplorerDrawer, MapDrawer, AddDeviceDrawer, EditDeviceDrawer,
    DevicesList, AdminNavComponent,
    OrgListComponent, OrgAddComponent, UserListComponent, UserAddComponent,
    IrrigationDrawer
  ],
  templateUrl: './admin-dashboard.html',
  styleUrls: ['./admin-dashboard.css']
})
export class AdminDashboard implements OnInit, OnDestroy {
  private readonly FRESH_WINDOW_MS = 2 * 60 * 1000;
  private readonly API_TIMEOUT_MS  = 15000;

  loading=false; error:string|null=null;

  userName='Admin';
  userId='';

  /** Header shows the connected org name (e.g., CERT-MAIN) and never changes */
  headerOrgName='CERT-MAIN';
  orgId=''; // connected org id (from token)

  // === header menu state used by <app-header> ===
  menuOpen = false;
  toggleMenu(){ this.menuOpen = !this.menuOpen; }
  goProfile(){ this.openProfile(); }

  organizations: Organization[] = [];
  users: User[] = [];
  orgUsersMap: Record<string, User[]> = {};

  /** coords per org */
  orgCoords: Record<string, {lat: number|null; lng: number|null}> = {};

  /** devices grouped by org */
  orgDevices: Record<string, RichDevice[]> = {};
  allDevices: RichDevice[] = [];

  /** page scope */
  selectedOrgId: string | null = null;
  selectedDevEui: string | null = null;

  /** KPIs (selected org only) */
  total=0; online=0; offline=0;

  metric24: MetricKey = 'soilHumidity';
  chartOpen=false; chartMetric: MetricKey = 'soilHumidity'; chartDevice?: DeviceWithLatest;
  mapOpen=false; mapFocus?: DeviceWithLatest;

  // irrigation drawer state
  irrigationOpen=false; irrigationDevice?: DeviceWithLatest;

  // Device drawers
  addOpen=false; addBusy=false; addStatus: AddBanner=null; addOrgId: string | null = null;
  addOwnerId: string | null = null;
  editOpen=false; editDevice: EndNodeDevice | null = null; editBusy=false;
  editStatus: {kind:'success'|'error';message:string}|null=null;

  // right sliding panels
  panel: null | 'orgs' | 'users' | 'devices' = null;

  // quick drawers
  addOrgOpen=false;
  addUserOpen=false; addUserRole:'ADMIN'|'CLIENT'='CLIENT';

  // removed timers/listeners for snappy UX (manual refresh only)
  private spinnerFailsafe?: any;

  constructor(
    private auth: AuthService,
    private deviceSvc: DeviceService,
    private readingSvc: SensorReadingService,
    @Optional() private orgSvc: OrganizationService,
    private userSvc: UserService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    this.userName = this.auth.getUsername?.() || 'Admin';
    this.userId   = this.auth.getUserIdFromToken?.() || '';
    this.orgId    = this.auth.getOrganizationFromToken?.() || '';
    this.headerOrgName  = this.auth.getOrganizationNameFromToken?.() || 'CERT-MAIN';

    // Load once; keep data in memory. Users can press Refresh in the header if they want a full re-sync.
    this.refresh();
  }

  ngOnDestroy(): void {
    if (this.spinnerFailsafe) clearTimeout(this.spinnerFailsafe);
  }

  /** === data bootstrap (only when pressing the header Refresh, or first load) === */
  refresh(): void {
    this.error=null; this.loading=true;
    if (this.spinnerFailsafe) clearTimeout(this.spinnerFailsafe);
    this.spinnerFailsafe = setTimeout(()=> this.loading=false, 6000);

    this.orgSvc.getAll().pipe(
      timeout(this.API_TIMEOUT_MS),
      catchError(()=>of([] as Organization[])),
      map((orgs)=>{
        this.organizations = orgs||[];
        this.orgCoords = {};
        for (const o of this.organizations) {
          const lat = this.toNumOrNull((o as any).lat);
          const lng = this.toNumOrNull((o as any).lng);
          this.orgCoords[o.id!] = {lat: lat ?? null, lng: lng ?? null};
        }

        const cert = this.organizations.find(o=>o.name?.toUpperCase()==='CERT-MAIN');
        if (!this.selectedOrgId) {
          this.selectedOrgId =
            cert?.id ||
            this.organizations.find(o=>o.id===this.orgId)?.id ||
            this.organizations[0]?.id || null;
        }
        return orgs;
      }),
      switchMap(()=> this.userSvc.getAll().pipe(timeout(this.API_TIMEOUT_MS), catchError(()=>of([] as User[])))),
      switchMap((users: User[])=>{
        this.users = users || [];
        this.orgUsersMap = {};
        for (const u of this.users) {
          const k = u.organizationId || '';
          (this.orgUsersMap[k] ||= []).push(u);
        }

        if (!this.organizations.length) {
          return of({map:{},all:[] as RichDevice[]});
        }

        const perOrg$ = this.organizations.map(o =>
          this.deviceSvc.getByOrganization(o.id!).pipe(timeout(this.API_TIMEOUT_MS), catchError(()=>of([])))
        );

        return forkJoin(perOrg$).pipe(
          switchMap((lists: EndNodeDevice[][])=>{
            const pairs: Array<{orgId:string; d: EndNodeDevice}> = [];
            this.organizations.forEach((o, i)=> (lists[i]||[]).forEach(d=>pairs.push({orgId:o.id!, d})));
            if (!pairs.length) {
              const empty: Record<string,RichDevice[]> = {}; this.organizations.forEach(o=>empty[o.id!]=[]);
              return of({map:empty, all:[] as RichDevice[]});
            }

            const dev$ = pairs.map(p =>
              this.readingSvc.getLatest(p.d.devEui, 1).pipe(
                timeout(this.API_TIMEOUT_MS), catchError(()=>of([] as SensorReading[])),
                map(reads=>{
                  const r = reads?.[0] as any;
                  const o = this.payloadOf(r);

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

                  const devCoords = this.pickCoordsFromDevice(p.d as any) || this.pickCoordsFromReading(o);
                  const orgC = this.orgCoords[p.orgId] || {lat:null, lng:null};
                  const lat = devCoords?.lat ?? orgC.lat ?? null;
                  const lng = devCoords?.lng ?? orgC.lng ?? null;
                  const altitude = this.toNumOrNull((p.d as any).altitude ?? (o?.gpsLocation?.altitude));

                  const rd: RichDevice = {
                    id: (p.d as any).id ?? p.d.devEui,
                    devEui: p.d.devEui, name: p.d.name,
                    latest,
                    lat, lng, altitude,
                    description: (p.d as any).description,
                    organizationId: (p.d as any).organizationId ?? p.orgId,
                    userId: (p.d as any).userId,
                    status: (latest?.fresh ? 'ONLINE' : 'OFFLINE')
                  };
                  return {orgId:p.orgId, rd};
                })
              )
            );

            return forkJoin(dev$).pipe(map(items=>{
              const map: Record<string,RichDevice[]> = {}; this.organizations.forEach(o=>map[o.id!]=[]);
              const all: RichDevice[]=[]; items.forEach(({orgId,rd})=>{map[orgId].push(rd); all.push(rd);});
              return {map, all};
            }));
          })
        );
      }),
      finalize(()=> this.loading=false)
    ).subscribe(({map, all})=>{
      this.orgDevices = map;
      this.allDevices = all;

      const list = this.devicesInSelectedOrg;
      if (!list.length) {
        this.selectedDevEui = null;
      } else if (!this.selectedDevEui || !list.some(d => d.devEui === this.selectedDevEui)) {
        this.selectedDevEui = list[0].devEui;
      }
      this.recomputeKpis();
    });
  }

  /** KPIs (selected org only) */
  recomputeKpis(){
    const list = this.devicesInSelectedOrg;
    this.total = list.length;
    this.online = list.filter(d=>d.latest?.fresh).length;
    this.offline = this.total - this.online;
  }

  orgNameById(id: string | null): string {
    if (!id) return '';
    return this.organizations.find(o => o.id === id)?.name || '';
  }

  onOrgChange(): void {
    const list = this.devicesInSelectedOrg;
    this.selectedDevEui = list.length ? list[0].devEui : null;
    this.recomputeKpis();
  }

  /** header */
  onSearchChange(_q:string) {}
  logout(){
    this.auth.logout?.();
    this.router.navigate(['/login', this.orgId], {state:{orgName:this.headerOrgName}, replaceUrl:true});
  }
  openProfile(){
    this.router.navigate(['/profile']);
  }

  /** sidebar / nav handlers */
  onSelectOrg(o: Organization){
    this.selectedOrgId = o?.id || null;
    const list = this.devicesInSelectedOrg;
    this.selectedDevEui = list.length ? list[0].devEui : null;
    this.recomputeKpis();
  }
  openAddOrg(){ this.addOrgOpen = true; }
  goListOrgs(){ this.panel='orgs'; }

  addDeviceGlobal(){
    if(!this.selectedOrgId){ window.alert('Select an organization first.'); return; }
    this.addOrgId=this.selectedOrgId; this.addOwnerId=null; this.addStatus=null; this.addOpen=true;
  }
  addDeviceForOrg(orgId:string){ this.addOrgId=orgId; this.addOwnerId=null; this.addStatus=null; this.addOpen=true; }
  selectDeviceAdmin(d: DeviceWithLatest){ this.selectedDevEui=d.devEui; }
  editDeviceAdmin(d: DeviceWithLatest){
    const id = (d as any).id ?? d.devEui;
    this.editStatus=null; this.editBusy=false; this.editDevice=null;
    this.deviceSvc.getById(id).pipe(catchError(()=>of(null as unknown as EndNodeDevice))).subscribe(full=>{
      const record: EndNodeDevice = full ?? { id, devEui:d.devEui, name:d.name||'', organizationId:this.orgId, userId:this.userId } as any;
      this.editDevice=record; this.editOpen=true;
    });
  }
  deleteDeviceAdmin(d: DeviceWithLatest){
    const ok = window.confirm(`Delete device ${(d as any).name || d.devEui}?`); if(!ok) return;
    const id = (d as any).id ?? d.devEui;
    (this.deviceSvc as any).delete?.(id)?.pipe(catchError(()=>of(null))).subscribe(()=>{
      // Optimistic local removal (no full refresh)
      const orgId = this.findDeviceOrgId(d.devEui) || this.selectedOrgId || '';
      if (orgId) this.removeDeviceFromMaps(orgId, d.devEui);
    });
  }

  // open add user drawers directly
  addUserAdmin(){ this.addUserRole='ADMIN'; this.addUserOpen=true; }
  addUserClient(){ this.addUserRole='CLIENT'; this.addUserOpen=true; }
  goListUsers(){ this.panel='users'; }
  goListDevices(){ this.panel='devices'; }

  /** focus & open map */
  openGlobalMap(d?: DeviceWithLatest){
    this.mapFocus = d || undefined;
    this.mapOpen = true;
  }

  /** irrigation handlers */
  openIrrigationFor(d: DeviceWithLatest){
    this.irrigationDevice = d;
    this.irrigationOpen = true;
  }
  onIrrigationCommand(device: DeviceWithLatest, action: 'OPEN' | 'CLOSE') {
  const devEui = device.devEui;
  const value = action === 'OPEN' ? 1 : 0;

  (this.deviceSvc as any).sendCommand?.(devEui, action)
    ?.pipe(catchError(() => of(null)))
    .subscribe(() => {
      // ✅ Optimistic local update of L.command so the tile shows ON/OFF immediately
      const orgId = this.findDeviceOrgId(devEui) || this.selectedOrgId || '';
      const cur = this.findDeviceByEui(devEui);
      if (!orgId || !cur) return;

      const latest = {
        ...(cur.latest || {}),
        command: value
      } as DeviceWithLatest['latest'];

      this.upsertDeviceInMaps(orgId, {
        ...cur,
        latest,
        status: latest?.fresh ? 'ONLINE' : 'OFFLINE'
      } as any);
    });
  }


  /** range explorer */
  openChart(device: DeviceWithLatest, metric: MetricKey){ this.chartDevice=device; this.chartMetric=metric; this.chartOpen=true; }
  closeChart(){ this.chartOpen=false; }

  /** handlers required by template (saved)="..." */
  onDeviceCreated(payload: EndNodeDevice & { ownerId?: string; userId?: string; organizationId?: string }){
    const orgId   = payload.organizationId || this.addOrgId || this.selectedOrgId || '';
    const ownerId = (payload as any).ownerId || payload.userId || this.addOwnerId || this.userId || '';

    if (!payload?.devEui || !orgId || !ownerId) {
      this.addStatus = { kind: 'error', message: 'Missing devEui / organization / owner.' };
      return;
    }

    this.addBusy = true; this.addStatus = null;
    this.deviceSvc.create({
      ...payload,
      organizationId: orgId,
      userId: ownerId
    }).pipe(
      timeout(this.API_TIMEOUT_MS),
      catchError(()=>{ this.addStatus={kind:'error',message:'Failed to add device.'}; return of(null); }),
      finalize(()=> this.addBusy=false)
    ).subscribe(res=>{
      if (res) {
        this.addStatus = { kind: 'success', message: 'Device added.' };
        this.addOpen = false;

        // Optimistic local insert
        const rd: RichDevice = {
          id: (res as any).id ?? payload.devEui,
          devEui: payload.devEui,
          name: payload.name,
          latest: undefined,
          lat: this.toNumOrNull((payload as any).lat),
          lng: this.toNumOrNull((payload as any).lng),
          altitude: this.toNumOrNull((payload as any).altitude),
          description: payload.description,
          organizationId: orgId,
          userId: ownerId,
          status: 'OFFLINE'
        };
        this.upsertDeviceInMaps(orgId, rd);

        // Fetch latest in background and update just this item (no global refresh)
        this.readingSvc.getLatest(payload.devEui, 1).pipe(
          timeout(this.API_TIMEOUT_MS),
          catchError(()=>of([] as SensorReading[]))
        ).subscribe(reads=>{
          const r = reads?.[0] as any;
          if (!r) return;
          const o = this.payloadOf(r);
          const soilHumidity = this.getFirstNumeric(o?.analogInput)       ?? this.getFirstNumeric(o?.soilHumidity);
          const luminosity   = this.getFirstNumeric(o?.illuminanceSensor) ?? this.getFirstNumeric(o?.luminosity);
          const humidity     = this.getFirstNumeric(o?.humiditySensor)    ?? this.getFirstNumeric(o?.humidity);
          const barometer    = this.getFirstNumeric(o?.barometer);
          const temperature  = this.getFirstNumeric(o?.temperatureSensor) ?? this.getFirstNumeric(o?.temperature);
          const command      = this.findCommandValue(o);

          const ts = new Date((r as any).timestamp).getTime();
          const fresh = Number.isFinite(ts) && (Date.now() - ts) <= this.FRESH_WINDOW_MS;
          const latest: DeviceWithLatest['latest'] = {
            timestamp: (r as any).timestamp,
            soilHumidity: this.toNumOrNull(soilHumidity), soilHumidityMax: 100,
            luminosity:   this.toNumOrNull(luminosity),   luminosityMax: 100000,
            humidity:     this.toNumOrNull(humidity),     humidityMax: 100,
            barometer:    this.toNumOrNull(barometer),    barometerMax: 1100,
            temperature:  this.toNumOrNull(temperature),  temperatureMax: 60,
            command:      this.toNumOrNull(command),
            fresh
          };
          this.upsertDeviceInMaps(orgId, { ...rd, latest, status: latest?.fresh ? 'ONLINE':'OFFLINE' });
        });
      }
    });
  }

  onDeviceSaved(payload: EndNodeDevice){
    if (!payload?.id && !payload?.devEui) return;
    this.editBusy = true; this.editStatus = null;

    const patch: Partial<EndNodeDevice> = {
      name: payload.name?.trim() || '',
      description: payload.description?.trim() || undefined,
      address: (payload as any).address ?? undefined,
      lat: (payload as any).lat ?? undefined,
      lng: (payload as any).lng ?? undefined,
      altitude: (payload as any).altitude ?? undefined,
    };

    this.deviceSvc.update(payload.id ?? payload.devEui, patch).pipe(
      timeout(this.API_TIMEOUT_MS),
      catchError(()=>{ this.editStatus={kind:'error',message:'Failed to save device.'}; return of(null); }),
      finalize(()=> this.editBusy=false)
    ).subscribe(res=>{
      if (res) {
        this.editStatus = { kind: 'success', message: 'Device saved.' };
        this.editOpen = false;

        // Optimistic local update (find org by devEui)
        const devEui = (res as any).devEui ?? payload.devEui!;
        const orgId = this.findDeviceOrgId(devEui) || this.selectedOrgId || '';
        if (orgId) {
          const current = this.findDeviceByEui(devEui);
          const updated: RichDevice = {
            ...(current || { devEui } as RichDevice),
            name: (res as any).name ?? patch.name ?? current?.name,
            description: (res as any).description ?? patch.description ?? current?.description,
            lat: (res as any).lat ?? (patch as any).lat ?? current?.lat ?? null,
            lng: (res as any).lng ?? (patch as any).lng ?? current?.lng ?? null,
            altitude: (res as any).altitude ?? (patch as any).altitude ?? current?.altitude ?? null,
            id: (res as any).id ?? current?.id ?? devEui,
            devEui: devEui,
            latest: current?.latest,
            organizationId: current?.organizationId ?? orgId,
            userId: current?.userId,
            status: current?.status
          };
          this.upsertDeviceInMaps(orgId, updated);
        }
      }
    });
  }

  /** current org devices + selected device */
  get devicesInSelectedOrg(): RichDevice[]{ return this.orgDevices[this.selectedOrgId||''] || []; }
  get selectedDevice(): RichDevice | null {
    if (!this.selectedDevEui) return null;
    return this.devicesInSelectedOrg.find(d => d.devEui === this.selectedDevEui) ?? null;
  }
  get selectedOrgLat(): number | null { return this.orgCoords[this.selectedOrgId || '']?.lat ?? null; }
  get selectedOrgLng(): number | null { return this.orgCoords[this.selectedOrgId || '']?.lng ?? null; }

  usersForSelectedOrg(): User[] { return this.orgUsersMap[this.selectedOrgId || ''] || []; }

  // === small helpers =========================================================

  private findDeviceOrgId(devEui: string): string | null {
    for (const [orgId, list] of Object.entries(this.orgDevices)) {
      if (list.some(d => d.devEui === devEui)) return orgId;
    }
    return null;
  }

  private findDeviceByEui(devEui: string): RichDevice | undefined {
    return this.allDevices.find(d => d.devEui === devEui);
  }

  private upsertDeviceInMaps(orgId: string, device: RichDevice){
    const cur = this.orgDevices[orgId] || [];
    const idx = cur.findIndex(d => d.devEui === device.devEui);
    const next = idx >= 0 ? [...cur.slice(0,idx), {...cur[idx], ...device}, ...cur.slice(idx+1)] : [device, ...cur];
    this.orgDevices = { ...this.orgDevices, [orgId]: next };

    const aIdx = this.allDevices.findIndex(d => d.devEui === device.devEui);
    this.allDevices = aIdx >= 0
      ? [...this.allDevices.slice(0,aIdx), {...this.allDevices[aIdx], ...device}, ...this.allDevices.slice(aIdx+1)]
      : [device, ...this.allDevices];

    // Maintain selection if needed
    if (!this.selectedDevEui) this.selectedDevEui = device.devEui;
    this.recomputeKpis();
  }

  private removeDeviceFromMaps(orgId: string, devEui: string){
    const cur = this.orgDevices[orgId] || [];
    const next = cur.filter(d => d.devEui !== devEui);
    this.orgDevices = { ...this.orgDevices, [orgId]: next };
    this.allDevices = this.allDevices.filter(d => d.devEui !== devEui);

    if (this.selectedDevEui === devEui) {
      this.selectedDevEui = next[0]?.devEui ?? null;
    }
    this.recomputeKpis();
  }

  // === helpers copied from ClientDashboard ===
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
