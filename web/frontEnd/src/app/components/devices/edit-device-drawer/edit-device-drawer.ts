import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EndNodeDevice } from '../../../models/end-node-device.model';

// Reuse the same banner shape as "add" drawer
export type EditBanner = { kind: 'success' | 'error'; message: string } | null;

@Component({
  selector: 'app-edit-device-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-device-drawer.html',
  styleUrls: ['./edit-device-drawer.css']
})
export class EditDeviceDrawer implements OnChanges {
  @Input() open = false;
  @Input() device: EndNodeDevice | null = null;

  // provided by parent (not editable here)
  @Input() organizationId = '';
  @Input() userId = '';

  // NEW: parent-controlled UI state
  @Input() busy = false;
  @Input() status: EditBanner = null;

  @Output() closed = new EventEmitter<void>();
  @Output() saved  = new EventEmitter<EndNodeDevice>();

  // editable fields
  name = '';
  description = '';
  location = '';

  // read-only display
  devEui = '';
  statusText: 'ONLINE' | 'OFFLINE' | '' = '';

  touched = false;

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['open'] && this.open) || changes['device']) {
      this.initForm();
    }
  }

  private initForm(): void {
    const d = this.device;
    this.name        = d?.name ?? '';
    this.description = d?.description ?? '';

    // read-only values (just for display)
    this.devEui = d?.devEui ?? '';

    this.touched = false;
    // keep incoming banner as-is; parent decides when to clear it
  }

  get isValid(): boolean {
    return !!this.device?.id; // need an id to save
  }

  doClose() { this.closed.emit(); }

  submit() {
    this.touched = true;
    if (!this.isValid || !this.device?.id || this.busy) return;

    const payload: EndNodeDevice = {
      id: this.device.id,
      devEui: this.devEui,                 // read-only, still included for backend consistency
      name: this.name.trim(),
      description: this.description.trim() || undefined,
      organizationId: this.organizationId,
      userId: this.userId
    };

    this.saved.emit(payload);
  }
}
