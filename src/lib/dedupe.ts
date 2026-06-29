import type { Bathroom } from '@/src/data/types';
import { distanceKm } from './ranking';

export interface DuplicateDecision {
  duplicate: boolean;
  confidence: number;
  reasons: string[];
}

export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(restroom|bathroom|toilet|public|the)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function arePotentialDuplicates(a: Bathroom, b: Bathroom): DuplicateDecision {
  const metersApart = distanceKm(a.latitude, a.longitude, b.latitude, b.longitude) * 1000;
  const nameA = normalizeName(a.name);
  const nameB = normalizeName(b.name);
  const addressA = normalizeName(a.address);
  const addressB = normalizeName(b.address);
  const sharedSource = a.sourceRefs.some((source) =>
    b.sourceRefs.some((other) => source.sourceName === other.sourceName && source.sourceId === other.sourceId),
  );
  const reasons: string[] = [];
  let confidence = 0;

  if (sharedSource) {
    reasons.push('shared source id');
    confidence += 0.55;
  }
  if (metersApart <= 35) {
    reasons.push('within 35 meters');
    confidence += 0.25;
  } else if (metersApart <= 80) {
    reasons.push('within 80 meters');
    confidence += 0.12;
  }
  if (nameA && nameB && (nameA === nameB || nameA.includes(nameB) || nameB.includes(nameA))) {
    reasons.push('matching normalized name');
    confidence += 0.2;
  }
  if (addressA && addressB && addressA === addressB) {
    reasons.push('matching normalized address');
    confidence += 0.18;
  }

  const finalConfidence = Math.min(1, Math.round(confidence * 100) / 100);
  return {
    duplicate: finalConfidence >= 0.55,
    confidence: finalConfidence,
    reasons,
  };
}
