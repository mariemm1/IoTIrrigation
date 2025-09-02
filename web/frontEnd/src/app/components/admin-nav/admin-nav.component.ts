import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Organization } from '../../models/organization.model';
import { DeviceWithLatest } from '../../models/device-with-latest.model';

type RichDevice = DeviceWithLatest & { name?: string };

@Component({
  selector: 'app-admin-nav',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-nav.component.html',
  styleUrls: ['./admin-nav.component.css']
})
export class AdminNavComponent {
  @Input() organizations: Organization[] = [];
  @Input() orgDevices: Record<string, RichDevice[]> = {};
  @Input() selectedOrgId: string | null = null;
  @Input() selectedDevEuiAdmin: string | null = null;

  // collapsible states
  usersOpen = true;
  orgsOpen  = true;

  // Devices section state
  devicesOpen = true;
  private expandedDevOrg: Record<string, boolean> = {};

  // (kept for compatibility elsewhere)
  expandedOrgId: string | null = null;

  // users actions
  @Output() addUserAdmin = new EventEmitter<void>();
  @Output() addUserClient = new EventEmitter<void>();
  @Output() listUsers = new EventEmitter<void>();

  // org actions
  @Output() addOrganization = new EventEmitter<void>();
  @Output() listOrganizations = new EventEmitter<void>();
  @Output() selectOrganization = new EventEmitter<Organization>();

  // device actions (scoped)
  @Output() addDeviceGlobal = new EventEmitter<void>();
  @Output() addDeviceForOrg = new EventEmitter<string>();
  @Output() listDevices = new EventEmitter<void>();
  @Output() selectDeviceAdmin = new EventEmitter<RichDevice>();
  @Output() editDeviceAdmin = new EventEmitter<RichDevice>();
  @Output() deleteDeviceAdmin = new EventEmitter<RichDevice>();

  toggleUsers(){ this.usersOpen = !this.usersOpen; }
  toggleOrgs(){ this.orgsOpen = !this.orgsOpen; }

  // Devices section toggles
  toggleDevices(){ this.devicesOpen = !this.devicesOpen; }
  toggleDevOrg(o: Organization){
    const id = o.id ?? '';
    this.expandedDevOrg[id] = !this.expandedDevOrg[id];
  }
  isDevOrgOpen(o: Organization){ return !!this.expandedDevOrg[o.id ?? '']; }

  devCountFor(o: Organization): number {
    return (this.orgDevices[o.id!] || []).length;
  }

  isSelectedOrg(o: Organization){ return this.selectedOrgId === o.id; }
  isSelectedDev(d: RichDevice){ return this.selectedDevEuiAdmin === d.devEui; }

  /** ✅ Safe helper to avoid 'undefined cannot be used as an index type' */
  devsFor(o: Organization): RichDevice[] {
    const key = o?.id ?? '';
    return this.orgDevices[key] || [];
  }
}
