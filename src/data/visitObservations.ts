import {
  ACCESS_TYPES,
  OPERATING_STATUSES,
  VISIT_VISIBILITIES,
  WAIT_BUCKETS,
  type AccessType,
  type OperatingStatus,
  type VisitVisibility,
  type WaitBucket,
} from './types';

const waitBuckets = new Set<string>(WAIT_BUCKETS);
const operatingStatuses = new Set<string>(OPERATING_STATUSES);
const visitVisibilities = new Set<string>(VISIT_VISIBILITIES);
const accessTypes = new Set<string>(ACCESS_TYPES);

export function isDimensionRating(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
}

export function isWaitBucket(value: string): value is WaitBucket {
  return waitBuckets.has(value);
}

export function isOperatingStatus(value: string): value is OperatingStatus {
  return operatingStatuses.has(value);
}

export function isVisitVisibility(value: string): value is VisitVisibility {
  return visitVisibilities.has(value);
}

export function isAccessType(value: string): value is AccessType {
  return accessTypes.has(value);
}

