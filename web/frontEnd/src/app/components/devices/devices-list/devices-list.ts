import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DeviceWithLatest } from '../../../models/device-with-latest.model';

@Component({
  selector: 'app-devices-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './devices-list.html',
  styleUrls: ['./devices-list.css']
})
export class DevicesList {
  @Input() devices: DeviceWithLatest[] = [];

  @Output() openMap = new EventEmitter<DeviceWithLatest>();
  @Output() edit = new EventEmitter<DeviceWithLatest>();
  @Output() delete = new EventEmitter<DeviceWithLatest>();

  trackByDevEui = (_: number, d: DeviceWithLatest) => d.devEui;
}
