# Poopi App Notes

This repo implements the MVP as an Expo Router app with a local data service that mirrors the planned API shape. The UI is ready to point at Supabase endpoints once the schema in `supabase/schema.sql` is applied.

## Implemented

- Five-tab mobile app: Map, Rank, Feed, Lists, Profile.
- Bathroom detail screen with photos, access facts, tags, notes, provenance, confidence, and scores.
- Log-visit modal with sentiment seed, tags, note, and privacy/moderation copy.
- Local API facade for nearby search, details, visits, comparisons, reports, lists, feed, and profile.
- Ranking library with sentiment seeding, Elo comparisons, display score mapping, binary pair selection, Bayesian community score, and recommendation score.
- Source normalizers for Refuge Restrooms and OSM toilet elements.
- Dedupe helper using source ids, proximity, normalized names, and normalized addresses.
- Supabase/PostGIS schema for the planned backend tables.

## Next Backend Swap

Replace `src/services/bathroomApi.ts` with network calls matching the planned API:

- `GET /bathrooms/nearby?lat&lng&filters`
- `GET /bathrooms/:id`
- `POST /bathrooms`
- `POST /visits`
- `POST /comparisons`
- `POST /reports`

Keep the TypeScript types in `src/data/types.ts` as the client contract.
