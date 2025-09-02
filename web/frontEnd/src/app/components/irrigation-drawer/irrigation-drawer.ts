import { Component, EventEmitter, Inject, Input, OnChanges, Output, PLATFORM_ID } from '@angular/core';
import { CommonModule } from '@angular/common';
import { isPlatformBrowser } from '@angular/common';
import { of, firstValueFrom } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { DeviceWithLatest } from '../../models/device-with-latest.model';
import { SensorReadingService } from '../../services/sensorReadingService/sensor-reading';

type Row = { ts: string; value: 0 | 1 };

@Component({
  selector: 'app-irrigation-drawer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './irrigation-drawer.html',
  styleUrls: ['./irrigation-drawer.css']
})
export class IrrigationDrawer implements OnChanges {
  @Input() open = false;
  @Input() device?: DeviceWithLatest;
  @Output() closed = new EventEmitter<void>();

  loading = false;
  rows: Row[] = [];

  constructor(
    private readingSvc: SensorReadingService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnChanges(): void {
    if (!this.open || !this.device) return;
    this.load();
  }

  doClose() { this.closed.emit(); }

  private async load() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.loading = true;
    this.rows = [];

    // last 30 days by default
    const end = new Date();
    const start = new Date(); start.setDate(end.getDate() - 30);
    const startIso = start.toISOString(); const endIso = end.toISOString();

    const list = await firstValueFrom(
      this.readingSvc.getRange(this.device!.devEui, startIso, endIso)
        .pipe(catchError(() => of([] as any[])))
    ).catch(()=>[]) as any[];

    // walk readings and extract command value changes
    let last: 0 | 1 | null = null;
    for (const r of list.sort((a,b)=> +new Date(a.timestamp) - +new Date(b.timestamp))) {
      const cmd = this.findCommandValue(this.payloadOf(r));
      if (cmd === null) continue;
      const norm: 0|1 = cmd >= 0.5 ? 1 : 0;
      if (last === null || norm !== last) {
        this.rows.push({ ts: r.timestamp, value: norm });
        last = norm;
      }
    }

    this.rows.reverse(); // newest on top
    this.loading = false;
  }

  // ===== payload helpers (same logic as other components)
  private parseMaybeJson(v: any): any { if (v == null) return null; if (typeof v === 'string') { try { return JSON.parse(v); } catch { return null; } } return (typeof v === 'object') ? v : null; }
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
  private findCommandValue(o: any): number | null {
    if (!o || typeof o !== 'object') return null;
    const norm = (x: any): number | null => {
      const n = Number(x);
      if (Number.isFinite(n)) return n >= 0.5 ? 1 : 0;
      const s = String(x).trim().toUpperCase();
      if (['1','ON','OPEN','TRUE'].includes(s))  return 1;
      if (['0','OFF','CLOSE','FALSE'].includes(s)) return 0;
      return null;
    };
    const keys = ['digitalOutput','digital_output','relay','relayState','valve','valveState','output','actuator','pump','command','cmd'];
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
}
