process.env.NODE_ENV = 'test';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'wiring-check';
process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'wiring-check';

const { createApp } = await import('../src/app.js');
await import('../src/jobs/scheduler.js');

const app = createApp();

const routes = [];
app._router.stack.forEach((layer) => {
  if (layer.name === 'router' && layer.regexp) {
    layer.handle.stack.forEach((sub) => {
      if (sub.route) {
        const methods = Object.keys(sub.route.methods).join(',').toUpperCase();
        routes.push(`${methods} ${sub.route.path}`);
      }
    });
  } else if (layer.route) {
    const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
    routes.push(`${methods} ${layer.route.path}`);
  }
});

console.log(`[wiring-check] app assembled successfully with ${routes.length}+ route handlers mounted.`);
console.log('[wiring-check] all controllers, middleware, services, and jobs imported cleanly.');
console.log('[wiring-check] OK ✔');
