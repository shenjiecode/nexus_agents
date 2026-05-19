import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, desc } from 'drizzle-orm';
import logger from '../../lib/logger.js';
import { handleError, apiSuccess, apiError } from '../../lib/format-error.js';
import { roles } from '../../db/schema.js';
import { client } from '../../db/index.js';
import { getUser } from '../middleware/auth.js';
import {
  initRoleDir,
  listRoleFiles,
  readRoleFile,
  writeRoleFile,
  deleteRoleDir,
  exportRoleZip,
  importRoleZip,
} from '../../services/role-storage.js';


// Initialize DB
const db = drizzle(client);

// Create roles router
const rolesRouter = new Hono();

// GET /api/roles - List all public roles
rolesRouter.get('/api/roles', async (c) => {
  try {
    const allRoles = await db
      .select({
        id: roles.id,
        name: roles.name,
        description: roles.description,
        variant: roles.variant,
        status: roles.status,
        isPublic: roles.isPublic,
        createdAt: roles.createdAt,
        updatedAt: roles.updatedAt,
      })
      .from(roles)
      .where(eq(roles.isPublic, 'true'))
      .orderBy(desc(roles.createdAt));

    return c.json(apiSuccess(allRoles));
  } catch (error) {
    logger.error(error, 'API error');
    return handleError(c, error, 'Failed to list roles');
  }
});

// GET /api/roles/mine - List current user's roles
rolesRouter.get('/api/roles/mine', async (c) => {
  try {
    const user = getUser(c);
    if (!user) {
      return c.json(apiError('Unauthorized', 401), 401);
    }

    const userRoles = await db
      .select()
      .from(roles)
      .where(eq(roles.userId, user.id))
      .orderBy(desc(roles.createdAt));

    return c.json(apiSuccess(userRoles));
  } catch (error) {
    logger.error(error, 'API error');
    return handleError(c, error, 'Failed to list user roles');
  }
});

