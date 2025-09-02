import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // prerender just the root ("/")
  { path: '', renderMode: RenderMode.Prerender },

  // dynamic routes -> render on server at request time (no prerender)
  { path: 'home', renderMode: RenderMode.Server },
  { path: 'login/:org', renderMode: RenderMode.Server },
  { path: 'admin-dashboard', renderMode: RenderMode.Server },
  { path: 'client-dashboard', renderMode: RenderMode.Server },

  // fallback
  { path: '**', renderMode: RenderMode.Server },
];
