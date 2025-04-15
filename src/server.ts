import { serve } from 'bun';
import { readFileSync } from 'fs';
import { join } from 'path';

console.log('Starting Developer Performance Analytics Dashboard server...');

// Serve the application
serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname;

    // Default to index.html for the root path
    if (path === '/') {
      path = '/index.html';
    }

    try {
      // Determine content type based on file extension
      const contentType = getContentType(path);

      // Check if the file exists and read it
      const filePath = join(process.cwd(), path);

      // Special case for favicon.ico - return a 204 No Content
      if (path === '/favicon.ico') {
        return new Response(null, { status: 204 });
      }

      // Special handling for TypeScript/JavaScript files
      if (path.endsWith('.ts') || path.endsWith('.tsx') || path.endsWith('.js') || path.endsWith('.jsx')) {
        try {
          // Use Bun's transpiler for TypeScript files
          const transpiler = new Bun.Transpiler({
            loader: path.endsWith('.ts') || path.endsWith('.tsx') ? 'tsx' : 'jsx',
            target: 'browser'
          });

          const content = readFileSync(filePath, 'utf8');
          const result = transpiler.transformSync(content);

          return new Response(result, {
            headers: { 'Content-Type': 'application/javascript' }
          });
        } catch (e) {
          console.error(`Error transpiling: ${filePath}`, e);
          return new Response(`Error transpiling: ${e instanceof Error ? e.message : String(e)}`, { status: 500 });
        }
      } else {
        // For non-JS/TS files, serve directly
        try {
          const content = readFileSync(filePath);
          return new Response(content, {
            headers: { 'Content-Type': contentType }
          });
        } catch (e) {
          console.error(`File not found: ${filePath}`);
          return new Response('Not found', { status: 404 });
        }
      }
    } catch (e) {
      // Handle file not found or other errors
      console.error(`Error serving ${path}:`, e);

      if (path.startsWith('/src/') || path.endsWith('.js') || path.endsWith('.ts') || path.endsWith('.tsx')) {
        // For source files, transpile on demand
        return new Response('File processing error', { status: 500 });
      }

      // For other paths, return a 404
      return new Response('Not found', { status: 404 });
    }
  },
});

console.log('Server running at http://localhost:3000');

// Helper function to determine content type based on file extension
function getContentType(path: string): string {
  if (path.endsWith('.html')) return 'text/html';
  if (path.endsWith('.js') || path.endsWith('.jsx')) return 'application/javascript';
  if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'application/javascript';
  if (path.endsWith('.css')) return 'text/css';
  if (path.endsWith('.json')) return 'application/json';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  if (path.endsWith('.svg')) return 'image/svg+xml';
  return 'text/plain';
}
