import { Component, ElementRef, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { Organization } from '../../../models/organization.model';
import { User } from '../../../models/user.model';
import { OrganizationService } from '../../../services/organizationService/organization';
import { UserService } from '../../../services/userService/user';

import { UserAddComponent } from '../user-add/user-add';
import { UserEditComponent } from '../user-edit/user-edit';

type Role = 'ADMIN' | 'CLIENT';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, FormsModule, UserAddComponent, UserEditComponent],
  templateUrl: './user-list.html',
  styleUrls: ['./user-list.css'],
})
export class UserListComponent implements OnInit, OnDestroy {
  orgs: Organization[] = [];
  users: User[] = [];

  loading = false;
  error: string | null = null;

  q = '';
  orgFilter: 'ALL' | string = 'ALL';
  roleFilter: 'ALL' | Role = 'ALL';

  orgMenuOpen = false;
  roleMenuOpen = false;

  addOpen = false;
  addPreset: Role | undefined;

  editOpen = false;
  toEdit: User | null = null;

  // 🔒 Scope the "click outside to close" to THIS drawer only
  private onDocClick = (ev: Event) => {
    if (!this.host.nativeElement.contains(ev.target as Node)) {
      this.orgMenuOpen = false;
      this.roleMenuOpen = false;
    }
  };

  constructor(
    private orgSvc: OrganizationService,
    private userSvc: UserService,
    private host: ElementRef<HTMLElement>
  ) {}

  ngOnInit(): void {
    this.reload();
    document.addEventListener('click', this.onDocClick, true);
  }
  ngOnDestroy(): void {
    document.removeEventListener('click', this.onDocClick, true);
  }

  reload(): void {
    this.loading = true; this.error = null;

    this.orgSvc.getAll().pipe(
      catchError(() => of([] as Organization[]))
    ).subscribe(orgs => this.orgs = orgs || []);

    this.userSvc.getAll().pipe(
      catchError(() => { this.error = 'Failed to load users.'; return of([] as User[]); })
    ).subscribe(list => { this.users = list || []; this.loading = false; });
  }

  onSearchChange(_v: string) {}

  orgIdOf(u: User): string | null {
    const id = (u as any)?.organizationId;
    return typeof id === 'string' ? id : null;
  }
  orgName(id: string | null | undefined): string {
    if (!id) return '—';
    return this.orgs.find(o => o.id === id)?.name || id;
  }
  rolesOf(u: User): string[] {
    const r = (u as any)?.roles;
    return Array.isArray(r) ? r : [];
  }
  trackById(index: number, u: User) {
    return (u as any).id ?? (u as any)._id ?? u.email ?? u.username ?? index;
  }

  get filtered(): User[] {
    const q = (this.q || '').trim().toLowerCase();
    const role = this.roleFilter;
    const org = this.orgFilter;

    return (this.users || []).filter(u => {
      const inSearch = !q ||
        (u.username || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q);

      const inOrg = org === 'ALL' || this.orgIdOf(u) === org;
      const inRole = role === 'ALL' || this.rolesOf(u).includes(role);

      return inSearch && inOrg && inRole;
    });
  }

  toggleOrgMenu(ev?: MouseEvent) { ev?.stopPropagation(); this.orgMenuOpen = !this.orgMenuOpen; this.roleMenuOpen = false; }
  toggleRoleMenu(ev?: MouseEvent) { ev?.stopPropagation(); this.roleMenuOpen = !this.roleMenuOpen; this.orgMenuOpen = false; }
  setOrgFilter(v: 'ALL' | string) { this.orgFilter = v; this.orgMenuOpen = false; }
  setRoleFilter(v: 'ALL' | Role)  { this.roleFilter = v; this.roleMenuOpen = false; }

  openAdd(role: Role) { this.addPreset = role; this.addOpen = true; }
  onAddClosed() { this.addOpen = false; this.addPreset = undefined; }
  onAdded() { this.onAddClosed(); this.reload(); }

  openEdit(u: User) { this.toEdit = u; this.editOpen = true; }
  onEditClosed() { this.editOpen = false; this.toEdit = null; }
  onEdited() { this.onEditClosed(); this.reload(); }

  del(u: User) {
    const label = (u as any).username || (u as any).email || 'this user';
    if (!window.confirm(`Delete ${label}?`)) return;
    const id = (u as any).id ?? (u as any)._id;
    (this.userSvc as any).delete?.(id)?.pipe(catchError(() => of(null))).subscribe(() => this.reload());
  }
}
