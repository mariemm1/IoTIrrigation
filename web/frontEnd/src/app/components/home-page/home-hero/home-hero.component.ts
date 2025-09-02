import { Component, AfterViewInit, Inject, PLATFORM_ID, OnInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrganizationService } from '../../../services/organizationService/organization';
import { Router } from '@angular/router';
import { Organization } from '../../../models/organization.model';

@Component({
  selector: 'app-home-hero',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home-hero.component.html',
  styleUrls: ['./home-hero.component.css'],
})
export class HomeHeroComponent implements OnInit, AfterViewInit {
  selectedOrgId = '';
  organizations: Organization[] = [];

  // Leaflet
  private L: any;
  private map!: any;

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private orgService: OrganizationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.orgService.getAll().subscribe({
      next: (orgs) => (this.organizations = orgs || []),
      error: () => (this.organizations = []),
    });
  }

  // async ngAfterViewInit(): Promise<void> {
  //   if (!isPlatformBrowser(this.platformId)) return;
  //
  //   this.L = await import('leaflet');
  //   this.map = this.L.map('map-home', {
  //     center: [20, 0],
  //     zoom: 2,
  //     zoomControl: false,
  //     attributionControl: false,
  //   });
  //
  //   this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  //     opacity: 0.7,
  //     maxZoom: 17,
  //   }).addTo(this.map);
  //
  //   // demo pulse markers
  //   [[36.8, 10.2], [48.8566, 2.3522], [25.2048, 55.2708]].forEach(([lat, lng]) =>
  //     this.addPulse(lat, lng)
  //   );
  // }

  async ngAfterViewInit(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    const leafletMod = await import('leaflet');
    this.L = (leafletMod as any).default ?? leafletMod;   // <— important

    this.map = this.L.map('map-home', {
      center: [20, 0],
      zoom: 2,
      zoomControl: false,
      attributionControl: false,
    });

    this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      opacity: 0.7,
      maxZoom: 17,
    }).addTo(this.map);

    [[36.8, 10.2],[48.8566,2.3522],[25.2048,55.2708]].forEach(([lat,lng]) => this.addPulse(lat,lng));
  }

  private addPulse(lat: number, lng: number) {
    const icon = this.L.divIcon({
      className: 'pulse-marker',
      html: `<div class="pulse"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
    this.L.marker([lat, lng], { icon }).addTo(this.map);
  }

  /** Safely get id whether backend returns `id` or `_id` */
  getOrgId(o: any): string {
    return (o && (o._id ?? o.id)) || '';
  }

  goToLogin(): void {
    if (!this.selectedOrgId) return;

    const org: any = this.organizations.find(
      (o: any) => this.getOrgId(o) === this.selectedOrgId
    );

    const id = this.getOrgId(org) || this.selectedOrgId;
    const name = org?.name ?? org?.title ?? '';

    try { sessionStorage.setItem(`orgName:${id}`, name); } catch {}

    this.router.navigate(['/login', id], {
      state: { orgName: name },
      queryParams: name ? { name } : undefined,
    });
  }
}
