import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Organization } from '../../../models/organization.model';
import { OrganizationService } from '../../../services/organizationService/organization';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-org-edit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './org-edit.html',
  styleUrls: ['./org-edit.css']
})
export class OrgEditComponent implements OnChanges {
  constructor(private orgSvc: OrganizationService) {}

  @Input() open = false;
  @Input() org: Organization | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<Organization>();

  name=''; address=''; contactEmail=''; contactPhone=''; description='';
  busy=false;
  banner:{kind:'success'|'error';message:string}|null=null;

  ngOnChanges(){
    const o = this.org;
    this.name=o?.name||''; this.address=o?.address||''; this.contactEmail=o?.contactEmail||'';
    this.contactPhone=o?.contactPhone||''; this.description=o?.description||'';
    this.banner=null;
  }

  get valid(){ return !!this.name.trim(); }
  close(){ this.closed.emit(); }

  async submit(){
    if(!this.valid || !this.org?.id || this.busy) return;
    this.busy=true; this.banner=null;
    try{
      const updated = await firstValueFrom(this.orgSvc.update(this.org.id, {
        id:this.org.id, name:this.name.trim(),
        address:this.address.trim()||undefined,
        contactEmail:this.contactEmail.trim()||undefined,
        contactPhone:this.contactPhone.trim()||undefined,
        description:this.description.trim()||undefined
      }));
      this.banner={kind:'success',message:'Organization saved.'};
      this.saved.emit(updated);
    }catch(e:any){
      this.banner={kind:'error',message:e?.error?.error||'Failed to save organization.'};
    }finally{ this.busy=false; }
  }
}
