import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import { initialWorld, reduce } from './src/lib/world';

/** Keeps the demo world on the local server, so every device on the network shares it. */
function sync(): Plugin {
  let world = initialWorld();
  const streams = new Set<ServerResponse>();
  const json = (res: ServerResponse, body: unknown) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
  };
  const handler = (urls: () => string[]) => (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const path = (req.url ?? '').split('?')[0];
    if (path === '/world') return json(res, world);
    if (path === '/info') return json(res, { urls: urls() });
    if (path === '/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(`data: ${JSON.stringify(world)}\n\n`);
      streams.add(res);
      req.on('close', () => streams.delete(res));
      return undefined;
    }
    if (path === '/act' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 4096) req.destroy();
      });
      req.on('end', () => {
        try { world = reduce(world, JSON.parse(body)); } catch { /* a broken action changes nothing */ }
        const message = `data: ${JSON.stringify(world)}\n\n`;
        streams.forEach((s) => s.write(message));
        res.statusCode = 204;
        res.end();
      });
      return undefined;
    }
    return next();
  };
  return {
    name: 'nexi-sync',
    configureServer(server) { server.middlewares.use('/api', handler(() => server.resolvedUrls?.network ?? [])); },
    configurePreviewServer(server) { server.middlewares.use('/api', handler(() => server.resolvedUrls?.network ?? [])); },
  };
}

export default defineConfig({ plugins: [react(), sync()], server: { host: true }, preview: { host: true } });
