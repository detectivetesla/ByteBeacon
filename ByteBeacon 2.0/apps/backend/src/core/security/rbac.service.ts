import type pg from 'pg';
import { Permission, UserRole } from '@bytebeacon/shared';

export class RbacService {
  private readonly db: pg.Pool;
  private readonly rolePermissionsCache = new Map<UserRole, Set<Permission>>();

  constructor(db: pg.Pool) {
    this.db = db;
  }

  public async hasPermission(role: UserRole, permission: Permission): Promise<boolean> {
    const permissions = await this.getRolePermissions(role);
    return permissions.has(permission);
  }

  public async getRolePermissions(role: UserRole): Promise<Set<Permission>> {
    if (this.rolePermissionsCache.has(role)) {
      return this.rolePermissionsCache.get(role)!;
    }

    const query = `
      SELECT permission_id as "permissionId"
      FROM role_permissions
      WHERE role = $1
    `;

    const result = await this.db.query<{ permissionId: Permission }>(query, [role]);
    const permissionSet = new Set<Permission>(result.rows.map((r) => r.permissionId));
    this.rolePermissionsCache.set(role, permissionSet);

    return permissionSet;
  }

  public clearCache(): void {
    this.rolePermissionsCache.clear();
  }
}
