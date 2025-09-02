import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartDataset, ChartOptions, ChartType } from 'chart.js';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule }      from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { SensorReadingService } from '../../services/sensorReadingService/sensor-reading';
import { DeviceWithLatest, MetricKey } from '../../models/device-with-latest.model';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-range-explorer-drawer',
  standalone: true,
  imports: [
    CommonModule, FormsModule, BaseChartDirective,
    MatFormFieldModule, MatInputModule, MatDatepickerModule, MatNativeDateModule
  ],
  templateUrl: './range-explorer-drawer.html',
  styleUrls: ['./range-explorer-drawer.css']
})
export class RangeExplorerDrawer implements OnChanges {
  @Input() open = false;
  @Input() device?: DeviceWithLatest;
  @Input() metric: MetricKey = 'soilHumidity';
  @Output() closed = new EventEmitter<void>();

  /** 👇 used by the template: <canvas baseChart [type]="chartType" ...> */
  chartType: 'bar' = 'bar';

  // availability
  availableDates = new Set<string>(); // 'yyyy-mm-dd'
  availableMin: Date | null = null;
  availableMax: Date | null = null;
  availabilityLoading = false;

  // selection
  rangeSel: { start: Date; end: Date } = { start: new Date(), end: new Date() };

  granularity: '30m' | 'hour' | 'day' = 'day';
  userSetGranularity = false;
  seriesSel = { min: true, avg: true, max: true, realtime: false };
  noDataInRange = false;

  lastBinStarts: number[] = [];

