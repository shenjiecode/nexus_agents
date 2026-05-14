import { Hono } from 'hono'
import { cors } from 'hono/cors'
import logger from './lib/logger.js'
import organizationRoutes from './api/routes/organizations.js'
import roleRoutes from './api/routes/roles.js'
import orgContainerRoutes from './api/routes/org-containers.js'
import containerRoutes from './api/routes/containers.js'
import sessionRoutes from './api/routes/sessions.js'
import { restoreContainers } from './services/container-manager.js'
import { initDatabase, closeDatabase } from './db/index.js'

const app = new Hono()

// Middleware
app.use('*', cors())
app.use('*', async (c, next) => {
  const start = Date.now()
  await next()
  const ms = Date.now() - start
  logger.info(`${c.req.method} ${c.req.url} - ${ms}ms`)
})

// Error handling middleware
app.onError((err, c) => {
  logger.error(err)
  return c.json({ error: err.message }, 500)
})

// Health check (public)
app.get('/health', (c) => {
  return c.json({ status: 'ok' })
})

// ============ API Routes ============

// All routes accessible (auth middleware available for future external API use)
app.route('/', organizationRoutes)  // Organization CRUD + Auth config + API Key management
app.route('/', roleRoutes)          // Roles are global templates
app.route('/', orgContainerRoutes)  // /api/orgs/:slug/containers/*
app.route('/', sessionRoutes)       // /api/orgs/:slug/sessions/*
app.route('/', containerRoutes)     // /api/containers/*

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404)
})

// Initialize on startup
async function initialize() {
  try {
    // Initialize database
    await initDatabase()
    logger.info('Database initialized')

    // Restore containers from database
    const restored = await restoreContainers()
    logger.info(`Restored ${restored} containers from database`)

    // Start server
    const { serve } = await import('@hono/node-server')
    serve({
      fetch: app.fetch,
      port: 13207
    })
    logger.info('Server started on port 13207')
  } catch (error) {
    logger.error(error, 'Failed to initialize')
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Shutting down...')
  closeDatabase()
  process.exit(0)
})

process.on('SIGINT', () => {
  logger.info('Shutting down...')
  closeDatabase()
  process.exit(0)
})

initialize()

export default app
