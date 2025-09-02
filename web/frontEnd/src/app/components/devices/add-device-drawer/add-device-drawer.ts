import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EndNodeDevice } from '../../../models/end-node-device.model';

export type AddBanner = { kind: 'success' | 'error'; message: string } | null;

@Component({
  selector: 'app-add-device-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-device-drawer.html',
  styleUrls: ['./add-device-drawer.css']
})
export class AddDeviceDrawer implements OnChanges {
  @Input() open = false;
  @Input() organizationId = '';
  @Input() userId = '';

  // controlled by parent (dashboard)
  @Input() busy = false;
  @Input() status: AddBanner = null;

  @Output() closed = new EventEmitter<void>();
  @Output() saved  = new EventEmitter<EndNodeDevice>();

  devEui = '';
  touched = false;

  ngOnChanges(changes: SimpleChanges): void {
    // Reset form every time it opens
    if (changes['open'] && this.open) {
      this.devEui = '';
      this.touched = false;
      // parent may keep/clear status; do not override here
    }
  }

  get isValid(): boolean {
    return this.devEui.trim().length > 0;
  }

  doClose() { this.closed.emit(); }

  submit() {
    this.touched = true;
    if (!this.isValid || this.busy) return;

    const payload: EndNodeDevice = {
      devEui: this.devEui.trim(),
      organizationId: this.organizationId,
      userId: this.userId
    };
    this.saved.emit(payload);
  }
}
