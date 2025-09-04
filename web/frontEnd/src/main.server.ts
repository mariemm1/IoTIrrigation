import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { config } from './app/app.config.server';
import 'zone.js/node'; // 👈 This is required for SSR


(globalThis as any).history = (globalThis as any).history || {
  back() {},
  forward() {},
  pushState() {},
  replaceState() {},
  state: null
};


const bootstrap = () => bootstrapApplication(App, config);

export default bootstrap;
