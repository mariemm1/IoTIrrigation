import { Component, EventEmitter, Input, Output, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Organization } from '../../../models/organization.model';
import { User } from '../../../models/user.model';
import { UserService } from '../../../services/userService/user';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-user-add',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-add.html',
  styleUrls: ['./user-add.css']
})
export class UserAddComponent implements OnChanges {
  @Input() open=false;
  @Input() organizations: Organization[] = [];
  @Input() users: User[] = [];
  @Input() presetRole: 'ADMIN'|'CLIENT' = 'CLIENT';

  @Output() closed = new EventEmitter<void>();
  @Output() created = new EventEmitter<User>();

  username=''; email=''; password=''; organizationId='';
  roleAdmin=false; roleClient=true;

  busy=false;
  banner:{kind:'success'|'error';message:string}|null=null;

  ngOnChanges(){
    if(this.open){
      // reset & apply preset role
      this.username=''; this.email=''; this.password='';
      this.organizationId='';
      this.roleAdmin = this.presetRole==='ADMIN';
      this.roleClient = this.presetRole==='CLIENT';
      this.banner=null;
    }
  }

  get usernameTaken():boolean {
    const n = this.username.trim().toLowerCase();
    return !!n && (this.users||[]).some(u => (u.username||'').toLowerCase()===n);
  }
  get emailTaken():boolean {
    const e = this.email.trim().toLowerCase();
    return !!e && (this.users||[]).some(u => (u.email||'').toLowerCase()===e);
  }

  get valid(){
    const hasRole = this.roleAdmin || this.roleClient; // one is locked by preset
    return !!this.username.trim()
      && !!this.email.trim()
      && !!this.password.trim()
      && !!this.organizationId
      && hasRole
      && !this.usernameTaken
      && !this.emailTaken;
  }

  lockLabel(): string {
    return this.presetRole==='ADMIN' ? 'Role: ADMIN (locked)' : 'Role: CLIENT (locked)';
  }

  close(){ this.closed.emit(); }

  constructor(private userSvc: UserService){}

  async submit(){
    if(!this.valid || this.busy) return;
    this.busy=true; this.banner=null;

    const roles = this.presetRole==='ADMIN' ? ['ADMIN'] : ['CLIENT'];

    try{
      const created = await firstValueFrom(this.userSvc.create({
        username: this.username.trim(),
        email: this.email.trim(),
        password: this.password,
        roles,
        organizationId: this.organizationId
      } as any));
      this.banner={kind:'success',message:'User created.'};
      this.created.emit(created);
    }catch(e:any){
      this.banner={kind:'error',message: e?.error?.error || 'Failed to create user.'};
    }finally{ this.busy=false; }
  }
}
