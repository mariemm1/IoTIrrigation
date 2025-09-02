import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';

import express, { Request, Response, NextFunction } from 'express';
import { join } from 'node:path';
import { createProxyMiddleware } from 'http-proxy-middleware';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/** --- API proxy (must be BEFORE static & SSR handlers) --- */
const backendTarget = process.env['BACKEND_URL'] ?? 'http://backend:8081';

app.use(
  '/api',
  createProxyMiddleware({
    target: backendTarget,
    changeOrigin: true,
    xfwd: true,
    proxyTimeout: 30_000,
    timeout: 30_000,
    // Express removes "/api" when mounting; add it back so backend receives "/api/..."
    pathRewrite: (path: string) => `/api${path}`,
    // v3 logging
    logger: console,
  })
);
/** -------------------------------------------------------- */

/** Serve static assets from the browser build */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  })
);

/** SSR handler */
app.use((req: Request, res: Response, next: NextFunction) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

/** Start server if run directly */
if (isMainModule(import.meta.url)) {
  const port = Number(process.env['PORT'] ?? 4000);
  app.listen(port, (error?: unknown) => {
    if (error) throw error;
    console.log(`Node Express server listening on http://localhost:${port}`);
    console.log(`Proxying /api -> ${backendTarget}`);
  });
}

/** Export request handler for CLI/functions */
export const reqHandler = createNodeRequestHandler(app);
