import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.0';

type RefugeRestroom = {
  id: number;
  name: string;
  street: string;
  city: string;
  state: string;
  accessible: boolean;
  unisex: boolean;
  directions: string;
  comment: string;
  latitude: number;
  longitude: number;
  updated_at: string;
  downvote: number;
  upvote: number;
  changing_table: boolean;
  approved: boolean;
};

type ImportBody = {
  latitude?: number;
  longitude?: number;
  perPage?: number;
};

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  const body = (await request.json().catch(() => ({}))) as ImportBody;
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const perPage = Math.min(Math.max(Number(body.perPage ?? 40), 1), 100);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return json({ error: 'latitude and longitude are required.' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Supabase service role env is not configured.' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const refugeUrl = new URL('https://www.refugerestrooms.org/api/v1/restrooms/by_location');
  refugeUrl.searchParams.set('lat', String(latitude));
  refugeUrl.searchParams.set('lng', String(longitude));
  refugeUrl.searchParams.set('page', '1');
  refugeUrl.searchParams.set('per_page', String(perPage));
  refugeUrl.searchParams.set('offset', '0');

  const response = await fetch(refugeUrl.toString(), { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    return json({ error: `Refuge request failed with ${response.status}.` }, 502);
  }

  const records = (await response.json()) as RefugeRestroom[];
  const bathrooms = [];

  for (const record of records) {
    if (!record.latitude || !record.longitude) {
      continue;
    }

    const confidence = confidenceFromVotes(record.upvote, record.downvote, record.approved ? 0.68 : 0.35);
    const { data: existingSource } = await supabase
      .from('bathroom_sources')
      .select('bathroom_id')
      .eq('source_name', 'refuge')
      .eq('source_id', String(record.id))
      .maybeSingle();

    const bathroomPayload = {
      name: record.name || 'Unnamed restroom',
      kind: 'Community restroom',
      address: [record.street, record.city, record.state].filter(Boolean).join(', '),
      neighborhood: record.city || '',
      city: record.city || '',
      location: `POINT(${record.longitude} ${record.latitude})`,
      access: 'unknown',
      price_note: 'Community reported',
      opening_hours: 'Unknown',
      confidence,
      directions_note: [record.directions, record.comment].filter(Boolean).join(' '),
      last_confirmed_at: record.updated_at,
    };

    const { data: bathroom, error: bathroomError } = existingSource?.bathroom_id
      ? await supabase
          .from('bathrooms')
          .update(bathroomPayload)
          .eq('id', existingSource.bathroom_id)
          .select('id')
          .single()
      : await supabase.from('bathrooms').insert(bathroomPayload).select('id').single();

    if (bathroomError || !bathroom) {
      continue;
    }

    const { data: source } = await supabase
      .from('bathroom_sources')
      .upsert(
        {
          bathroom_id: bathroom.id,
          source_name: 'refuge',
          source_id: String(record.id),
          fetched_at: new Date().toISOString(),
          license: 'Refuge Restrooms API',
          confidence,
          confirmed_by_users: record.upvote,
          contradicted_by_users: record.downvote,
        },
        { onConflict: 'source_name,source_id' },
      )
      .select('id')
      .single();

    const features = featuresFromRefuge(record);
    if (features.length) {
      await supabase.from('bathroom_features').upsert(
        features.map((feature) => ({
          bathroom_id: bathroom.id,
          feature,
          confidence,
          source_id: source?.id ?? null,
        })),
        { onConflict: 'bathroom_id,feature' },
      );
    }

    bathrooms.push({
      id: bathroom.id,
      name: bathroomPayload.name,
      kind: bathroomPayload.kind,
      address: bathroomPayload.address,
      neighborhood: bathroomPayload.neighborhood,
      city: bathroomPayload.city,
      latitude: record.latitude,
      longitude: record.longitude,
      access: bathroomPayload.access,
      price_note: bathroomPayload.price_note,
      opening_hours: bathroomPayload.opening_hours,
      confidence,
      directions_note: bathroomPayload.directions_note,
      last_confirmed_at: record.updated_at,
      features,
      source_refs: [
        {
          sourceName: 'refuge',
          sourceId: String(record.id),
          fetchedAt: record.updated_at,
          license: 'Refuge Restrooms API',
          confidence,
          confirmedByUsers: record.upvote,
          contradictedByUsers: record.downvote,
        },
      ],
      community_score: 6,
    });
  }

  return json({ bathrooms, fetchedCount: records.length, mergedCount: bathrooms.length });
});

function featuresFromRefuge(record: RefugeRestroom) {
  const features = new Set<string>();
  if (record.accessible) {
    features.add('wheelchair_accessible');
  }
  if (record.unisex) {
    features.add('all_gender');
    features.add('single_stall');
  }
  if (record.changing_table) {
    features.add('baby_changing');
  }
  return [...features];
}

function confidenceFromVotes(upvote: number, downvote: number, base: number) {
  const totalVotes = upvote + downvote;
  if (totalVotes === 0) {
    return base;
  }
  const voteScore = upvote / totalVotes;
  return Math.round((base * 0.55 + voteScore * 0.45) * 100) / 100;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
