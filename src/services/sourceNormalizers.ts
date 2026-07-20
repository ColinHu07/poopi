import type { Bathroom, FeatureTag, SourceRef } from '@/src/data/types';
import { freshnessState } from '@/src/lib/bathroomSummary';
import {
  normalizeOsmCandidate,
  normalizeRefugeCandidate,
  type ExternalBathroomCandidate,
  type OsmToiletElement,
  type RefugeRestroom,
} from '@/src/services/externalBathroomCandidates';

export type { OsmToiletElement, RefugeRestroom };

export function normalizeRefugeRestroom(record: RefugeRestroom): Bathroom {
  return candidateToBathroom(normalizeRefugeCandidate(record));
}

export function normalizeOsmToilet(element: OsmToiletElement): Bathroom {
  return candidateToBathroom(normalizeOsmCandidate(element));
}

function candidateToBathroom(candidate: ExternalBathroomCandidate): Bathroom {
  const sourceRef: SourceRef = {
    sourceName: candidate.sourceName,
    sourceId: candidate.sourceId,
    fetchedAt: candidate.fetchedAt,
    license: candidate.license,
    confidence: candidate.confidence,
    confirmedByUsers: candidate.confirmedByUsers,
    contradictedByUsers: candidate.contradictedByUsers,
  };

  return {
    id: candidate.externalId,
    name: candidate.name,
    kind: candidate.kind,
    address: candidate.address,
    neighborhood: candidate.neighborhood,
    city: candidate.city,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    access: candidate.access,
    feeRequired: candidate.feeRequired,
    priceNote: candidate.priceNote,
    openingHours: candidate.openingHours,
    isOpenNow: false,
    confidence: candidate.confidence,
    features: candidate.features as FeatureTag[],
    directionsNote: candidate.directionsNote,
    sourceRefs: [sourceRef],
    photos: [],
    reportsSummary: {},
    summary: {
      reviewCount: 0,
      confidence: candidate.confidence,
      lastConfirmedAt: candidate.lastConfirmedAt,
      operatingStatus: 'unknown',
      freshness: freshnessState(candidate.lastConfirmedAt),
    },
    scores: {
      community: 0,
      communityReviewCount: 0,
      confidence: candidate.confidence,
      recommendation: 0.5,
    },
    userStatus: 'unvisited',
    lastConfirmedAt: candidate.lastConfirmedAt,
  };
}
