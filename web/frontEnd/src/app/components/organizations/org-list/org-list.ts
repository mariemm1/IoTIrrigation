import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Organization } from '../../../models/organization.model';
import { OrganizationService } from '../../../services/organizationService/organization';
import { firstValueFrom } from 'rxjs';
import { OrgAddComponent } from '../org-add/org-add';
import { OrgEditComponent } from '../org-edit/org-edit';
import {FormsModule} from '@angular/forms';

@Component({
  selector: 'app-org-list',
  standalone: true,
  imports: [CommonModule, OrgAddComponent, OrgEditComponent,FormsModule],
  templateUrl: './org-list.html',
  styleUrls: ['./org-list.css']
})
export class OrgListComponent implements OnInit {
  constructor(private orgSvc: OrganizationService) {}

  orgs: Organization[] = [];
  loading=false; error: string|null=null;

  q='';

  addOpen=false;
  editOpen=false;
  toEdit: Organization | null = null;

  async ngOnInit(){ await this.refresh(); }

  async refresh(){
    this.loading=true; this.error=null;
    try{ this.orgs = await firstValueFrom(this.orgSvc.getAll()); }
    catch{ this.error='Failed to load organizations.'; }
    finally{ this.loading=false; }
  }

  get filtered(): Organization[] {
    const qq = this.q.trim().toLowerCase();
    if(!qq) return this.orgs;
    return this.orgs.filter(o =>
      [o.name, o.address, o.contactEmail, o.contactPhone]
        .some(v => (v||'').toLowerCase().includes(qq))
    );
  }

  openAdd(){ this.addOpen=true; }
  onAdded(){ this.addOpen=false; this.refresh(); }
  onAddClosed(){ this.addOpen=false; }

  openEdit(o:Organization){ this.toEdit=o; this.editOpen=true; }
  onEdited(){ this.editOpen=false; this.refresh(); }
  onEditClosed(){ this.editOpen=false; }

  async del(o:Organization){
    if(!o.id) return;
    const ok = window.confirm(`Delete organization "${o.name}"?`);
    if(!ok) return;
    try{ await firstValueFrom(this.orgSvc.delete(o.id)); await this.refresh(); }
    catch{ window.alert('Delete failed.'); }
  }

  trackById = (_:number, x:Organization)=> x.id!;
}
