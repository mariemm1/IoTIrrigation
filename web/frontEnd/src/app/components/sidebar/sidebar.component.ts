import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DeviceWithLatest } from '../../models/device-with-latest.model';
import { Organization } from '../../models/organization.model';

type AdminAddUserRole = 'ADMIN' | 'CLIENT';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent {
  /**
   * ======== CLIENT MODE (existing) ========
   * Keep the original API intact.
   */
  @Input() devices: DeviceWithLatest[] = [];

  /** select a device from the list (client mode) */
  @Output() selectDevice = new EventEmitter<DeviceWithLatest>();

  /** add / edit / delete from the sidebar (client mode) */
  @Output() addDevice = new EventEmitter<void>();
  @Output() editDevice = new EventEmitter<DeviceWithLatest>();
  @Output() deleteDevice = new EventEmitter<DeviceWithLatest>();

  trackByDevEui = (_: number, d: DeviceWithLatest) => d.devEui;

  onRowClick(d: DeviceWithLatest, ev: Event) {
    ev.preventDefault();
    ev.stopPropagation();
    this.selectDevice.emit(d);
  }

  /**
   * ======== ADMIN MODE (new, optional) ========
   * If you provide organizations (and optionally orgDevices),
   * the component renders the admin view instead of the client one.
   * Nothing else changes for client usage.
   */
  @Input() organizations: Organization[] = [];
  /** Map orgId -> devices in that organization */
  @Input() orgDevices: Record<string, DeviceWithLatest[]> = {};
  /** Optional selection highlights */
  @Input() selectedOrgId: string | null = null;
  @Input() selectedDevEuiAdmin: string | null = null;

  // Organization actions
  @Output() addOrganization = new EventEmitter<void>();
  @Output() listOrganizations = new EventEmitter<void>();
  @Output() selectOrganization = new EventEmitter<Organization>();
  @Output() editOrganization = new EventEmitter<Organization>();
  @Output() deleteOrganization = new EventEmitter<Organization>();

  // Admin user actions (optional)
  @Output() addUser = new EventEmitter<AdminAddUserRole>();
  @Output() listUsers = new EventEmitter<void>();

  // Device actions in admin context
  @Output() addDeviceForOrg = new EventEmitter<string>(); // orgId
  @Output() listDevices = new EventEmitter<void>();
  @Output() selectDeviceAdmin = new EventEmitter<DeviceWithLatest>();
  @Output() editDeviceAdmin = new EventEmitter<DeviceWithLatest>();
  @Output() deleteDeviceAdmin = new EventEmitter<DeviceWithLatest>();

  // Map open (global)
  @Output() openMap = new EventEmitter<void>();

  /** expanded org ids */
  expanded = new Set<string>();

  isAdminMode(): boolean {
    // If organizations are provided, treat as admin mode.
    return Array.isArray(this.organizations) && this.organizations.length > 0;
  }

  toggleOrg(id: string) {
    if (this.expanded.has(id)) this.expanded.delete(id);
    else this.expanded.add(id);
  }
  isExpanded(id: string): boolean { return this.expanded.has(id); }

  // trackBys
  trackOrg = (_: number, o: Organization) => o.id as string;
  trackDevAdmin = (_: number, d: DeviceWithLatest) => d.devEui;

  // helpers
  deviceCount(o: Organization): number {
    return (this.orgDevices?.[o.id || ''] || []).length;
  }

  // clicks (admin)
  clickOrg(o: Organization, ev?: Event) {
    ev?.preventDefault(); ev?.stopPropagation();
    this.selectOrganization.emit(o);
  }
  clickDevAdmin(d: DeviceWithLatest, ev?: Event) {
    ev?.preventDefault(); ev?.stopPropagation();
    this.selectDeviceAdmin.emit(d);
  }
}
