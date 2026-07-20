import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.0';
import {
  normalizeOsmCandidate,
  type OsmToiletElement,
} from '../../../src/services/externalBathroomCandidates.ts';
import { upsertCanonicalBathroom } from '../_shared/canonicalBathrooms.ts';
import { corsHeaders, json } from '../_shared/http.ts';

type ImportBody = { latitude?: number; longitude?: number; radiusMeters?: number };

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const body = (await request.json().catch(() => ({}))) as ImportBody;
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const radiusMeters = Math.min(Math.max(Number(body.radiusMeters ?? 5000), 100), 5000);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return json({ error: 'latitude and longitude are required.' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Supabase service role env is not configured.' }, 500);
  }

  const query = `[out:json][timeout:25];nwr["amenity"="toilets"](around:${Math.round(radiusMeters)},${latitude},${longitude});out center tags;`;
  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ data: query }),
  });
  if (!response.ok) return json({ error: `OpenStreetMap request failed with ${response.status}.` }, 502);

  const payload = (await response.json()) as { elements?: OsmToiletElement[] };
  const elements = payload.elements ?? [];
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const bathroomIds = new Set<string>();
  let createdCount = 0;
  let deduplicatedCount = 0;
  let rejectedCount = 0;
  const fetchedAt = new Date().toISOString();

  for (const element of elements) {
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      rejectedCount += 1;
      continue;
    }
    try {
      const result = await upsertCanonicalBathroom(supabase, normalizeOsmCandidate(element, fetchedAt));
      bathroomIds.add(result.bathroomId);
      if (result.created) createdCount += 1;
      if (result.deduplicated) deduplicatedCount += 1;
    } catch {
      rejectedCount += 1;
    }
  }

  return json({
    bathroomIds: [...bathroomIds],
    fetchedCount: elements.length,
    mergedCount: bathroomIds.size,
    createdCount,
    deduplicatedCount,
    rejectedCount,
  });
});
