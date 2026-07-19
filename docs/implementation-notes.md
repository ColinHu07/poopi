# Poopi App Notes

This repo implements the MVP as an Expo Router app with Supabase auth/data wiring, an auth-gated homepage, and a real iOS Apple Maps view. Add the public Supabase env vars from `.env.example`, apply `supabase/schema.sql`, deploy `supabase/functions/import-refuge-nearby`, then restart Expo.

## Implemented

- Auth flow: welcome, sign up, log in, complete profile, and session-gated tabs.
- Five-tab mobile app: Map, Rank, Feed, Lists, Profile.
- Native iOS Apple Maps homepage with Expo Location permission and nearby Refuge/Supabase bathroom loading.
- Bathroom detail screen with photos, access facts, tags, notes, provenance, confidence, and scores.
- Log-visit modal with sentiment seed, tags, note, and privacy/moderation copy.
- Supabase API facade for nearby search, details, visits, comparisons, reports, lists, feed, and profile.
- Ranking library with personal Elo ordering, weighted community Bradley-Terry aggregation, display score mapping, binary pair selection, and recommendation score.
- Guest mode uses a persisted anonymous Supabase identity, allowing comparison votes without account-creation friction.
- Source normalizers for Refuge Restrooms and OSM toilet elements.
- Dedupe helper using source ids, proximity, normalized names, and normalized addresses.
- Supabase/PostGIS schema with profiles, RLS policies, user-owned rows, and a nearby bathroom RPC.
- Refuge import Edge Function for first real restroom markers.

## Backend Interfaces

`src/services/bathroomApi.ts` now exposes client methods matching the planned API:

- `GET /bathrooms/nearby?lat&lng&filters`
- `GET /bathrooms/:id`
- `POST /bathrooms`
- `POST /visits`
- `POST /comparisons`
- `POST /reports`

Keep the TypeScript types in `src/data/types.ts` as the client contract. The visualizer remains fixture-backed so concept screens still work without Supabase.