// POST /api/roles - Create role
rolesRouter.post('/api/roles', async (c) => {
  try {
    const user = getUser(c);
    if (!user) {
      return c.json(apiError('Unauthorized', 401), 401);
    }

    const body = await c.req.json();

    if (!body || typeof body !== 'object') {
      return c.json(apiError('Request body must be an object', 400), 400);
    }

    if (!body.name || typeof body.name !== 'string') {
      return c.json(apiError('name is required and must be a string', 400), 400);
    }

    const roleId = `role_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const name = body.name.trim();
    const now = Date.now();
    const variant = (body.variant || 'full') as string;
    const isPublic = body.isPublic !== false ? 'true' : 'false';

    await db.insert(roles).values({
      id: roleId,
      userId: user.id,
      name,
      description: body.description?.trim() || null,
      variant,
      status: 'stopped',
      isPublic,
      createdAt: now,
      updatedAt: now,
    });

    // Initialize role directory
    await initRoleDir(user.id, roleId);

    return c.json(apiSuccess({
      id: roleId,
      name,
      description: body.description,
      variant,
      isPublic,
      createdAt: new Date(now).toISOString(),
    }), 201);
  } catch (error) {
    logger.error(error, 'API error');
    return handleError(c, error, 'Failed to create role');
  }
});

// GET /api/roles/:id - Get role details
rolesRouter.get('/api/roles/:id', async (c) => {
  try {
    const roleId = c.req.param('id');

    if (!roleId) {
      return c.json(apiError('Role ID is required', 400), 400);
    }

    const [role] = await db
      .select()
      .from(roles)
      .where(eq(roles.id, roleId));

    if (!role) {
      return c.json(apiError('Role not found', 404), 404);
    }

    return c.json(apiSuccess({
      id: role.id,
      userId: role.userId,
      name: role.name,
      description: role.description,
      variant: role.variant,
      status: role.status,
      containerId: role.containerId,
      containerPort: role.containerPort,
      isPublic: role.isPublic,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    }));
  } catch (error) {
    logger.error(error, 'API error');
    return handleError(c, error, 'Failed to get role');
  }
});

// PUT /api/roles/:id - Update role metadata
rolesRouter.put('/api/roles/:id', async (c) => {
  try {
    const user = getUser(c);
    if (!user) {
      return c.json(apiError('Unauthorized', 401), 401);
    }

    const roleId = c.req.param('id');

    if (!roleId) {
      return c.json(apiError('Role ID is required', 400), 400);
    }

    const [existingRole] = await db
      .select()
      .from(roles)
      .where(eq(roles.id, roleId));

    if (!existingRole) {
      return c.json(apiError('Role not found', 404), 404);
    }

    // Check ownership
    if (existingRole.userId !== user.id) {
      return c.json(apiError('Forbidden: you can only update your own roles', 403), 403);
    }

    const body = await c.req.json();
    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (body.name !== undefined) {
      if (typeof body.name !== 'string') {
        return c.json(apiError('name must be a string', 400), 400);
      }
      updates.name = body.name.trim();
    }

    if (body.description !== undefined) {
      updates.description = body.description?.trim() || null;
    }

    if (body.variant !== undefined) {
      if (typeof body.variant !== 'string') {
        return c.json(apiError('variant must be a string', 400), 400);
      }
      updates.variant = body.variant;
    }

    if (body.isPublic !== undefined) {
      updates.isPublic = body.isPublic ? 'true' : 'false';
    }

    await db
      .update(roles)
      .set(updates)
      .where(eq(roles.id, roleId));

    const [updatedRole] = await db
      .select()
      .from(roles)
      .where(eq(roles.id, roleId));

    return c.json(apiSuccess(updatedRole));
  } catch (error) {
    logger.error(error, 'API error');
    return handleError(c, error, 'Failed to update role');
  }
});

// DELETE /api/roles/:id - Delete role
rolesRouter.delete('/api/roles/:id', async (c) => {
  try {
    const user = getUser(c);
    if (!user) {
      return c.json(apiError('Unauthorized', 401), 401);
    }

    const roleId = c.req.param('id');

    if (!roleId) {
      return c.json(apiError('Role ID is required', 400), 400);
    }

    const [existingRole] = await db
      .select()
      .from(roles)
      .where(eq(roles.id, roleId));

    if (!existingRole) {
      return c.json(apiError('Role not found', 404), 404);
    }

    // Check ownership
    if (existingRole.userId !== user.id) {
      return c.json(apiError('Forbidden: you can only delete your own roles', 403), 403);
    }

    await db
      .delete(roles)
      .where(eq(roles.id, roleId));

    // Delete role directory
    await deleteRoleDir(user.id, roleId);

    return c.json(apiSuccess({ message: 'Role deleted successfully' }));
  } catch (error) {
    logger.error(error, 'API error');
    return handleError(c, error, 'Failed to delete role');
  }
});
// GET /api/roles/:id/export - Export role as zip
rolesRouter.get('/api/roles/:id/export', async (c) => {
  try {
    const roleId = c.req.param('id');

    if (!roleId) {
      return c.json(apiError('Role ID is required', 400), 400);
    }

    const [role] = await db
      .select()
      .from(roles)
      .where(eq(roles.id, roleId));

    if (!role) {
      return c.json(apiError('Role not found', 404), 404);
    }

    // Anyone can export public roles
    if (role.isPublic !== 'true') {
      return c.json(apiError('Only public roles can be exported', 403), 403);
    }

    const zipBuffer = await exportRoleZip(role.userId, roleId);

    return c.body(zipBuffer as any, 200, {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${roleId}.zip"`,
    });
  } catch (error) {
    logger.error(error, 'API error');
    return handleError(c, error, 'Failed to export role');
  }
});


// GET /api/roles/:id/files - List role files
rolesRouter.get('/api/roles/:id/files', async (c) => {
  try {
    const user = getUser(c);
    if (!user) {
      return c.json(apiError('Unauthorized', 401), 401);
    }

    const roleId = c.req.param('id');
    const dirPath = c.req.query('path') || '';

    if (!roleId) {
      return c.json(apiError('Role ID is required', 400), 400);
    }

    const [role] = await db
      .select()
      .from(roles)
      .where(eq(roles.id, roleId));

    if (!role) {
      return c.json(apiError('Role not found', 404), 404);
    }

    // Only owner can read files
    if (role.userId !== user.id) {
      return c.json(apiError('Forbidden: you can only read files of your own roles', 403), 403);
    }

    const files = await listRoleFiles(user.id, roleId, dirPath);

    return c.json(apiSuccess(files));
  } catch (error) {
    logger.error(error, 'API error');
    return handleError(c, error, 'Failed to list role files');
  }
});

