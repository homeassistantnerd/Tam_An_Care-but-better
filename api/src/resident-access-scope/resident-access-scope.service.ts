import {
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import {
  DatabaseService,
} from '../database/database.service';

import {
  StaffActorService,
} from '../staff-actors/staff-actor.service';

export type ResidentAccessHumanRole =
  | 'CAREGIVER'
  | 'NURSE'
  | 'GUARDIAN'
  | 'PSYCHOLOGIST'
  | 'SOCIAL_WORKER'
  | 'SUPERVISOR'
  | 'ADMIN'
  | 'CARE_MANAGER';

export type ResidentScopeSql = {
  sql: string;
  params: any[];
  nextParameter: number;
  enforcement:
    | 'ASSIGNMENT_SCOPED'
    | 'SUPERVISORY_ALL_ACTIVE_RESIDENTS';
};

// Roles allowed to write resident clinical records (product decision 2026-10-18).
// MEDICAL_HEAD is supervisory for writes only; GUARDIAN, NUTRITIONIST,
// REHABILITATION_SPECIALIST and non-clinical roles are denied until they get a scope.
const CLINICAL_WRITE_ASSIGNED_ROLES = ['CAREGIVER', 'NURSE', 'PSYCHOLOGIST', 'SOCIAL_WORKER'];
const CLINICAL_WRITE_SUPERVISORY_ROLES = ['SUPERVISOR', 'ADMIN', 'CARE_MANAGER', 'MEDICAL_HEAD'];

@Injectable()
export class ResidentAccessScopeService {
  constructor(
    private readonly db: DatabaseService,
    private readonly staffActors: StaffActorService,
  ) {}

  private scopeForRole(
    actorRole: ResidentAccessHumanRole,
  ):
    | 'DIRECT_CARE'
    | 'CLINICAL_CARE'
    | 'FAMILY_PORTAL'
    | 'PSYCHOSOCIAL_CARE'
    | null
  {
    if (actorRole === 'CAREGIVER') {
      return 'DIRECT_CARE';
    }

    if (actorRole === 'NURSE') {
      return 'CLINICAL_CARE';
    }

    if (actorRole === 'GUARDIAN') return 'FAMILY_PORTAL';
    if (actorRole === 'PSYCHOLOGIST' || actorRole === 'SOCIAL_WORKER') return 'PSYCHOSOCIAL_CARE';
    return null;
  }

  async assertClinicalWriteAccess(
    actorId: string,
    actorRoleInput: string,
    residentId: string,
  ): Promise<void> {
    const actorRole =
      String(actorRoleInput ?? '').trim().toUpperCase();

    const allowed =
      [...CLINICAL_WRITE_ASSIGNED_ROLES, ...CLINICAL_WRITE_SUPERVISORY_ROLES].includes(actorRole)
      && await this.canAccessResident(
        actorId, actorRole as ResidentAccessHumanRole, residentId, CLINICAL_WRITE_SUPERVISORY_ROLES,
      );

    if (!allowed) {
      throw new ForbiddenException('Resident access denied');
    }
  }

  async canAccessResident(
    actorIdInput: string,
    actorRole: ResidentAccessHumanRole,
    residentIdInput: string,
    supervisoryRoles: string[] = ['SUPERVISOR', 'ADMIN', 'CARE_MANAGER'],
  ): Promise<boolean> {
    const actorId =
      String(actorIdInput ?? '').trim();

    const residentId =
      String(residentIdInput ?? '').trim();

    if (!actorId || !residentId) {
      return false;
    }

    const canonicalActor =
      await this.staffActors
        .resolveActiveActorWithRole(
          actorId,
          actorRole,
        );

    if (!canonicalActor) {
      return false;
    }

    const isSupervisoryRole = supervisoryRoles.includes(actorRole);

    if (isSupervisoryRole) {
      const result =
        await this.db.query(
          `
            SELECT 1
            FROM residents r
            WHERE
              r.resident_id = $1
              AND r.active_status = true
            LIMIT 1
          `,
          [
            residentId,
          ],
        );

      return result.rowCount === 1;
    }

    const accessScope =
      this.scopeForRole(actorRole);

    if (!accessScope) {
      return false;
    }

    const result =
      await this.db.query(
        `
          SELECT 1
          FROM residents r
          WHERE
            r.resident_id = $1
            AND r.active_status = true
            AND EXISTS (
              SELECT 1
              FROM resident_access_assignments raa
              WHERE
                raa.resident_id = r.resident_id
                AND raa.actor_id = $2
                AND raa.actor_role = $3
                AND raa.access_scope = $4
                AND raa.status = 'ACTIVE'
                AND raa.effective_from <= NOW()
                AND (
                  raa.effective_to IS NULL
                  OR raa.effective_to > NOW()
                )
            )
          LIMIT 1
        `,
        [
          residentId,
          actorId,
          actorRole,
          accessScope,
        ],
      );

    return result.rowCount === 1;
  }

  async listAccessibleResidentIds(
    actorIdInput: string,
    actorRole: ResidentAccessHumanRole,
  ): Promise<string[]> {
    const actorId =
      String(actorIdInput ?? '').trim();

    if (!actorId) {
      return [];
    }

    const canonicalActor =
      await this.staffActors
        .resolveActiveActorWithRole(
          actorId,
          actorRole,
        );

    if (!canonicalActor) {
      return [];
    }

    const accessScope =
      this.scopeForRole(actorRole);

    if (!accessScope) {
      return [];
    }

    const result =
      await this.db.query<{
        resident_id: string;
      }>(
        `
          SELECT DISTINCT
            raa.resident_id
          FROM resident_access_assignments raa
          JOIN residents r
            ON r.resident_id = raa.resident_id
          WHERE
            raa.actor_id = $1
            AND raa.actor_role = $2
            AND raa.access_scope = $3
            AND raa.status = 'ACTIVE'
            AND raa.effective_from <= NOW()
            AND (
              raa.effective_to IS NULL
              OR raa.effective_to > NOW()
            )
            AND r.active_status = true
          ORDER BY raa.resident_id
        `,
        [
          actorId,
          actorRole,
          accessScope,
        ],
      );

    return result.rows.map(
      (row) => row.resident_id,
    );
  }

  sqlPredicate(
    residentAliasInput: string,
    actorIdInput: string,
    actorRole: ResidentAccessHumanRole,
    startParameter = 1,
  ): ResidentScopeSql {
    const residentAlias =
      String(residentAliasInput ?? '').trim();

    const actorId =
      String(actorIdInput ?? '').trim();

    if (
      !/^[A-Za-z_][A-Za-z0-9_]*$/.test(
        residentAlias,
      )
    ) {
      throw new Error(
        'Unsafe resident SQL alias.',
      );
    }

    if (!actorId) {
      return {
        sql: 'FALSE',
        params: [],
        nextParameter: startParameter,
        enforcement: 'ASSIGNMENT_SCOPED',
      };
    }

    if (['SUPERVISOR', 'ADMIN', 'CARE_MANAGER'].includes(actorRole)) {
      const actorIdParameter =
        startParameter;

      const actorRoleParameter =
        startParameter + 1;

      return {
        sql: `
          ${residentAlias}.active_status = true
          AND EXISTS (
            SELECT 1
            FROM staff_actors sa
            WHERE
              sa.actor_id =
                $${actorIdParameter}
              AND sa.status = 'ACTIVE'
              AND sa.primary_operational_role =
                $${actorRoleParameter}
          )
        `,
        params: [
          actorId,
          actorRole,
        ],
        nextParameter:
          startParameter + 2,
        enforcement:
          'SUPERVISORY_ALL_ACTIVE_RESIDENTS',
      };
    }

    const accessScope =
      this.scopeForRole(actorRole);

    if (!accessScope) {
      return {
        sql: 'FALSE',
        params: [],
        nextParameter: startParameter,
        enforcement: 'ASSIGNMENT_SCOPED',
      };
    }

    const actorIdParameter =
      startParameter;

    const actorRoleParameter =
      startParameter + 1;

    const accessScopeParameter =
      startParameter + 2;

    return {
      sql: `
        ${residentAlias}.active_status = true
        AND EXISTS (
          SELECT 1
          FROM staff_actors sa
          WHERE
            sa.actor_id =
              $${actorIdParameter}
            AND sa.status = 'ACTIVE'
            AND sa.primary_operational_role =
              $${actorRoleParameter}
        )
        AND EXISTS (
          SELECT 1
          FROM resident_access_assignments raa
          WHERE
            raa.resident_id =
              ${residentAlias}.resident_id
            AND raa.actor_id =
              $${actorIdParameter}
            AND raa.actor_role =
              $${actorRoleParameter}
            AND raa.access_scope =
              $${accessScopeParameter}
            AND raa.status = 'ACTIVE'
            AND raa.effective_from <= NOW()
            AND (
              raa.effective_to IS NULL
              OR raa.effective_to > NOW()
            )
        )
      `,
      params: [
        actorId,
        actorRole,
        accessScope,
      ],
      nextParameter:
        startParameter + 3,
      enforcement: 'ASSIGNMENT_SCOPED',
    };
  }
}