  /** We render bars for everything per your request */
  rangeLine: ChartData<'bar', (number | null)[], string> = { labels: [], datasets: [] };
  rangeOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top', labels: { font: { weight: 'bold' } } },
      tooltip: { mode: 'index', intersect: false }
    },
    interaction: { mode: 'nearest', intersect: false } as any,
    // grid lines stay the same; y grid color already defined
    scales: {
      x: { grid: { display: false }, ticks: { maxRotation: 0 }, title: { display: true, text: 'Time' } },
      y: { beginAtZero: false, title: { display: true, text: '' }, grid: { color: 'rgba(2,6,23,.06)' } }
    }
  };

  constructor(private readingSvc: SensorReadingService) {}

  ngOnChanges(): void {
    if (!this.open || !this.device) return;

    // default to current month full days
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    this.rangeSel = this.normalizeRange({ start, end }, false);

    this.userSetGranularity = false;
    this.granularity = this.autoGranularity(this.rangeSel.start, this.rangeSel.end);
    this.seriesSel = { min: true, avg: true, max: true, realtime: false };
    this.noDataInRange = false;

    this.loadAvailability(2).then(() => {
      this.rangeSel = this.normalizeRange(this.rangeSel, true);
      if (!this.userSetGranularity) {
        this.granularity = this.autoGranularity(this.rangeSel.start, this.rangeSel.end);
      }
      this.onRangeChange();
    });

    (this.rangeOptions.scales!['y'] as any).title.text =
      `${this.metricTitle(this.metric)} (${this.metricUnit(this.metric)})`;
  }

  // UI
  doClose() { this.closed.emit(); }

  // helpers – metric/units
  private metricUnit(m: MetricKey) {
    return m === 'barometer' ? 'hPa' : (m === 'luminosity' ? 'lx' : (m === 'temperature' ? '°C' : '%'));
  }
  private metricTitle(m: MetricKey): string {
    switch (m) {
      case 'soilHumidity': return 'Soil Humidity';
      case 'luminosity':   return 'Luminosity';
      case 'humidity':     return 'Humidity';
      case 'barometer':    return 'Barometer';
      case 'temperature':  return 'Temperature';
      default:             return 'Metric';
    }
  }

  /** decode backend reading */
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
      if ((r as any)[k] !== undefined) {
        const parsed = this.parseMaybeJson((r as any)[k]) ?? (r as any)[k];
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
  private valueFromReading(r: any, m: MetricKey): number | null {
    const o: any = this.payloadOf(r);
    if (m === 'soilHumidity') return this.getFirstNumeric(o?.analogInput)       ?? this.getFirstNumeric(o?.soilHumidity);
    if (m === 'luminosity')   return this.getFirstNumeric(o?.illuminanceSensor) ?? this.getFirstNumeric(o?.luminosity);
    if (m === 'humidity')     return this.getFirstNumeric(o?.humiditySensor)    ?? this.getFirstNumeric(o?.humidity);
    if (m === 'barometer')    return this.getFirstNumeric(o?.barometer);
    return this.getFirstNumeric(o?.temperatureSensor) ?? this.getFirstNumeric(o?.temperature);
  }

  // availability
  private toKey(d: Date): string {
    const y = d.getFullYear();
    const m = (d.getMonth()+1).toString().padStart(2,'0');
    const dd= d.getDate().toString().padStart(2,'0');
    return `${y}-${m}-${dd}`;
  }
  dateEnabled = (d: Date | null): boolean => {
    if (!d) return false;
    if (this.availableMin && d < this.stripTime(this.availableMin)) return false;
    if (this.availableMax && d > this.stripTime(this.availableMax)) return false;
    return this.availableDates.has(this.toKey(d));
  };
  private stripTime(d: Date): Date { const x = new Date(d); x.setHours(0,0,0,0); return x; }

  private async loadAvailability(yearsBack: number): Promise<void> {
    if (!this.device) return;
    this.availabilityLoading = true;
    this.availableDates.clear();
    this.availableMin = null;
    this.availableMax = null;

    const now = new Date();
    const start = new Date(now); start.setFullYear(now.getFullYear() - Math.max(1, yearsBack)); start.setHours(0,0,0,0);
    const end = new Date(now); end.setHours(23,59,59,999);

    await new Promise<void>((resolve) => {
      this.readingSvc.getRange(this.device!.devEui, start.toISOString(), end.toISOString())
        .pipe(catchError(() => of([])))
        .subscribe((list: any[]) => {
          this.availabilityLoading = false;
          if (!list?.length) { resolve(); return; }
          let minTs = +new Date(list[0].timestamp);
          let maxTs = minTs;
          for (const r of list) {
            const ts = +new Date(r.timestamp);
            if (ts < minTs) minTs = ts;
            if (ts > maxTs) maxTs = ts;
            this.availableDates.add(this.toKey(new Date(ts)));
          }
          this.availableMin = new Date(minTs); this.availableMin.setHours(0,0,0,0);
          this.availableMax = new Date(maxTs); this.availableMax.setHours(0,0,0,0);
          resolve();
        });
    });
  }

  // range + granularity
  private startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0,0,0,0); return x; }
  private endOfDay(d: Date): Date { const x = new Date(d); x.setHours(23,59,59,999); return x; }
  private normalizeRange(sel: { start: Date; end: Date }, clampToAvailability: boolean): { start: Date; end: Date } {
    let s = this.startOfDay(sel.start);
    let e = this.endOfDay(sel.end);

    if (clampToAvailability) {
      if (this.availableMin) {
        const min = this.startOfDay(this.availableMin);
        if (s < min) s = min;
      }
      if (this.availableMax) {
        const max = this.endOfDay(this.availableMax);
        if (e > max) e = max;
      }
    }

    if (s > e) { const t = s; s = this.startOfDay(e); e = this.endOfDay(t); }
    return { start: s, end: e };
  }
  onRangeChange(): void {
    this.rangeSel = this.normalizeRange(this.rangeSel, true);
    if (!this.userSetGranularity) {
      this.granularity = this.autoGranularity(this.rangeSel.start, this.rangeSel.end);
    }
    this.loadRangeChart();
  }
  onGranularityChange(): void { this.userSetGranularity = true; this.loadRangeChart(); }
  onSeriesToggle(): void { this.loadRangeChart(); }

  private autoGranularity(start: Date, end: Date): '30m' | 'hour' | 'day' {
    const span = +end - +start; const d = 24 * 60 * 60 * 1000;
    if (span <= 2 * d) return '30m';
    if (span <= 30 * d) return 'hour';
    return 'day';
  }
  private stepForGranularity(g: '30m'|'hour'|'day'): number {
    if (g === '30m') return 30*60*1000;
    if (g === 'hour') return 60*60*1000;
    return 24*60*60*1000;
  }
  private makeBins(start: Date, end: Date, stepMs: number) {
    const labels: string[] = [];
    const edges: number[] = [];
    const fmt = (d: Date) => {
      const y = d.getFullYear();
      const m = (d.getMonth()+1).toString().padStart(2,'0');
      const dd= d.getDate().toString().padStart(2,'0');
      const hh= d.getHours().toString().padStart(2,'0');
      const mi= d.getMinutes().toString().padStart(2,'0');
      if (stepMs >= 24*60*60*1000) return `${y}-${m}-${dd}`;
      if (stepMs >= 60*60*1000)    return `${y}-${m}-${dd} ${hh}:00`;
      return `${y}-${m}-${dd} ${hh}:${mi}`;
    };
    const startMs = Math.floor(+start / stepMs) * stepMs;
    const endMs   = Math.ceil(+end   / stepMs) * stepMs;
    for (let t = startMs; t <= endMs; t += stepMs) {
      edges.push(t);
      labels.push(fmt(new Date(t)));
    }
    return { labels, edges };
  }

  loadRangeChart(): void {
    if (!this.device) return;

    const step = this.stepForGranularity(this.granularity);
    const bins = this.makeBins(this.rangeSel.start, this.rangeSel.end, step);
    this.lastBinStarts = bins.edges.slice(0, -1);
    const perBin: number[][] = Array.from({ length: Math.max(bins.labels.length - 1, 1) }, () => []);
    const realtime: (number | null)[] = perBin.map(() => null);

    this.readingSvc.getRange(this.device.devEui, this.rangeSel.start.toISOString(), this.rangeSel.end.toISOString())
      .pipe(catchError(() => of([])))
      .subscribe((list: any[]) => {
        const readings = [...list].sort((a,b) => +new Date(a.timestamp) - +new Date(b.timestamp));
        for (const r of readings) {
          const v = this.valueFromReading(r, this.metric);
          if (v === null || !Number.isFinite(v)) continue;
          const ts = +new Date(r.timestamp);
          let idx = -1;
          if (ts >= bins.edges[0] && ts <= bins.edges[bins.edges.length-1]) {
            idx = Math.min(perBin.length-1, Math.max(0, Math.floor((ts - bins.edges[0]) / step)));
          }
          if (idx >= 0) { perBin[idx].push(v); realtime[idx] = v; }
        }

        const minArr: (number | null)[] = [];
        const avgArr: (number | null)[] = [];
        const maxArr: (number | null)[] = [];
        for (const arr of perBin) {
          if (!arr.length) { minArr.push(null); avgArr.push(null); maxArr.push(null); continue; }
          minArr.push(Math.min(...arr));
          maxArr.push(Math.max(...arr));
          const avg = arr.reduce((a,b)=>a+b,0)/arr.length;
          avgArr.push(Math.round(avg*100)/100);
        }

        const datasets: ChartDataset<'bar', (number|null)[]>[] = [];
        if (this.seriesSel.avg) datasets.push({ label: 'Avg', data: avgArr });
        if (this.seriesSel.min) datasets.push({ label: 'Min', data: minArr });
        if (this.seriesSel.max) datasets.push({ label: 'Max', data: maxArr });
        if (this.seriesSel.realtime) datasets.push({ label: 'Realtime', data: realtime });

        const xLabels = bins.labels.slice(0, -1);

        // ensure axes/grid even with no values
        const hasAny = datasets.some(ds => (ds.data as (number|null)[]).some(v => v !== null));
        if (!hasAny) {
          // transparent "axes keeper"
          (datasets as any[]).push({
            label: 'axes',
            data: xLabels.map(() => 0),
            backgroundColor: 'rgba(0,0,0,0)',
            borderColor: 'rgba(0,0,0,0)'
          });
        }
        const y = this.rangeOptions.scales!['y'] as any;
        if (!hasAny) { y.suggestedMin = 0; y.suggestedMax = 1; } else { delete y.suggestedMin; delete y.suggestedMax; }

        this.rangeLine = { labels: xLabels, datasets };
        this.noDataInRange = !hasAny;
      });
  }

  // CSV
  downloadCSVRange(): void {
    const cols: string[] = ['date', 'time'];
    const want = this.seriesSel;
    if (want.avg) cols.push('avg');
    if (want.min) cols.push('min');
    if (want.max) cols.push('max');
    if (want.realtime) cols.push('realtime');

    let csv = cols.join(',') + '\n';
    const labels = (this.rangeLine.labels || []) as string[];

    const pad2 = (n: number) => n.toString().padStart(2,'0');
    const toDateStr = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
    const toTimeStr = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

    for (let i = 0; i < labels.length; i++) {
      const t = this.lastBinStarts[i] ?? Date.now();
      const dt = new Date(t);

      const dateStr = toDateStr(dt);
      const timeStr = (this.granularity === 'day') ? '' : toTimeStr(dt);

      const row: (string | number)[] = [dateStr, timeStr];

      const getVal = (label: string) => {
        const ds = this.rangeLine.datasets.find(d => d.label === label);
        const v = (ds?.data?.[i] ?? '') as any;
        return (v === null || Number.isNaN(v)) ? '' : v;
      };

      if (want.avg) row.push(getVal('Avg'));
      if (want.min) row.push(getVal('Min'));
      if (want.max) row.push(getVal('Max'));
      if (want.realtime) row.push(getVal('Realtime'));

      csv += row.join(',') + '\n';
    }

    const filename = `${this.metricTitle(this.metric)}_${this.rangeSel.start.toISOString().slice(0,10)}_${this.rangeSel.end.toISOString().slice(0,10)}.csv`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }
}
