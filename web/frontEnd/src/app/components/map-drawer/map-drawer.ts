import { Component, EventEmitter, Inject, Input, OnChanges, Output, PLATFORM_ID, SimpleChanges } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { DeviceWithLatest, MetricKey } from '../../models/device-with-latest.model';

@Component({
  selector: 'app-map-drawer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map-drawer.html',
  styleUrls: ['./map-drawer.css']
})
export class MapDrawer implements OnChanges {
  @Input() open = false;
  @Input() devices: DeviceWithLatest[] = [];
  @Input() focus?: DeviceWithLatest;
  @Input() orgLat: number | null = null;
  @Input() orgLng: number | null = null;
  @Input() metric: MetricKey = 'temperature';
  @Output() closed = new EventEmitter<void>();

  private L?: any;
  private map?: any;
  private baseStreets?: any;
  private baseSatellite?: any;
  private layerCtl?: any;
  private markers = new Map<string, any>();

  legendSteps: { color: string; label: string }[] = [];

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      setTimeout(() => this.ensureMapReady(), 0);
    }
    if (this.open && this.map && (changes['devices'] || changes['metric'])) {
      this.rebuildMarkers();
      this.fitOrFocus();
    }
    if (this.open && this.map && changes['focus']) this.fitOrFocus();
  }

  doClose() { this.closed.emit(); }

  private valueFromLatest(latest: DeviceWithLatest['latest'] | undefined, m: MetricKey): number | null {
    if (!latest) return null;
    switch (m) {
      case 'soilHumidity': return latest.soilHumidity ?? null;
      case 'luminosity':  return latest.luminosity ?? null;
      case 'humidity':    return latest.humidity ?? null;
      case 'barometer':   return latest.barometer ?? null;
      default:            return latest.temperature ?? null;
    }
  }

  private async ensureLeaflet(): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || this.L) return;
    const mod = await import('leaflet');
    this.L = (mod as any).default ?? mod;   // <-- important
  }


  private async ensureMapReady(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    await this.ensureLeaflet();
    const L = this.L!;
    if (!this.map) {
      this.map = L.map('deviceMap', { zoomControl: true, attributionControl: true });
      this.baseStreets = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        { attribution: '&copy; OpenStreetMap contributors' }
      ).addTo(this.map);
      this.baseSatellite = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics' }
      );
      this.layerCtl = L.control.layers(
        { Streets: this.baseStreets, Satellite: this.baseSatellite }
      ).addTo(this.map);

      if (this.orgLat != null && this.orgLng != null) this.map.setView([this.orgLat, this.orgLng], 12);
      else this.map.setView([34, 9], 5);
    }
    this.rebuildMarkers();
    this.fitOrFocus();
  }

  private fitOrFocus() {
    const f = this.focus;
    const focusKey = f ? ((f as any).id ?? f.devEui) : undefined;
    if (f?.lat != null && f?.lng != null) {
      this.map!.setView([f.lat!, f.lng!], 13);
      const m = focusKey ? this.markers.get(focusKey) : undefined;
      if (m) m.openPopup();
    } else {
      const pts = Array.from(this.markers.values()).map(m => m.getLatLng());
      if (pts.length) this.map!.fitBounds(this.L!.latLngBounds(pts), { padding: [28, 28] });
      else if (this.orgLat != null && this.orgLng != null) this.map!.setView([this.orgLat, this.orgLng], 12);
    }
  }

  private rebuildMarkers(): void {
    if (!this.map || !this.L) return;
    const L = this.L;

    // clear
    this.markers.forEach(m => this.map!.removeLayer(m));
    this.markers.clear();

    // legend scale
    let vals: number[] = [];
    for (const d of this.devices) {
      const v = this.valueFromLatest(d.latest, this.metric);
      if (typeof v === 'number' && Number.isFinite(v)) vals.push(v);
    }
    const min = vals.length ? Math.min(...vals) : 0;
    const max = vals.length ? Math.max(...vals) : 1;
    const bins = 7; const step = (max - min) / bins || 1;
    const color = (i:number) => {
      const t = i/bins;
      const hue = 220 + (10 - 220) * t; // blue->red
      return `hsl(${Math.round(hue)} 85% 50%)`;
    };
    this.legendSteps = [];
    for (let i=0;i<bins;i++) {
      const lo = (min + i*step);
      const hi = (i===bins-1) ? max : (min + (i+1)*step);
      this.legendSteps.push({ color: color(i+0.5), label: `${lo.toFixed(0)} – ${hi.toFixed(0)} ${this.unitFor(this.metric)}` });
    }
    const colorFor = (v: number | null) => {
      if (v == null || !Number.isFinite(v)) return '#9ca3af';
      const idx = Math.min(bins-1, Math.max(0, Math.floor((v - min) / step)));
      return color(idx+0.5);
    };

    const focusKey = this.focus ? ((this.focus as any).id ?? this.focus.devEui) : undefined;

    // markers
    for (const d of this.devices) {
      if ((d as any).lat == null || (d as any).lng == null) continue;
      const v = this.valueFromLatest(d.latest, this.metric);
      const key = (d as any).id ?? d.devEui;
      const isFocus = focusKey === key;

      const icon = L.divIcon({
        className: 'dev-marker leaflet-div-icon',
        html: `<div class="pin${isFocus ? ' selected' : ''}" style="--pin-color:${colorFor(v)}"><span class="pin-dot"></span></div>`,
        iconSize: [26, 26], iconAnchor: [13, 26]
      });

      const marker = L.marker([(d as any).lat, (d as any).lng], { icon })
        .bindPopup(this.markerPopupHtml(d, v), { closeButton: true });

      marker.addTo(this.map!);
      this.markers.set(key, marker);
      if (isFocus) marker.openPopup();
    }
  }

  unitFor(m: MetricKey) { return m === 'barometer' ? 'hPa' : (m === 'luminosity' ? 'lx' : (m === 'temperature' ? '°C' : '%')); }
  private titleFor(m: MetricKey): string {
    switch (m) {
      case 'soilHumidity': return 'Soil Humidity';
      case 'luminosity': return 'Luminosity';
      case 'humidity': return 'Humidity';
      case 'barometer': return 'Barometer';
      default: return 'Temperature';
    }
  }

  private markerPopupHtml(d: DeviceWithLatest, v: number | null): string {
    const Lst = d.latest;
    const ts = Lst?.timestamp ? new Date(Lst.timestamp).toLocaleString() : '—';
    const unit = this.unitFor(this.metric);
    const display = (v==null || Number.isNaN(v)) ? '—' : v;
    return `
      <div class="pop">
        <div class="p-title">${(d as any).name || d.devEui}</div>
        <div class="p-sub">${d.devEui}</div>
        <div class="p-grid">
          <div><b>${this.titleFor(this.metric)}</b> ${display} ${unit}</div>
        </div>
        <div class="p-ts">${ts}</div>
      </div>`;
  }
}
