import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { handleUploadRequest } from './api/uploadHandler';
import { handleReportDownloadRequest } from './api/report-download';
import { handleImageProxyRequest } from './api/image-proxy';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      watch: {
        ignored: ['**/android/**', '**/ios/**']
      }
    },
    plugins: [
      react(),
      {
        name: 'local-r2-upload-endpoint',
        configureServer(server) {
          server.middlewares.use('/api/upload', (req, res, next) => {
            if (req.method !== 'POST' && req.method !== 'PUT') {
              next();
              return;
            }

            const chunks: any[] = [];
            req.on('data', chunk => {
              chunks.push(chunk);
            });
            req.on('end', async () => {
              try {
                const rawBody = Buffer.concat(chunks);
                let parsedBody = undefined;
                
                if (req.method === 'POST') {
                  try {
                    parsedBody = JSON.parse(rawBody.toString('utf8'));
                  } catch (e) {
                    // Ignore parse error for POST if body is empty or not JSON
                  }
                }

                // Parse query params for PUT fallback
                const url = new URL(req.url || '', `http://${req.headers.host}`);
                const query: Record<string, string> = {};
                url.searchParams.forEach((value, key) => {
                  query[key] = value;
                });

                const { status, payload } = await handleUploadRequest(req.method, parsedBody, {
                  accountId: env.VITE_R2_ACCOUNT_ID,
                  accessKeyId: env.VITE_R2_ACCESS_KEY_ID,
                  secretAccessKey: env.VITE_R2_SECRET_ACCESS_KEY,
                  publicUrlBase: env.VITE_R2_PUBLIC_URL,
                }, query, rawBody);

                res.statusCode = status;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(payload));
              } catch (error: any) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: error?.message || 'Invalid request body' }));
              }
            });
          });

          server.middlewares.use('/api/img-proxy', (req, res, next) => {
            if (req.method !== 'GET') {
              next();
              return;
            }

            const url = new URL(req.url || '', `http://${req.headers.host}`);
            const imageUrl = url.searchParams.get('url') || '';

            if (!imageUrl) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'text/plain');
              res.end('Missing image URL');
              return;
            }

            const allowedDomains = ['r2.dev', 'cloudflarestorage.com', 'supabase.co'];
            const isAllowed = allowedDomains.some(d => imageUrl.includes(d));
            if (!isAllowed) {
              res.statusCode = 403;
              res.setHeader('Content-Type', 'text/plain');
              res.end('Invalid image source');
              return;
            }

            fetch(imageUrl)
              .then(r => {
                if (!r.ok) throw new Error(r.statusText);
                const ct = r.headers.get('content-type') || 'image/jpeg';
                res.statusCode = 200;
                res.setHeader('Content-Type', ct);
                res.setHeader('Cache-Control', 'public, max-age=86400');
                r.arrayBuffer().then(buf => {
                  res.end(Buffer.from(buf));
                });
              })
              .catch(err => {
                res.statusCode = 502;
                res.setHeader('Content-Type', 'text/plain');
                res.end(`Failed to fetch image: ${err.message}`);
              });
          });

          server.middlewares.use('/api/pdf-download', (req, res, next) => {
            if (req.method !== 'GET') {
              next();
              return;
            }

            const url = new URL(req.url || '', `http://${req.headers.host}`);
            const reportUrl = url.searchParams.get('url') || '';

            if (!reportUrl) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'text/plain');
              res.end('Missing report URL');
              return;
            }

            const allowedDomains = ['r2.dev', 'cloudflarestorage.com'];
            const isAllowed = allowedDomains.some(d => reportUrl.includes(d));
            if (!isAllowed) {
              res.statusCode = 403;
              res.setHeader('Content-Type', 'text/plain');
              res.end('Invalid file source');
              return;
            }

            fetch(reportUrl)
              .then(r => {
                if (!r.ok) throw new Error(r.statusText);
                const filename = new URL(reportUrl).pathname.split('/').pop() || 'audit-report.pdf';
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                r.arrayBuffer().then(buf => {
                  res.end(Buffer.from(buf));
                });
              })
              .catch(err => {
                res.statusCode = 502;
                res.setHeader('Content-Type', 'text/plain');
                res.end(`Failed to fetch PDF: ${err.message}`);
              });
          });

          server.middlewares.use('/api/image-proxy', (req, res, next) => {
            if (req.method !== 'POST') {
              next();
              return;
            }

            let rawBody = '';
            req.on('data', chunk => {
              rawBody += chunk;
            });
            req.on('end', async () => {
              try {
                const parsedBody = rawBody ? JSON.parse(rawBody) : undefined;
                const { status, payload } = await handleImageProxyRequest(req.method, parsedBody);

                res.statusCode = status;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(payload));
              } catch (error: any) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: error?.message || 'Invalid request body' }));
              }
            });
          });

          server.middlewares.use('/api/report-download', (req, res, next) => {
            if (req.method !== 'POST') {
              next();
              return;
            }

            let rawBody = '';
            req.on('data', chunk => {
              rawBody += chunk;
            });
            req.on('end', async () => {
              try {
                const parsedBody = rawBody ? JSON.parse(rawBody) : undefined;
                const { status, payload } = await handleReportDownloadRequest(req.method, parsedBody, {
                  accountId: env.VITE_R2_ACCOUNT_ID,
                  accessKeyId: env.VITE_R2_ACCESS_KEY_ID,
                  secretAccessKey: env.VITE_R2_SECRET_ACCESS_KEY,
                });

                res.statusCode = status;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(payload));
              } catch (error: any) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: error?.message || 'Invalid request body' }));
              }
            });
          });
        },
      },
    ],
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
            icons: ['lucide-react'],
            charts: ['recharts'],
            supabase: ['@supabase/supabase-js'],
            pdf: ['jspdf', 'jspdf-autotable'],
            turso: ['@libsql/client']
          }
        }
      }
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    test: {
      environment: 'jsdom',
      setupFiles: 'test/setup.ts',
      globals: true
    }
  };
});
