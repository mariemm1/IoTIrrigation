import {
  Component, Input, Output, EventEmitter, OnChanges, SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type Role = 'ADMIN' | 'CLIENT';
interface Org { id?: string; name?: string; }
interface EditUser {
  id?: string;
  username?: string;
  email?: string;
  organizationId?: string;
  roles?: Role[];
}

@Component({
  selector: 'app-user-edit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-edit.html',
  styleUrls: ['./user-edit.css']
})
export class UserEditComponent implements OnChanges {
  /** Drawer control */
  @Input() open = false;

  /** User being edited */
  @Input() user: EditUser | null = null;

  /** For read-only org name lookup + duplicate checks */
  @Input() organizations: Org[] = [];
  @Input() users: EditUser[] = [];

  /** Events */
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<{ id: string; patch: Partial<EditUser> & { password?: string } }>();

  // UI/banners
  busy = false;
  banner: { kind: 'success' | 'error'; message: string } | null = null;

  // form fields (roles/org displayed as read-only)
  private _username = '';
  get username() { return this._username; }
  set username(v: string) { this._username = (v ?? '').trimStart(); this.checkDup(); }

  private _email = '';
  get email() { return this._email; }
  set email(v: string) { this._email = (v ?? '').trim(); this.checkDup(); }

  password = '';

  organizationId: string | null = null;
  roleAdmin = false;
  roleClient = false;

  // duplicate flags
  usernameTaken = false;
  emailTaken = false;

  // originals so we don’t flag unchanged values as duplicates
  private originalUsername = '';
  private originalEmail = '';

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['user']) this.hydrateFromInput();
  }

  private hydrateFromInput(): void {
    const u = this.user || {};
    this.originalUsername = u.username || '';
    this.originalEmail = u.email || '';

    this._username = this.originalUsername;
    this._email = this.originalEmail;
    this.password = '';

    this.organizationId = u.organizationId || null;

    const roles = (u.roles || []) as Role[];
    this.roleAdmin = roles.includes('ADMIN');
    this.roleClient = roles.includes('CLIENT');

    this.usernameTaken = false;
    this.emailTaken = false;
    this.banner = null;
  }

  /** Display name for read-only org block */
  orgName(id?: string | null): string {
    if (!id) return '—';
    return this.organizations.find(o => o.id === id)?.name || id;
  }

  /** live duplicate checks for username/email */
  private checkDup(): void {
    const meId = (this.user?.id || '').toString();
    const uname = (this._username || '').trim().toLowerCase();
    const email = (this._email || '').trim().toLowerCase();

    this.usernameTaken =
      !!uname &&
      uname !== this.originalUsername.toLowerCase() &&
      this.users.some(u => (u.id || '').toString() !== meId && (u.username || '').toLowerCase() === uname);

    this.emailTaken =
      !!email &&
      email !== this.originalEmail.toLowerCase() &&
      this.users.some(u => (u.id || '').toString() !== meId && (u.email || '').toLowerCase() === email);
  }

  /** overall validity used by Save button */
  get valid(): boolean {
    if (!this.username?.trim() || !this.email?.trim()) return false;
    if (this.usernameTaken || this.emailTaken) return false;
    // minimal email format check
    const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email);
    return okEmail;
  }

  /** Close drawer */
  close(): void {
    if (this.busy) return;
    this.closed.emit();
  }

  /** Save (roles + organization are read-only → not sent) */
  async submit(): Promise<void> {
    if (!this.valid || !this.user?.id) return;

    this.busy = true;
    this.banner = null;

    // Only allow username/email/password to change here
    const patch: Partial<EditUser> & { password?: string } = {
      username: this.username.trim(),
      email: this.email.trim()
    };
    if (this.password?.length) patch.password = this.password;

    try {
      this.saved.emit({ id: this.user.id as string, patch });
      this.banner = { kind: 'success', message: 'User saved.' };
    } catch {
      this.banner = { kind: 'error', message: 'Failed to save user.' };
    } finally {
      this.busy = false;
    }
  }
}
