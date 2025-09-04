import { Component, Inject, OnInit, PLATFORM_ID, Optional } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AuthService } from '../../services/authService/auth.service';
import { NgParticlesModule } from 'ng-particles';
import { ISourceOptions, Engine } from 'tsparticles-engine';
import { loadSlim } from 'tsparticles-slim';
import { OrganizationService } from '../../services/organizationService/organization';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgParticlesModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  errorMessage = '';
  expectedOrgId!: string;

  /** Displayed in the heading; defaults to the id if name lookup fails */
  orgDisplayName = '';

  particlesInit = async (engine: Engine): Promise<void> => {
    await loadSlim(engine);
  };

  particlesOptions: ISourceOptions = {
    background: { color: { value: '#001f3f' } },
    fpsLimit: 60,
    interactivity: {
      events: { onHover: { enable: true, mode: 'repulse' }, resize: true },
      modes: { push: { quantity: 4 }, repulse: { distance: 100, duration: 0.4 } }
    },
    particles: {
      color: { value: '#ffffff' },
      links: { color: '#ffffff', distance: 150, enable: true, opacity: 0.5, width: 1 },
      move: { enable: true, speed: 1, direction: 'none', outModes: { default: 'bounce' } },
      number: { density: { enable: true, area: 800 }, value: 100 },
      opacity: { value: 0.7 },
      shape: { type: 'circle' },
      size: { value: { min: 1, max: 3 } }
    },
    detectRetina: true
  };

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    @Optional() private orgSvc: OrganizationService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    // Grab org _id_ from URL
    this.expectedOrgId = this.route.snapshot.paramMap.get('org')!;
  }


  ngOnInit(): void {
    this.loginForm = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required]
    });

    // Resolve org id from route
    this.expectedOrgId = this.route.snapshot.paramMap.get('org')!;

    // 1) Hints from router state, query, or sessionStorage (works w/o auth)
    const hintedFromState = (history.state as any)?.orgName || '';
    const hintedFromQuery = this.route.snapshot.queryParamMap.get('name') || '';
    let hintedFromStore   = '';
    try { hintedFromStore = sessionStorage.getItem(`orgName:${this.expectedOrgId}`) || ''; } catch {}

    this.orgDisplayName =
      hintedFromState || hintedFromQuery || hintedFromStore || this.orgDisplayName || '';

    // 2) Try to fetch official name (if endpoint is public). If it fails, keep hint/id.
    if (this.orgSvc?.getById) {
      this.orgSvc.getById(this.expectedOrgId).subscribe({
        next: (org: any) => {
          if (org?.name) {
            this.orgDisplayName = org.name;
            try { sessionStorage.setItem(`orgName:${this.expectedOrgId}`, org.name); } catch {}
          } else {
            this.orgDisplayName = this.orgDisplayName || this.expectedOrgId;
          }
        },
        error: () => {
          this.orgDisplayName = this.orgDisplayName || this.expectedOrgId;
        }
      });
    } else {
      this.orgDisplayName = this.orgDisplayName || this.expectedOrgId;
    }
  }



  onSubmit(): void {
    if (this.loginForm.invalid) return;

    this.authService.login(this.loginForm.value).subscribe({
      next: ({ token }) => {
        this.authService.saveToken(token);

        // Compare the ID from the token to the route‐param ID
        const userOrgId = this.authService.getOrganizationFromToken();
        if (userOrgId !== this.expectedOrgId) {
          this.authService.logout();
          this.errorMessage = `Error: this account does not belong to the selected organization.`;
          return;
        }

        // Route by role
        if (this.authService.isAdmin()) {
          this.router.navigate(['/admin-dashboard']);
        } else if (this.authService.isClient()) {
          this.router.navigate(['/client-dashboard']);
        } else {
          this.errorMessage = 'Unknown user role.';
        }
      },
      error: () => this.errorMessage = 'Invalid username or password.'
    });
  }
}

