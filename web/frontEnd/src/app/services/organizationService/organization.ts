// src/app/services/organizationService/organization.ts
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { Organization } from '../../models/organization.model';

@Injectable({ providedIn: 'root' })
export class OrganizationService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private base = '/api/organizations';

  /** Avoid SSR HTTP calls; return empty list during prerender/SSR */
  getAll(): Observable<Organization[]> {
    if (!this.isBrowser) return of([]);
    return this.http.get<Organization[]>(`${this.base}/all`);
  }

  getById(id: string): Observable<Organization> {
    if (!this.isBrowser) return of({} as Organization);
    return this.http.get<Organization>(`${this.base}/${id}`);
  }

  create(org: Organization): Observable<Organization> {
    return this.http.post<Organization>(`${this.base}/create`, org);
  }

  update(id: string, org: Organization): Observable<Organization> {
    return this.http.put<Organization>(`${this.base}/update/${id}`, org);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/delete/${id}`);
  }
}