// GET /api/roles/:id/files/:path - Read file
rolesRouter.get('/api/roles/:id/files/:path', async (c) => {
  try {
    const user = getUser(c);
    if (!user) {
      return c.json(apiError('Unauthorized', 401), 401);
    }

    const roleId = c.req.param('id');
    // Decode the path parameter to handle URL-encoded paths
    const filePath = decodeURIComponent(c.req.param('path'));

    if (!roleId) {
      return c.json(apiError('Role ID is required', 400), 400);
    }

    if (!filePath) {
      return c.json(apiError('File path is required', 400), 400);
    }

    const [role] = await db
      .select()
      .from(roles)
      .where(eq(roles.id, roleId));

    if (!role) {
      return c.json(apiError('Role not found', 404), 404);
    }

    // Only owner can read files
    if (role.userId !== user.id) {
      return c.json(apiError('Forbidden: you can only read files of your own roles', 403), 403);
    }

    const content = await readRoleFile(user.id, roleId, filePath);

    return c.json(apiSuccess({ path: filePath, content }));
  } catch (error: unknown) {
    logger.error(error, 'API error');
    return handleError(c, error, 'Failed to read role file');
  }
});

// PUT /api/roles/:id/files/:path - Write file
rolesRouter.put('/api/roles/:id/files/:path', async (c) => {
  try {
    const user = getUser(c);
    if (!user) {
      return c.json(apiError('Unauthorized', 401), 401);
    }

    const roleId = c.req.param('id');
    // Decode the path parameter to handle URL-encoded paths
    const filePath = decodeURIComponent(c.req.param('path'));

    if (!roleId) {
      return c.json(apiError('Role ID is required', 400), 400);
    }

    if (!filePath) {
      return c.json(apiError('File path is required', 400), 400);
    }

    const [role] = await db
      .select()
      .from(roles)
      .where(eq(roles.id, roleId));

    if (!role) {
      return c.json(apiError('Role not found', 404), 404);
    }

    // Only owner can write files
    if (role.userId !== user.id) {
      return c.json(apiError('Forbidden: you can only write files of your own roles', 403), 403);
    }

    const body = await c.req.json();
    const content = body?.content;

    if (typeof content !== 'string') {
      return c.json(apiError('content is required and must be a string', 400), 400);
    }

    const result = await writeRoleFile(user.id, roleId, filePath, content);

    // Update role's updatedAt
    await db
      .update(roles)
      .set({ updatedAt: Date.now() })
      .where(eq(roles.id, roleId));

    return c.json(apiSuccess(result));
  } catch (error) {
    logger.error(error, 'API error');
    return handleError(c, error, 'Failed to write role file');
  }
});
// POST /api/roles/import - Import role from zip
rolesRouter.post('/api/roles/import', async (c) => {
  try {
    const user = getUser(c);
    if (!user) {
      return c.json(apiError('Unauthorized', 401), 401);
    }

    const formData = await c.req.parseBody({ all: true });
    const file = formData.file;

    if (!file || !(file instanceof File)) {
      return c.json(apiError('file is required and must be a file', 400), 400);
    }

    // Read file as buffer
    const arrayBuffer = await file.arrayBuffer();
    const zipBuffer = Buffer.from(arrayBuffer);

    // Generate new role ID
    const roleId = `role_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    // Extract role name from zip if available, otherwise use default
    let roleName = 'Imported Role';
    try {
      const { path } = await importRoleZip(user.id, roleId, zipBuffer);
      // Try to read config.json to get name
      const configPath = join(path, 'config.json');
      if (existsSync(configPath)) {
        const configContent = readFileSync(configPath, 'utf-8');
        const config = JSON.parse(configContent);
        if (config.name) {
          roleName = config.name;
        }
      }
    } catch {
      // If import fails, return error
      return c.json(apiError('Invalid zip file', 400), 400);
    }

    // Create role record in database
    const now = Date.now();
    await db.insert(roles).values({
      id: roleId,
      userId: user.id,
      name: roleName,
      description: 'Imported role',
      variant: 'full',
      status: 'stopped',
      isPublic: 'false',
      createdAt: now,
      updatedAt: now,
    });

    return c.json(apiSuccess({
      id: roleId,
      name: roleName,
      message: 'Role imported successfully',
    }), 201);
  } catch (error) {
    logger.error(error, 'API error');
    return handleError(c, error, 'Failed to import role');
  }
});


export default rolesRouter;