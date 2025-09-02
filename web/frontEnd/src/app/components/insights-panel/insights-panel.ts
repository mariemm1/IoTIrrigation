import {
  Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges,
  Inject, PLATFORM_ID, AfterViewInit, ViewChild, ElementRef
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { DeviceWithLatest, MetricKey } from '../../models/device-with-latest.model';
import { SensorReading } from '../../models/sensor-reading.model';
import { SensorReadingService } from '../../services/sensorReadingService/sensor-reading';
import { MapReadyDirective } from '../app-map-ready.directive/app-map-ready.directive';

type RichDevice = DeviceWithLatest & { name?: string; lat?: number | null; lng?: number | null; };
type AggMode = 'instant' | 'minToday' | 'maxToday';

@Component({
  selector: 'app-insights-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, MapReadyDirective],
  templateUrl: './insights-panel.html',
  styleUrls: ['./insights-panel.css']
})
export class InsightsPanel implements OnInit, OnDestroy, OnChanges, AfterViewInit {
  @Input() devices: RichDevice[] = [];
  @Input() selectedDevEui: string | null = null;
  @Output() selectedDevEuiChange = new EventEmitter<string | null>();

  @Input() metric24: MetricKey = 'soilHumidity';
  @Output() metric24Change = new EventEmitter<MetricKey>();

  @Input() orgLat: number | null = null;
  @Input() orgLng: number | null = null;

  /** Ask parent to open the Map drawer for a device */
  @Output() openMap = new EventEmitter<DeviceWithLatest>();

  // ===== Leaflet (dynamic) =====
  private L?: any;
  private map?: any;
  private markersLayer?: any;
  private initialViewSet = false;

  // ===== Chart.js (dynamic) =====
  private Chart?: any;
  @ViewChild('chart24El') chart24El?: ElementRef<HTMLCanvasElement>;
  @ViewChild('chart7dEl') chart7dEl?: ElementRef<HTMLCanvasElement>;
  private chart24?: any;
  private chart7d?: any;

  loadingSeries = false;

  // Legend
  legendTitle = '';
  buckets: { color: string; label: string; min?: number; max?: number }[] = [];

  // ===== Aggregation tabs =====
  agg: AggMode = 'instant';
  private aggValues = new Map<string, number | null>(); // devEui -> value for current day & metric

  private readonly FRESH_WINDOW_MS = 2 * 60 * 1000;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private readingSvc: SensorReadingService
  ) {}

  ngOnInit(): void {}
  ngAfterViewInit(): void { this.refreshSeries(); }
  ngOnDestroy(): void {
    try { this.map?.remove?.(); } catch {}
    try { this.chart24?.destroy?.(); } catch {}
    try { this.chart7d?.destroy?.(); } catch {}
  }

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['devices'] && this.map) { this.renderMarkers(); this.ensureInitialOverview(); this.refreshAggValues(); }
    if (ch['metric24']) { this.buildLegend(); this.renderMarkers(); this.refreshSeries(); this.refreshAggValues(); }
    if (ch['selectedDevEui']) { this.renderMarkers(); this.refreshSeries(); }
  }

  // ======= Map host (SSR-safe) =======
  onMapHostReady = async (host: HTMLDivElement) => {
    if (!isPlatformBrowser(this.platformId) || this.map) return;

    // robust dynamic import for ESM/CJS
    const mod = await import('leaflet');
    this.L = (mod as any).default ?? mod;
    const L = this.L;

    this.map = L.map(host, { zoomControl: false, center: this.getInitialCenter(), zoom: 6 });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(this.map);

    L.control.zoom({ position: 'topright' }).addTo(this.map);

    this.markersLayer = L.layerGroup().addTo(this.map);
    this.buildLegend();
    this.renderMarkers();
    this.ensureInitialOverview();

    // let layout settle then ensure Leaflet knows the size
    setTimeout(() => this.map!.invalidateSize(), 50);
  };

  // ===== map + markers =====
  private renderMarkers() {
    if (!this.map || !this.markersLayer || !this.L) return;
    const L = this.L;
    this.markersLayer.clearLayers();

    const points: Array<{ lat: number; lng: number; dev: RichDevice; value: number | null }> = [];

    for (const d of this.devices) {
      const lat = toNum(d.lat); const lng = toNum(d.lng);
      if (lat == null || lng == null) continue;

      const v = (this.agg === 'instant')
        ? this.latestValue(d, this.metric24)
        : (this.aggValues.get(d.devEui) ?? null);

      points.push({ lat, lng, dev: d, value: v });
    }

    for (const p of points) {
      const isSelected = this.selectedDevEui === p.dev.devEui;

      const hasValueNow = (this.agg === 'instant')
        ? (p.dev.latest?.fresh === true && p.value != null && Number.isFinite(p.value))
        : (p.value != null && Number.isFinite(p.value));

      const color = this.colorFor(p.value);
      const html =
        hasValueNow
          ? `<div class="pin dot ${isSelected ? 'selected' : ''}" style="--pin-color:${color}"><span class="minus"></span></div>`
          : `<div class="pin nodata ${isSelected ? 'selected' : ''}"><span class="minus"></span></div>`;

      const icon = L.divIcon({
        className: 'map-pin-icon leaflet-div-icon',
        html,
        iconSize: [24, 24],
        iconAnchor: [12, 24]
      });

      const marker = L.marker([p.lat, p.lng], { icon });

      const labelValue = hasValueNow
        ? this.formatValue(p.value as number, this.metric24)
        : 'no available data';

      marker.bindTooltip(
        `<div class="tip-name">${escapeHtml(p.dev.name || p.dev.devEui)}</div>
         <div class="tip-value">${escapeHtml(this.prettyMetric(this.metric24))}: <b>${labelValue}</b></div>`,
        { direction: 'top', offset: L.point(0, -8), opacity: 0.95, sticky: true }
      );

      marker.on('click', () => {
        this.selectedDevEui = p.dev.devEui;
        this.selectedDevEuiChange.emit(this.selectedDevEui);
        this.openMap.emit(p.dev);
        this.renderMarkers();
      });

      marker.addTo(this.markersLayer);
    }
  }

  private ensureInitialOverview() {
    if (this.initialViewSet || !this.map || !this.L) return;
    const pts = this.devices
      .map(d => ({ lat: toNum(d.lat), lng: toNum(d.lng) }))
      .filter((p): p is {lat:number;lng:number} => p.lat != null && p.lng != null);

    if (pts.length >= 2) {
      const b = this.L.latLngBounds(pts.map(p => [p.lat, p.lng]));
      this.map.fitBounds(b.pad(0.30));
    } else if (pts.length === 1) {
      this.map.setView([pts[0].lat, pts[0].lng], 7);
    } else {
      this.map.setView(this.getInitialCenter(), 6);
    }
    this.initialViewSet = true;
  }

  // ===== Aggregation tabs =====
  setAgg(a: AggMode) {
    if (this.agg === a) return;
    this.agg = a;
    this.refreshAggValues();
    this.renderMarkers();
  }

  /** Compute per-device min/max for TODAY (UTC clock assumed) */
  private async refreshAggValues() {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.agg === 'instant') { this.aggValues.clear(); return; }
    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date();
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    const jobs = this.devices.map(async d => {
      try {
        const list = await firstValueFrom(
          this.readingSvc.getRange(d.devEui, startIso, endIso) as any
        ).catch(() => []) as any[];

        let best: number | null = null;
        for (const r of list) {
          const v = this.valueFromReading(r as SensorReading, this.metric24);
          if (v == null || !Number.isFinite(v)) continue;
          if (best === null) best = v;
          else best = (this.agg === 'minToday') ? Math.min(best, v) : Math.max(best, v);
        }
        this.aggValues.set(d.devEui, best);
      } catch {
        this.aggValues.set(d.devEui, null);
      }
    });

    await Promise.all(jobs);
    this.renderMarkers();
  }

  /** Use latest value ONLY if it's fresh; otherwise treat as no data */
  private latestValue(d: RichDevice, m: MetricKey): number | null {
    const fresh = d?.latest?.fresh === true;
    if (!fresh) return null;
    const v = d?.latest?.[m as keyof DeviceWithLatest['latest']];
    return toNum(v as any);
  }

  private getInitialCenter(): [number, number] {
    const sel = this.devices.find(x => x.devEui === this.selectedDevEui);
    if (sel?.lat != null && sel?.lng != null) return [sel.lat!, sel.lng!];
    if (this.orgLat != null && this.orgLng != null) return [this.orgLat, this.orgLng];
    const d0 = this.devices.find(d => d.lat != null && d.lng != null);
    if (d0) return [d0.lat as number, d0.lng as number];
    return [46.8, 8.2];
  }

  // ===== Legend =====
  private buildLegend() {
    const metric = this.metric24;
    if (metric === 'temperature') {
      this.legendTitle = 'Température : valeur';
      this.buckets = [
        { color: '#0b1c3f', label: '< −35 °C', max: -35 },
        { color: '#0c2f73', label: '−35 à −30 °C', min: -35, max: -30 },
        { color: '#0f47a2', label: '−30 à −25 °C', min: -30, max: -25 },
        { color: '#2a67b6', label: '−25 à −20 °C', min: -25, max: -20 },
        { color: '#3a90b0', label: '−12 à −9 °C', min: -12, max: -9 },
        { color: '#7fb8c3', label: '−9 à −6 °C', min: -9, max: -6 },
        { color: '#bfe0e7', label: '−6 à −3 °C', min: -6, max: -3 },
        { color: '#f1f6f8', label: '−3 à 0 °C', min: -3, max: 0 },
        { color: '#ffe7e5', label: '0 à 3 °C', min: 0, max: 3 },
        { color: '#ffd1c8', label: '3 à 6 °C', min: 3, max: 6 },
        { color: '#ffb4a3', label: '6 à 9 °C', min: 6, max: 9 },
        { color: '#ff967f', label: '9 à 12 °C', min: 9, max: 12 },
        { color: '#ff7c63', label: '12 à 15 °C', min: 12, max: 15 },
        { color: '#ff624b', label: '15 à 20 °C', min: 15, max: 20 },
        { color: '#f24335', label: '20 à 25 °C', min: 20, max: 25 },
        { color: '#d52a2a', label: '25 à 30 °C', min: 25, max: 30 },
        { color: '#a61219', label: '30 à 35 °C', min: 30, max: 35 },
        { color: '#7a0611', label: '> 35 °C', min: 35 }
      ];
      return;
    }

    if (metric === 'soilHumidity' || metric === 'humidity') {
      this.legendTitle = metric === 'soilHumidity' ? 'Soil humidity (%)' : 'Humidity (%)';
      this.buckets = [
        { color: '#e6f2ff', label: '0 – 20 %', min: 0,  max: 20 },
        { color: '#b3d8ff', label: '20 – 40 %', min: 20, max: 40 },
        { color: '#80bfff', label: '40 – 60 %', min: 40, max: 60 },
        { color: '#3399ff', label: '60 – 80 %', min: 60, max: 80 },
        { color: '#0073e6', label: '80 – 100 %', min: 80, max: 100 }
      ];
      return;
    }

    if (metric === 'luminosity') {
      this.legendTitle = 'Luminosity (lx)';
      this.buckets = [
        { color: '#f0f7ff', label: '0 – 100', min: 0, max: 100 },
        { color: '#d9ecff', label: '100 – 1k', min: 100, max: 1000 },
        { color: '#bfe0ff', label: '1k – 10k', min: 1000, max: 10000 },
        { color: '#8cc4ff', label: '10k – 50k', min: 10000, max: 50000 },
        { color: '#5aa9ff', label: '50k – 100k', min: 50000, max: 100000 }
      ];
      return;
    }

    this.legendTitle = 'Barometer (hPa)';
    this.buckets = [
      { color: '#e7f3ff', label: '≤ 990', max: 990 },
      { color: '#cfe7ff', label: '990 – 1000', min: 990, max: 1000 },
      { color: '#b7dbff', label: '1000 – 1010', min: 1000, max: 1010 },
      { color: '#9bcbff', label: '1010 – 1020', min: 1010, max: 1020 },
      { color: '#7ebaff', label: '≥ 1020', min: 1020 }
    ];
  }

  private colorFor(v: number | null): string {
    if (v == null) return '#c7c7c7';
    for (const b of this.buckets) {
      const okMin = b.min == null || v >= b.min;
      const okMax = b.max == null || v < b.max;
      if (okMin && okMax) return b.color;
    }
    return this.buckets[this.buckets.length - 1]?.color || '#888';
  }

  private formatValue(v: number, m: MetricKey): string {
    switch (m) {
      case 'soilHumidity':
      case 'humidity':     return `${round1(v)} %`;
      case 'luminosity':   return `${round1(v)} lx`;
      case 'barometer':    return `${round1(v)} hPa`;
      case 'temperature':  return `${round1(v)} °C`;
    }
  }
  prettyMetric(m: MetricKey): string {
    switch (m) {
      case 'soilHumidity': return 'Soil Humidity';
      case 'luminosity':   return 'Luminosity';
      case 'humidity':     return 'Humidity';
      case 'barometer':    return 'Barometer';
      case 'temperature':  return 'Temperature';
    }
  }

  // =================== SERIES (24h + 7d) ===================
  private async refreshSeries() {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.selectedDevEui) return;

    if (!this.Chart) this.Chart = (await import('chart.js/auto')).default;
    this.loadingSeries = true;

    let list24Raw: any[] = [];
    let weekListRaw: any[] = [];
    try {
      const last24hFn = (this.readingSvc as any).getLast24h as ((devEui: string) => any) | undefined;
      const rangeFn   = (this.readingSvc as any).getRange   as ((devEui: string, start: string, end: string) => any) | undefined;

      if (typeof last24hFn === 'function' && typeof rangeFn === 'function') {
        const { weekStart, weekEndOrNowIso } = this.weekRange();
        list24Raw   = await firstValueFrom(last24hFn.call(this.readingSvc, this.selectedDevEui) as any).catch(()=>[]) as any[];
        weekListRaw = await firstValueFrom(rangeFn.call(this.readingSvc, this.selectedDevEui, weekStart.toISOString(), weekEndOrNowIso) as any).catch(()=>[]) as any[];
      } else {
        const latest = await firstValueFrom(this.readingSvc.getLatest(this.selectedDevEui, 1200) as any).catch(()=>[]) as any[];
        const now = Date.now();
        const t24 = now - 24 * 3600_000;
        const t7d = now - 7  * 24 * 3600_000;
        list24Raw   = (latest as any[]).filter((r:any)=> +new Date(r.timestamp) >= t24);
        weekListRaw = (latest as any[]).filter((r:any)=> +new Date(r.timestamp) >= t7d);
      }
    } catch {
      list24Raw = [];
      weekListRaw = [];
    }

    // ===== 24h bins (30 min)
    const BIN_MS = 30 * 60 * 1000;
    const now = new Date();
    const endAligned = Math.floor(now.getTime() / BIN_MS) * BIN_MS;
    const startAligned = new Date(endAligned - 24 * 60 * 60 * 1000);
    const labels24: string[] = [];
    const times24: number[] = [];
    const fmt = (d: Date) => (d.getMinutes() === 0 ? `${d.getHours().toString().padStart(2,'0')}h` : `${d.getHours().toString().padStart(2,'0')}h30`);
    for (let t = +startAligned; t <= endAligned; t += BIN_MS) { times24.push(t); labels24.push(fmt(new Date(t))); }

    const perBin: number[][] = times24.map(() => []);
    const realtimeArr: (number|null)[] = times24.map(() => null);
    const list24 = [...list24Raw].sort((a,b)=> +new Date(a.timestamp) - +new Date(b.timestamp));

    for (const r of list24) {
      const ts = +new Date(r.timestamp);
      if (ts < +startAligned || ts > +endAligned) continue;
      const v = this.valueFromReading(r as SensorReading, this.metric24);
      if (v == null || !Number.isFinite(v)) continue;
      const idx = Math.min(times24.length - 1, Math.max(0, Math.floor((ts - +startAligned) / BIN_MS)));
      perBin[idx].push(v);
      realtimeArr[idx] = v;
    }

    const min24: (number|null)[] = [], avg24: (number|null)[] = [], max24: (number|null)[] = [];
    for (const arr of perBin) {
      if (!arr.length) { min24.push(null); avg24.push(null); max24.push(null); continue; }
      min24.push(Math.min(...arr));
      max24.push(Math.max(...arr));
      avg24.push(Math.round((arr.reduce((a,b)=>a+b,0)/arr.length) * 100) / 100);
    }

    // ===== weekly (Mon → Sun)
    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const dayVals: Record<number, number[]> = { 1:[], 2:[], 3:[], 4:[], 5:[], 6:[], 0:[] };
    for (const r of weekListRaw) {
      const v = this.valueFromReading(r as SensorReading, this.metric24);
      if (v == null || !Number.isFinite(v)) continue;
      const dow = new Date((r as any).timestamp).getDay();
      (dayVals[dow] ??= []).push(v);
    }
    const order = [1,2,3,4,5,6,0];
    const dailyMin: (number|null)[] = [], dailyAvg: (number|null)[] = [], dailyMax: (number|null)[] = [];
    for (const dow of order) {
      const arr = dayVals[dow] || [];
      dailyMin.push(arr.length ? Math.min(...arr) : null);
      dailyMax.push(arr.length ? Math.max(...arr) : null);
      dailyAvg.push(arr.length ? Math.round((arr.reduce((a,b)=>a+b,0)/arr.length)*100)/100 : null);
    }

    if (!this.Chart) return;
    const unit = this.unitOf(this.metric24);

    // 24h → line
    this.renderLine(
      this.chart24El?.nativeElement,
      this.chart24,
      (c) => { this.chart24 = c; },
      labels24,
      [
        { label: 'Avg (30m)', data: avg24 },
        { label: 'Min (30m)', data: min24, dashed: true },
        { label: 'Max (30m)', data: max24, dashed: true },
        { label: 'Realtime',  data: realtimeArr }
      ],
      unit
    );

    // Weekly → bars (Avg) + dashed line overlays (Min/Max)
    this.renderWeekBars(
      this.chart7dEl?.nativeElement,
      this.chart7d,
      (c) => { this.chart7d = c; },
      days,
      dailyAvg, dailyMin, dailyMax,
      unit
    );

    this.loadingSeries = false;
  }

  /** Generic line renderer with fallback axes when all values are null */
  private renderLine(
    canvas: HTMLCanvasElement | undefined,
    prev: any,
    setChart: (chart: any)=>void,
    labels: string[],
    series: Array<{ label: string; data: (number|null)[]; dashed?: boolean }>,
    unit: string
  ) {
    if (!canvas || !this.Chart) return;
    try { prev?.destroy?.(); } catch {}

    const allNull = series.every(s => (s.data ?? []).every(v => v == null));

    // any[] so we can add borderColor/backgroundColor to the fallback dataset (prevents TS errors)
    const datasets: any[] = series.map(s => ({
      label: s.label,
      data: s.data,
      tension: 0.25,
      pointRadius: 0,
      borderDash: s.dashed ? [6,4] : undefined,
      spanGaps: true
    }));

    // Transparent “axes keeper” so Chart.js always draws scales/grid when there’s no data
    if (allNull) {
      datasets.push({
        label: 'axes',
        data: labels.map(() => 0),
        borderColor: 'rgba(0,0,0,0)',
        backgroundColor: 'rgba(0,0,0,0)',
        pointRadius: 0,
        tension: 0
      });
    }

    const cfg = {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: { callbacks: { label: (ctx: any) => {
                const v = ctx.parsed?.y; return (v == null ? '—' : `${round1(v)} ${unit}`);
              } } }
        },
        scales: {
          x: { ticks: { maxRotation: 0 }, grid: { display: true, color: 'rgba(2,6,23,.06)' } },
          y: allNull
            ? { suggestedMin: 0, suggestedMax: 1, grid: { display: true, color: 'rgba(2,6,23,.06)' } }
            : { grid: { display: true, color: 'rgba(2,6,23,.06)' } }
        }
      }
    };
    const chart = new this.Chart(canvas.getContext('2d'), cfg);
    setChart(chart);
  }

  /** Weekly bars for Avg + dashed Min/Max line overlays, also with empty fallback */
  private renderWeekBars(
    canvas: HTMLCanvasElement | undefined,
    prev: any,
    setChart: (chart: any)=>void,
    labels: string[],
    avg: (number|null)[],
    min: (number|null)[],
    max: (number|null)[],
    unit: string
  ) {
    if (!canvas || !this.Chart) return;
    try { prev?.destroy?.(); } catch {}

    const hasAny = [avg,min,max].some(arr => (arr ?? []).some(v => v != null));

    const datasets: any[] = [
      { type: 'bar',  label: 'Avg (day)', data: avg, order: 2 },
      { type: 'line', label: 'Min (day)', data: min, borderDash: [6,4], pointRadius: 0, order: 1, spanGaps: true },
      { type: 'line', label: 'Max (day)', data: max, borderDash: [6,4], pointRadius: 0, order: 1, spanGaps: true }
    ];

    if (!hasAny) {
      datasets.push({
        type: 'bar',
        label: 'axes',
        data: labels.map(() => 0),
        backgroundColor: 'rgba(0,0,0,0)',
        borderColor: 'rgba(0,0,0,0)',
        order: 0
      });
    }

    const cfg = {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: { callbacks: { label: (ctx: any) => {
                const v = ctx.parsed?.y; return (v == null ? '—' : `${round1(v)} ${unit}`);
              } } }
        },
        scales: {
          x: { ticks: { maxRotation: 0 }, grid: { display: true, color: 'rgba(2,6,23,.06)' } },
          y: hasAny
            ? { grid: { display: true, color: 'rgba(2,6,23,.06)' } }
            : { suggestedMin: 0, suggestedMax: 1, grid: { display: true, color: 'rgba(2,6,23,.06)' } }
        }
      }
    };

    const chart = new this.Chart(canvas.getContext('2d'), cfg);
    setChart(chart);
  }

  private unitOf(m: MetricKey): string {
    switch (m) {
      case 'soilHumidity':
      case 'humidity': return '%';
      case 'luminosity': return 'lx';
      case 'barometer': return 'hPa';
      case 'temperature': return '°C';
    }
  }

  // ============ reading → metric value ============
  private valueFromReading(r: SensorReading, m: MetricKey): number | null {
    const o: any = this.payloadOf(r);
    const soilHumidity = this.getFirstNumeric(o?.analogInput)       ?? this.getFirstNumeric(o?.soilHumidity);
    const luminosity   = this.getFirstNumeric(o?.illuminanceSensor) ?? this.getFirstNumeric(o?.luminosity);
    const humidity     = this.getFirstNumeric(o?.humiditySensor)    ?? this.getFirstNumeric(o?.humidity);
    const barometer    = this.getFirstNumeric(o?.barometer);
    const temperature  = this.getFirstNumeric(o?.temperatureSensor) ?? this.getFirstNumeric(o?.temperature);
    switch (m) {
      case 'soilHumidity': return toNum(soilHumidity);
      case 'luminosity':   return toNum(luminosity);
      case 'humidity':     return toNum(humidity);
      case 'barometer':    return toNum(barometer);
      case 'temperature':  return toNum(temperature);
    }
  }

  // ===== helpers (payload parsing) =====
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

  private weekRange() {
    const nowW = new Date();
    const dow = nowW.getDay(); // 0=Sun..6=Sat
    const diffToMonday = (dow === 0 ? -6 : 1 - dow);
    const weekStart = new Date(nowW);
    weekStart.setDate(nowW.getDate() + diffToMonday);
    weekStart.setHours(0,0,0,0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23,59,59,999);
    const endIso = new Date(Math.min(weekEnd.getTime(), nowW.getTime())).toISOString();
    return { weekStart, weekEndOrNowIso: endIso };
  }

}

// tiny helpers
function toNum(x: any): number | null { if (x == null) return null; const n = Number(x); return Number.isFinite(n) ? n : null; }
function round1(n: number) { return Math.round(n * 10) / 10; }
function escapeHtml(s: string) { return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]!)); }
