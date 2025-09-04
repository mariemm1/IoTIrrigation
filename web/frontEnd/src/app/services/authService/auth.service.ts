// src/app/services/authService/auth.service.ts
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { JwtHelperService } from '@auth0/angular-jwt';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = '/api/auth';
  private token = '';
  private helper = new JwtHelperService();

  public isLoggedIn = false;
  public roles?: string;
  public loggedUsername?: string;

  private orgId?: string;
  private orgName?: string;

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  // ---- SSR-safe storage helpers ------------------------------------------------
  private get hasBrowser(): boolean {
    return isPlatformBrowser(this.platformId) && typeof localStorage !== 'undefined';
  }
  private lsGet(key: string): string | null {
    return this.hasBrowser ? localStorage.getItem(key) : null;
  }
  private lsSet(key: string, val: string): void {
    if (this.hasBrowser) localStorage.setItem(key, val);
  }
  private lsRemove(key: string): void {
    if (this.hasBrowser) localStorage.removeItem(key);
  }

  // ---- Auth API ----------------------------------------------------------------
  login(data: { username: string; password: string }): Observable<{ token: string }> {
    return this.http.post<{ token: string }>(`${this.apiUrl}/login`, data);
  }

  saveToken(token: string): void {
    this.token = token;
    this.isLoggedIn = true;
    this.lsSet('jwt', token);
    this.lsSet('isLoggedIn', 'true');

    this.decodeJWT();

    const userId = this.getUserIdFromToken();
    if (userId)              this.lsSet('userId', userId);
    if (this.roles)          this.lsSet('role', this.roles);
    if (this.orgId)          this.lsSet('orgId', this.orgId);
    if (this.orgName)        this.lsSet('orgName', this.orgName);
    if (this.loggedUsername) this.lsSet('username', this.loggedUsername);

    // NEW: also store JWT in a cookie so SSR can read it on first render/refresh
    if (this.hasBrowser) {
      const decoded: any = this.helper.decodeToken(token) || {};
      const nowSec = Math.floor(Date.now() / 1000);
      const maxAge = typeof decoded?.exp === 'number'
        ? Math.max(0, decoded.exp - nowSec)
        : 7 * 24 * 60 * 60; // fallback 7 days
      document.cookie = `jwt=${token}; Path=/; SameSite=Lax; Max-Age=${maxAge}`;
    }
  }

  loadToken(): void {
    const stored = this.lsGet('jwt');
    if (stored) {
      this.token = stored;
      this.decodeJWT();
      this.isLoggedIn = !this.helper.isTokenExpired(stored);

      // hydrate cached org info from storage if missing
      this.orgId   = this.orgId   || this.lsGet('orgId')   || undefined;
      this.orgName = this.orgName || this.lsGet('orgName') || undefined;
      this.roles   = this.roles   || this.lsGet('role')    || (undefined as any);
      this.loggedUsername = this.loggedUsername || this.lsGet('username') || undefined;
    }
  }

  private decodeJWT(): void {
    if (!this.token) return;
    const decoded: any = this.helper.decodeToken(this.token) || {};

    this.loggedUsername = decoded.sub;
    this.roles = decoded.role;

    this.orgId =
      decoded.organizationId ??
      decoded.orgId ??
      decoded.tenantId ??
      decoded.org ??
      this.orgId;

    const nameClaim =
      decoded.organizationName ??
      decoded.orgName ??
      decoded.tenantName ??
      decoded.organization ??
      decoded.org ??
      null;

    this.orgName = typeof nameClaim === 'string' ? nameClaim : this.orgName;
  }

  logout(): void {
    const org = this.orgId || this.lsGet('orgId') || '';

    this.token = '';
    this.roles = undefined;
    this.loggedUsername = undefined;
    this.orgId = undefined;
    this.orgName = undefined;
    this.isLoggedIn = false;

    this.lsRemove('jwt');
    this.lsRemove('isLoggedIn');
    this.lsRemove('userId');
    this.lsRemove('role');
    this.lsRemove('orgId');
    this.lsRemove('orgName');
    this.lsRemove('username');

    // NEW: clear cookie too
    if (this.hasBrowser) {
      document.cookie = 'jwt=; Path=/; Max-Age=0; SameSite=Lax';
    }

    this.router.navigate(['/login', org]);
  }

  // ---- Helpers -----------------------------------------------------------------
  getToken(): string {
    if (!this.token) this.token = this.lsGet('jwt') || '';
    return this.token;
  }

  isAuthenticated(): boolean {
    const t = this.getToken();
    return !!t && !this.helper.isTokenExpired(t);
  }

  isTokenExpired(): boolean {
    return this.helper.isTokenExpired(this.getToken());
  }

  getRoleFromToken(): string | null {
    return this.roles || this.lsGet('role');
  }

  isAdmin(): boolean {
    return this.getRoleFromToken() === 'ADMIN';
  }

  isClient(): boolean {
    return this.getRoleFromToken() === 'CLIENT';
  }

  getUserIdFromToken(): string {
    const decoded: any = this.helper.decodeToken(this.getToken()) || {};
    return decoded.id?.toString() || '';
  }

  getUsername(): string | null {
    return this.loggedUsername || this.lsGet('username');
  }

  getHeaders(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.getToken()}` });
  }

  getOrganizationFromToken(): string {
    return this.orgId || this.lsGet('orgId') || '';
  }

  getOrganizationNameFromToken(): string {
    return this.orgName || this.lsGet('orgName') || '';
  }
}

