import { readFile } from 'node:fs/promises';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const backend = 'http://localhost:4321';
const apiBase = process.env.KINBOARD_PRODUCTION_API === 'true' ? 'https://api.kinboard.xyz' : '';
export default defineConfig({
  base: '/app/',
  define: { __KINBOARD_API_BASE_URL__: JSON.stringify(apiBase) },
  plugins: [vue(), {
    name: 'kinboard-backend-pages',
    configureServer(server) {
      // Keep OAuth on its registered origin. API reads use the dev proxy;
      // server-rendered pages and their forms open directly on Astro.
      server.middlewares.use(async (request, response, next) => {
        const path = request.url?.split('?')[0] ?? '';
        if (/^\/admin(\/|$)/.test(path) && path !== '/admin/login') {
          try {
            const source = await readFile(new URL('./index.html', import.meta.url), 'utf8');
            const html = await server.transformIndexHtml('/app/index.html', source);
            response.writeHead(200, { 'Content-Type': 'text/html' });
            response.end(html);
          } catch (error) { next(error); }
          return;
        }
        if (path === '/' || /^\/(login|welcome|admin|join)(\/|$)/.test(path)) {
          response.writeHead(302, { Location: `${backend}${request.url}` });
          response.end();
          return;
        }
        next();
      });
    },
  }],
  server: { port: 5173, proxy: { '/api': backend } },
});
