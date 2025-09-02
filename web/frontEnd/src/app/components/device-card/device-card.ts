import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { DeviceWithLatest, MetricKey } from '../../models/device-with-latest.model';

@Component({
  selector: 'app-device-card',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './device-card.html',
  styleUrls: ['./device-card.css']
})
export class DeviceCard {
  @Input() device!: DeviceWithLatest;
  @Input() canCommand = false;
  @Input() busy = false;

  @Output() openChart = new EventEmitter<MetricKey>();
  @Output() openMap = new EventEmitter<void>();
  @Output() command = new EventEmitter<'OPEN'|'CLOSE'>();

  /** ✅ added so (openIrrigation)="..." works */
  @Output() openIrrigation = new EventEmitter<void>();

  accentFor(value: number | null | undefined, min: number, max: number | null | undefined): string {
    if (value === null || value === undefined || isNaN(value as number)) return 'hsl(220 10% 75%)';
    const hi = typeof max === 'number' && max > min ? max : (min + 1);
    const t = Math.min(1, Math.max(0, ((+value) - min) / (hi - min)));
    const hue = 10 + (230 - 10) * t;
    return `hsl(${Math.round(hue)} 86% 46%)`;
  }
  toPct(value: number | null | undefined, min: number, max: number | null | undefined): string {
    if (value === null || value === undefined || isNaN(value as number)) return '0%';
    const hi = typeof max === 'number' && max > min ? max : (min + 1);
    const t = Math.min(1, Math.max(0, ((+value) - min) / (hi - min)));
    return `${Math.round(t * 100)}%`;
  }
}
