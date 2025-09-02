import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Organization } from '../../../models/organization.model';
import { OrganizationService } from '../../../services/organizationService/organization';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-org-add',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './org-add.html',
  styleUrls: ['./org-add.css']
})
export class OrgAddComponent implements OnChanges {
  constructor(private orgSvc: OrganizationService) {}

  @Input() open = false;
  @Output() closed = new EventEmitter<void>();
  @Output() created = new EventEmitter<Organization>();

  name = '';
  address = '';
  contactEmail = '';
  contactPhone = '';
  description = '';
  busy = false;
  banner: {kind:'success'|'error';message:string}|null = null;

  private existingNames = new Set<string>();

  async ngOnChanges(changes: SimpleChanges) {
    // whenever the drawer is opened, (re)load names for duplicate check
    if (changes['open']?.currentValue === true) {
      await this.reloadNames();
      this.banner = null;
    }
  }

  get valid() { return !!this.name.trim() && !this.nameTaken; }

  get nameTaken(): boolean {
    return !!this.name.trim() && this.existingNames.has(this.name.trim().toLowerCase());
  }

  async reloadNames(){
    try{
      const orgs = await firstValueFrom(this.orgSvc.getAll());
      this.existingNames = new Set((orgs||[]).map(o => (o.name||'').toLowerCase()));
    }catch{ this.existingNames = new Set(); }
  }

  close(){ this.closed.emit(); }

  async submit(){
    if(!this.valid || this.busy) return;
    this.busy = true; this.banner = null;
    const payload: Organization = {
      name: this.name.trim(),
      address: this.address.trim() || undefined,
      contactEmail: this.contactEmail.trim() || undefined,
      contactPhone: this.contactPhone.trim() || undefined,
      description: this.description.trim() || undefined,
    };
    try{
      const created = await firstValueFrom(this.orgSvc.create(payload));
      this.banner = {kind:'success',message:'Organization created.'};
      this.created.emit(created);
    }catch(e:any){
      this.banner = {kind:'error',message: e?.error?.error || 'Failed to create organization.'};
    }finally{ this.busy = false; }
  }
}
