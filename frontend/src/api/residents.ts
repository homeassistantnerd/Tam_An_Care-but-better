import {
  apiRequest,
} from './client';

import type {
  HumanActorSession,
} from '../types/actor';

export type ResidentGender =
  | 'MALE'
  | 'FEMALE'
  | 'OTHER'
  | 'UNSPECIFIED';

export type ResidentCareLevel =
  | 'INDEPENDENT'
  | 'ASSISTED'
  | 'HIGH_ASSISTANCE'
  | 'DEPENDENT';

export interface ResidentContext {
  residentId: string;
  residentCode: string;
  displayName: string;
  dateOfBirth: string;
  gender: ResidentGender;
  room: string | null;
  bed: string | null;
  careLevel: ResidentCareLevel;
  activeStatus: boolean;
}

export interface ResidentContextResponse {
  resident: ResidentContext;
  source: 'V7.4.3_DEVELOPMENT_CONTEXT';
  clinicalRecord: false;
}

export type Availability =
  | 'AVAILABLE'
  | 'EMPTY'
  | 'UNAVAILABLE';

export interface OperationalCareViewResponse {
  status: 'OK';
  generatedAt: string;
  viewMode: 'OPERATIONAL_READ_ONLY';

  resident: Record<string, unknown>;
  initialAssessment?: null | {
    assessmentVersion: number;
    assessmentStatus: string;
    updatedAt: string | null;
    summary: unknown;
  };
  carePlan: Record<string, unknown> | null;
  workQueue: Array<Record<string, unknown>>;
  clinical: Array<Record<string, unknown>>;

  medication: {
    orders: Array<Record<string, unknown>>;
    administrations:
      Array<Record<string, unknown>>;
  };

  incidents: Array<Record<string, unknown>>;

  availability: {
    resident: Availability;
    carePlan: Availability;
    workQueue: Availability;
    clinical: Availability;
    medicationOrders: Availability;
    medicationAdministrations: Availability;
    incidents: Availability;
  };

  freshness: Record<
    string,
    {
      sourceTimestamp: string | null;
      generatedAt: string;
    }
  >;

  provenance: Record<string, unknown>;

  authority: {
    readOnly: boolean;
    crossDomainMutation: boolean;
    autonomousClinicalAction: boolean;
    autonomousMedicationAction: boolean;
    autonomousIncidentAction: boolean;
    autonomousCarePlanAction: boolean;
    autonomousCareTaskAction: boolean;
  };

  access: {
    actorRole: string;
    scope: string;
    serverAuthorized: boolean;
    residentScopeEnforcement:
      'CANONICAL_RESIDENT_SCOPE';
    redactionApplied: boolean;
  };

  limits: {
    perSourceDomain: number;
  };
}

// Use the same Vietnamese given-name ordering for resident dropdowns, lists,
// and offline read-only display. Sorting never changes stored resident records.
const viResidentCollator = new Intl.Collator('vi', {
  sensitivity: 'base',
  numeric: true,
});

export function sortResidentsAlphabetically(
  items: readonly ResidentContextResponse[],
): ResidentContextResponse[] {
  const key = (name: string) => {
    const parts = String(name || '').trim().split(/\s+/u);
    return parts[parts.length - 1] || '';
  };
  return [...items].sort((a, b) =>
    viResidentCollator.compare(key(a.resident.displayName), key(b.resident.displayName))
    || viResidentCollator.compare(a.resident.displayName, b.resident.displayName)
    || a.resident.residentId.localeCompare(b.resident.residentId)
  );
}

export async function listResidents(
  actor?: HumanActorSession | null,
): Promise<ResidentContextResponse[]> {
  // Direct-care and psychosocial roles only see residents they are assigned to.
  const residents = await apiRequest<ResidentContextResponse[]>(
    actor && ['NURSE', 'CAREGIVER', 'PSYCHOLOGIST', 'SOCIAL_WORKER'].includes(actor.actorRole)
      ? '/api/operations/residents/assigned' : '/api/residents',
    {
      actor,
    },
  );
  return sortResidentsAlphabetically(residents);
}

export async function getResident(
  residentId: string,
  actor?: HumanActorSession | null,
): Promise<ResidentContextResponse> {
  if (!residentId.trim()) {
    throw new Error(
      'Mã cư dân không được để trống.',
    );
  }

  return apiRequest<ResidentContextResponse>(
    `/api/residents/${encodeURIComponent(residentId)}`,
    {
      actor,
    },
  );
}

// Security-sensitive endpoint: never substitute mock/localStorage data for an
// API denial, unavailable server, or missing resident. Caller handles 401/403/404.
export async function getResidentCareView(
  residentId: string,
  actor: HumanActorSession,
): Promise<OperationalCareViewResponse> {
  if (!residentId.trim()) {
    throw new Error(
      'Mã cư dân không được để trống.',
    );
  }

  return apiRequest<OperationalCareViewResponse>(
    `/api/operations/residents/${encodeURIComponent(residentId)}/care-view`,
    {
      actor,
    },
  );
}

export function recordResidentVitals(residentId: string, actor: HumanActorSession,
  measurements: Record<string, number>, note: string) {
  return apiRequest<{ recorded: string[] }>(`/api/residents/${encodeURIComponent(residentId)}/vital-signs`, {
    actor, method: 'POST', body: JSON.stringify({ measurements, note, measuredAt: new Date().toISOString() }),
  });
}
