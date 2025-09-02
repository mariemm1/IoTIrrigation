import { Injectable } from '@angular/core';
import {
  CanActivate,
  Router,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree
} from '@angular/router';
import { AuthService } from '../../services/authService/auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean | UrlTree {
    // Hydrate token/claims if we're in the browser; no-op on server
    this.authService.loadToken();

    if (this.authService.isAuthenticated()) {
      return true;
    }

    const orgId = this.authService.getOrganizationFromToken() || '';
    return this.router.createUrlTree(
      ['/login', orgId],
      { queryParams: { returnUrl: state.url } }
    );
  }
}
