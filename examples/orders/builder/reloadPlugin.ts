import type { ServerResponse as TypeServerResponse } from 'node:http';

import type { Plugin as TypeVitePlugin } from 'vite';

const clients = new Set<TypeServerResponse>();

export const reloadPlugin: TypeVitePlugin = {
  name: 'pageReload',
  transformIndexHtml() {
    return [
      {
        tag: 'script',
        injectTo: 'body',
        children: `(function refresh() {
  let attempt = 0;
  const maxAttempts = 3;

  window.addEventListener('load', () => {
    const events = new EventSource('/reload');
    events.addEventListener('reload', () => window.location.reload());
    events.onopen = () => { attempt = 0; };
    events.onerror = () => attempt < maxAttempts ? attempt++ : events.close();
  }, { once: true });
})();`,
      },
    ];
  },
  configurePreviewServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url !== '/reload') {
        next();
        return;
      }

      res.writeHead(200, {
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'Content-Type': 'text/event-stream',
      });
      res.write('retry: 1000\n\n');

      clients.add(res);
      res.once('close', () => clients.delete(res));
    });
  },
};

export function sendReloadSignal(): void {
  clients.forEach((client) => {
    client.write('event: reload\ndata: reload\n\n');
  });
}

export function closeReloadConnections(): void {
  clients.forEach((client) => client.end());
  clients.clear();
}
