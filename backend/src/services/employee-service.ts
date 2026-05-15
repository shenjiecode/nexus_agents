import logger from '../lib/logger.js';
import { employees, organizations, roles } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';

let db: any = null;

async function getDb() {
  if (!db) {
    const { initDatabase } = await import('../db/index.js');
    db = await initDatabase();
  }
  return db;
}

/**
 * Generate unique employee ID
 */
function generateEmployeeId(): string {
  return `emp_${Date.now()}_${randomBytes(4).toString('hex')}`;
}

/**
 * Generate employee slug from role and org
 */
function generateEmployeeSlug(orgSlug: string, roleSlug: string): string {
  return `${roleSlug}-${orgSlug}-${randomBytes(2).toString('hex')}`;
}

/**
 * Create a new employee entity (without container)
 */
export async function createEmployee(
  orgSlug: string,
  roleId: string,
  roleSlug: string,
  options?: {
    name?: string;
    empId?: string;
  }
): Promise<{
  id: string;
  slug: string;
  name: string;
  roleId: string;
  organizationId: string;
  employeeDataPath: string;
}> {
  const database = await getDb();

  // Get organization
  const orgRecords = await database
    .select()
    .from(organizations)
    .where(eq(organizations.slug, orgSlug));

  if (orgRecords.length === 0) {
    throw new Error(`Organization '${orgSlug}' not found`);
  }
  const org = orgRecords[0];

  const empId = options?.empId || generateEmployeeId();
  const empSlug = generateEmployeeSlug(orgSlug, roleSlug);
  const empName = options?.name || empSlug;
  const empDataPath = `data/employees/${empId}`;

  await database.insert(employees).values({
    id: empId,
    slug: empSlug,
    name: empName,
    roleId: roleId,
    organizationId: org.id,
    containerId: null, // Not hired yet
    employeeDataPath: empDataPath,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  logger.info({ empId, empSlug, orgSlug, roleSlug }, 'Employee entity created');

  return {
    id: empId,
    slug: empSlug,
    name: empName,
    roleId: roleId,
    organizationId: org.id,
    employeeDataPath: empDataPath,
  };
}

/**
 * Get employee by ID
 */
export async function getEmployeeById(empId: string): Promise<{
  id: string;
  slug: string;
  name: string;
  roleId: string;
  organizationId: string | null;
  containerId: string | null;
  employeeDataPath: string | null;
  matrixUserId: string | null;
} | null> {
  const database = await getDb();
  const records = await database
    .select()
    .from(employees)
    .where(eq(employees.id, empId));

  if (records.length === 0) {
    return null;
  }

  const emp = records[0];
  return {
    id: emp.id,
    slug: emp.slug,
    name: emp.name,
    roleId: emp.roleId,
    organizationId: emp.organizationId,
    containerId: emp.containerId,
    employeeDataPath: emp.employeeDataPath,
    matrixUserId: emp.matrixUserId,
  };
}

/**
 * Get employee by slug
 */
export async function getEmployeeBySlug(empSlug: string): Promise<{
  id: string;
  slug: string;
  name: string;
  roleId: string;
  organizationId: string | null;
  containerId: string | null;
} | null> {
  const database = await getDb();
  const records = await database
    .select()
    .from(employees)
    .where(eq(employees.slug, empSlug));

  if (records.length === 0) {
    return null;
  }

  const emp = records[0];
  return {
    id: emp.id,
    slug: emp.slug,
    name: emp.name,
    roleId: emp.roleId,
    organizationId: emp.organizationId,
    containerId: emp.containerId,
  };
}

/**
 * Get all employees
 */
export async function getAllEmployees(): Promise<Array<{
  id: string;
  slug: string;
  name: string;
  roleId: string;
  organizationId: string | null;
  containerId: string | null;
  hasContainer: boolean;
}>> {
  const database = await getDb();
  const records = await database.select().from(employees);

  return records.map((emp: any) => ({
    id: emp.id,
    slug: emp.slug,
    name: emp.name,
    roleId: emp.roleId,
    organizationId: emp.organizationId,
    containerId: emp.containerId,
    hasContainer: emp.containerId !== null,
  }));
}

/**
 * Get employees by organization
 */
export async function getEmployeesByOrganization(orgId: string): Promise<Array<{
  id: string;
  slug: string;
  name: string;
  roleId: string;
  containerId: string | null;
}>> {
  const database = await getDb();
  const records = await database
    .select()
    .from(employees)
    .where(eq(employees.organizationId, orgId));

  return records.map((emp: any) => ({
    id: emp.id,
    slug: emp.slug,
    name: emp.name,
    roleId: emp.roleId,
    containerId: emp.containerId,
  }));
}

/**
 * Hire employee - create container
 */
export async function hireEmployee(
  empId: string,
  options?: {
    roleVersion?: string;
    imageName?: string;
    port?: number;
  }
): Promise<{
  containerId: string;
  employeeId: string;
}> {
  const database = await getDb();
  const emp = await getEmployeeById(empId);

  if (!emp) {
    throw new Error(`Employee '${empId}' not found`);
  }

  if (emp.containerId) {
    throw new Error(`Employee '${empId}' is already hired (container: ${emp.containerId})`);
  }

  if (!emp.organizationId) {
    throw new Error(`Employee '${empId}' has no organization assigned`);
  }

  // Get organization and role info
  const orgRecords = await database
    .select()
    .from(organizations)
    .where(eq(organizations.id, emp.organizationId));

  const roleRecords = await database
    .select()
    .from(roles)
    .where(eq(roles.id, emp.roleId));

  if (orgRecords.length === 0 || roleRecords.length === 0) {
    throw new Error('Organization or role not found');
  }

  const org = orgRecords[0];
  const role = roleRecords[0];

  // Import container manager and create container
  const { createContainer } = await import('./container-manager.js');
  const containerInstance = await createContainer(
    org.id,
    org.slug,
    role.id,
    role.slug,
    emp.id,
    emp.slug,
    options?.roleVersion || 'latest',
    options?.imageName,
    options?.port
  );

  // Update employee with container ID
  await database
    .update(employees)
    .set({
      containerId: containerInstance.id,
      updatedAt: Date.now(),
    })
    .where(eq(employees.id, empId));

  logger.info({ empId, containerId: containerInstance.id }, 'Employee hired');

  return {
    containerId: containerInstance.id,
    employeeId: empId,
  };
}

/**
 * Fire employee - stop and remove container
 */
export async function fireEmployee(empId: string): Promise<{
  employeeId: string;
  containerRemoved: boolean;
}> {
  const database = await getDb();
  const emp = await getEmployeeById(empId);

  if (!emp) {
    throw new Error(`Employee '${empId}' not found`);
  }

  let containerRemoved = false;

  if (emp.containerId) {
    // Stop and remove container
    const { removeContainer } = await import('./container-manager.js');
    await removeContainer(emp.containerId);
    containerRemoved = true;
  }

  // Update employee - remove container reference
  await database
    .update(employees)
    .set({
      containerId: null,
      updatedAt: Date.now(),
    })
    .where(eq(employees.id, empId));

  logger.info({ empId, containerRemoved }, 'Employee fired');

  return {
    employeeId: empId,
    containerRemoved,
  };
}

/**
 * Transfer employee to another organization
 */
export async function transferEmployee(
  empId: string,
  newOrgSlug: string
): Promise<{
  employeeId: string;
  oldOrgId: string | null;
  newOrgId: string;
}> {
  const database = await getDb();
  const emp = await getEmployeeById(empId);

  if (!emp) {
    throw new Error(`Employee '${empId}' not found`);
  }

  // Employee must not have active container to transfer
  if (emp.containerId) {
    throw new Error(`Employee '${empId}' has active container. Fire first before transferring.`);
  }

  // Get new organization
  const orgRecords = await database
    .select()
    .from(organizations)
    .where(eq(organizations.slug, newOrgSlug));

  if (orgRecords.length === 0) {
    throw new Error(`Organization '${newOrgSlug}' not found`);
  }
  const newOrg = orgRecords[0];

  const oldOrgId = emp.organizationId;

  // Update employee organization
  await database
    .update(employees)
    .set({
      organizationId: newOrg.id,
      updatedAt: Date.now(),
    })
    .where(eq(employees.id, empId));

  logger.info({ empId, oldOrgId, newOrgId: newOrg.id }, 'Employee transferred');

  return {
    employeeId: empId,
    oldOrgId,
    newOrgId: newOrg.id,
  };
}

/**
 * Delete employee (permanently)
 * Note: Employee must be fired first (no active container)
 */
export async function deleteEmployee(empId: string): Promise<boolean> {
  const database = await getDb();
  const emp = await getEmployeeById(empId);

  if (!emp) {
    return false;
  }

  if (emp.containerId) {
    throw new Error(`Employee '${empId}' has active container. Fire first before deleting.`);
  }

  await database.delete(employees).where(eq(employees.id, empId));

  logger.info({ empId }, 'Employee deleted');

  return true;
}