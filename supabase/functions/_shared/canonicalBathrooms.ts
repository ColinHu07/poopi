import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.110.0';

export type CanonicalBathroomInput = {
  sourceName: 'refuge' | 'osm' | 'user';
  sourceId: string;
  fetchedAt: string;
  license: string;
  name: string;
  kind: string;
  address: string;
  neighborhood: string;
  city: string;
  latitude: number;
  longitude: number;
  access: string;
  feeRequired?: boolean;
  priceNote: string;
  openingHours: string;
  confidence: number;
  directionsNote: string;
  lastConfirmedAt?: string;
  confirmedByUsers: number;
  contradictedByUsers: number;
  features: string[];
};

export type CanonicalBathroomResult = {
  bathroomId: string;
  created: boolean;
  deduplicated: boolean;
};

export async function upsertCanonicalBathroom(
  supabase: SupabaseClient,
  input: CanonicalBathroomInput,
): Promise<CanonicalBathroomResult> {
  const { data, error } = await supabase.rpc('upsert_canonical_bathroom', {
    p_source_name: input.sourceName,
    p_source_id: input.sourceId,
    p_fetched_at: input.fetchedAt,
    p_license: input.license,
    p_name: input.name,
    p_kind: input.kind,
    p_address: input.address,
    p_neighborhood: input.neighborhood,
    p_city: input.city,
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_access: input.access,
    p_fee_required: input.feeRequired ?? null,
    p_price_note: input.priceNote,
    p_opening_hours: input.openingHours,
    p_confidence: input.confidence,
    p_directions_note: input.directionsNote,
    p_last_confirmed_at: input.lastConfirmedAt ?? null,
    p_confirmed_by_users: input.confirmedByUsers,
    p_contradicted_by_users: input.contradictedByUsers,
    p_features: input.features,
  });

  if (error) throw error;
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.bathroom_id) throw new Error('Canonical bathroom RPC returned no UUID.');

  return {
    bathroomId: String(result.bathroom_id),
    created: Boolean(result.created),
    deduplicated: Boolean(result.deduplicated),
  };
}
