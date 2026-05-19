import 'dotenv/config'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import logger from './lib/logger.js'
import { authMiddleware } from './api/middleware/auth.js'
import organizationRoutes from './api/routes/organizations.js'

import orgEmployeeRoutes from './api/routes/org-employees.js'
import employeeRoutes from './api/routes/employees.js'
import sessionRoutes from './api/routes/sessions.js'
import marketplaceRoutes from './api/routes/marketplace.js'
import authRoutes from './api/routes/auth.js'
import matrixRoutes from './api/routes/matrix.js'
import employeeConfigRoutes from './api/routes/employee-config.js'
import picoclawRoutes, { handlePicoWsUpgrade } from './api/routes/picoclaw.js'
import rolesRoutes from './api/routes/roles.js'
import roleDebugRoutes, { handleRoleDebugWsUpgrade } from './api/routes/role-debug.js'
import { restoreEmployees } from './services/employee-manager.js'
import { initDatabase, closeDatabase } from './db/index.js'

const app = new Hono()

// Middleware
app.use('*', cors())
app.use('*', authMiddleware)
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

// API Routes
app.route('/', authRoutes)
app.route('/', organizationRoutes)

app.route('/', orgEmployeeRoutes)
app.route('/', sessionRoutes)
app.route('/', employeeRoutes)
app.route('/', marketplaceRoutes)
app.route('/', matrixRoutes)
app.route('/', employeeConfigRoutes)
app.route('/', picoclawRoutes)
app.route('/', rolesRoutes)
app.route('/', roleDebugRoutes)

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404)
})

// Initialize on startup
async function initialize() {
  try {
    await initDatabase()
    logger.info('Database initialized')
    const restored = await restoreEmployees()
    logger.info(`Restored ${restored} employees from database`)
    const { serve } = await import('@hono/node-server')
    const port = parseInt(process.env.PORT || '13207', 10)
    const server = serve({
      fetch: app.fetch,
      port,
    })
    server.on('upgrade', (req, socket, head) => {
      const url = req.url || ''
      if (url.startsWith('/api/picoclaw/') && url.endsWith('/ws')) {
        handlePicoWsUpgrade(req, socket, head)
      } else if (url.startsWith('/api/roles/') && url.includes('/debug/ws')) {
        handleRoleDebugWsUpgrade(req, socket, head)
      }
    })
    logger.info(`Server started on port ${port}`)
  } catch (error) {
    logger.error(error, 'Failed to initialize')
    process.exit(1)
  }
}

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
