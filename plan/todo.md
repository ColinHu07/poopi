# Poopi Collaborator Roadmap

> This file is the source of truth for product and engineering work. Check off a task only after its acceptance criterion is met and the change is merged.

**Last verified:** July 19, 2026<br>
**North star:** Make Poopi the fastest way to find a trustworthy nearby bathroom, then layer in Beli-style personal rankings and social discovery.

## How to use this roadmap

- Priorities: **P0** = required for a trustworthy finder, **P1** = Beli-style social loop, **P2** = expansion.
- Workstreams: **DATA**, **MAP**, **REVIEW**, **SOCIAL**, **SAFETY**, and **QA**.
- Claim a task by replacing `@unassigned` with your handle before starting work.
- Add the PR link at the end of the task when one exists.
- Do not mark a task complete because its UI exists; its “Done when” condition must also work against real data.
- When a task changes an interface, update `src/data/types.ts`, its Supabase contract, tests, and this roadmap in the same PR.

## Current app overview

### Working today

- Expo/React Native app with Expo Router, an iPhone-native Apple Maps view, and a Leaflet/OpenStreetMap web map.
- Foreground location permission, nearby markers, marker selection, map filters, and a New York fallback.
- Supabase email/password and Google OAuth authentication, anonymous guest sessions, profile completion, PostGIS schema, and row-level security.
- Persistent anonymous comparison identities, permanent-account contribution gates, and a privacy-safe public review API that excludes user IDs and private notes.
- Five tabs: Map, Rank, Feed, Lists, and Profile, with account-only actions gated at the point of use.
- Trust-focused bathroom details with status, approximate distance/walking ETA, directions, access, condition summaries, confidence, sources, common labels, and anonymous public reviews.
- Structured visit logging with sentiment, required cleanliness/smell/privacy ratings, wait, status, observed access, visibility, good/bad labels, public notes, and private notes.
- Explicit OpenStreetMap venue/address search, automatic current-venue suggestions, editable place confirmation, a draggable web location pin, and manual missing-bathroom entry.
- Private Save/Unsave backed by a system-created Saved list, hydrated list contents, and signed-in reporting with moderation-friendly reasons.
- Recency-weighted bathroom summaries with dimension scores, median recent wait, review count, freshness, confidence, and expiring operating status.
- Personal Elo-style rankings plus weighted community Bradley-Terry aggregation from pairwise votes.
- Canonical UUID persistence for Refuge, OpenStreetMap, and user-created candidates, with shared normalization, cross-source deduplication, and source provenance.
- Responsive static web export and Sites packaging for phone-browser testing.
- `npm run typecheck` passes and all 47 current automated tests pass.

### Incomplete or misleading today

- Lists hydrate their bathrooms and support the private Saved collection, but users cannot create or edit custom lists yet.
- Follows and feed tables exist, but there is no friend discovery and visits do not produce a followed-friends feed.
- Community comparison aggregation still needs a server-side cache for scale.
- Free-form opening hours still need reliable parsing; until then, the app presents operating status as unknown unless a recent observation confirms it.
- The main map still lacks destination search, “search this area,” clustering, and a synchronized map/list bottom sheet.
- Photo tables and moderation copy exist, but there is no storage/upload workflow.
- Android still receives a list fallback instead of a functional map.

## Product principles

1. **Find first.** A person who urgently needs a bathroom should reach a useful result without making an account.
2. **Unknown is honest.** Never present unknown hours, access, availability, or freshness as confirmed.
3. **Conditions expire.** Smell, cleanliness, wait, supplies, and working status are timestamped observations, not permanent features.
4. **Needs are constraints.** Accessibility, open status, access type, and budget filters are applied before recommendation ranking.
5. **Contributing is quick.** A useful visit review should take less than 30 seconds; notes and photos remain optional.
6. **Privacy is structural.** Public profile data is deliberately limited, private notes never enter public queries, and sensitive bathroom photos are prohibited.
7. **Rate, then tag.** Good/bad labels are optional observations unlocked only after the user chooses an overall bathroom rating; labels cannot be submitted by themselves.

## Feedback taxonomy

Poopi's Beli-style grading labels are attached to a completed rating and are not standalone bathroom facts. The launch catalog keeps good and bad labels separate and alphabetized. Urgent conditions can also be submitted through the report/status flow independently of a rating.

| Group | Approved grading tags |
|---|---|
| Good things | Bidet, Changing Table, Easy to Find, Family Restroom, Free to Use, Fresh-Smelling, Gender Neutral, Good Ventilation, Great Lighting, Great Soap, Hidden Gem, Hooks and Shelves, Luxury Bathroom, Menstrual Products, Minimal Stall Gaps, No Wait, Open Late, Paper Towels, Plenty of Stalls, Short Line, Single-Stall, Sparkling Clean, Spacious, Step-Free, Strong Locks, Touchless Fixtures, Very Private, Well Maintained, Well Stocked, Wheelchair Accessible |
| Bad things | Broken Lock, Crowded, Cramped, Customers Only, Dirty, Felt Unsafe, Hard to Find, Little Privacy, Long Line, No Soap, No Toilet Paper, Out of Order, Poor Lighting, Poor Ventilation, Poorly Stocked, Smelly |

This is the complete launch set of 46 labels. The picker separates good and bad things and keeps each section alphabetized.

### Rating-gated behavior

1. The user chooses the overall rating/sentiment first.
2. Only then does the positive tag picker become visible and interactive.
3. Tags are optional, but every submitted tag must belong to the same `VisitObservation` as the rating.
4. Removing or deleting the rating also removes its tag endorsements.
5. Bathroom details may summarize commonly selected tags only from valid, visible ratings and should weight recent endorsements more heavily.
6. Reports and status corrections remain available independently because they are safety/data-quality actions, not grading tags.

### Target client contracts

- `BathroomFeature`: source-backed facts used for discovery and filtering; these remain separate from user grading tags.
- `RatingTag`: a controlled union containing exactly the 46 approved good/bad labels above.
- `WaitBucket`: `none | under_five | five_to_ten | ten_to_twenty | over_twenty`.
- `OperatingStatus`: `open | closed | partly_out_of_order | out_of_order | unknown`.
- `VisitVisibility`: `public | friends | private`.
- `VisitObservation`: bathroom/user IDs, required overall sentiment/rating, 1–5 cleanliness/odor/privacy values, wait bucket, observed access/status, optional `ratingTags`, public note, optional private note, visibility, and timestamp.
- `BathroomSummary`: recency-weighted cleanliness/odor/privacy scores, median wait bucket, review count, community score, confidence, last confirmation, and operating status.
- Nearby and detail responses: include `distanceMeters`, `summary`, data freshness, and explicit unknown states.

### Aggregation and recommendation defaults

- Map sentiment to `liked = 9`, `fine = 6`, and `disliked = 3` for community aggregation.
- Compute community preference from the global pairwise comparison graph with a regularized Bradley-Terry model.
- Give established contributors modest additional weight using `1 + sqrt(min(history, 100) / 100)`, capped at `2x`; enforce one mutable vote per identity and bathroom pair.
- Interpolate the resulting global order onto `1.0–10.0`; expose comparison volume/confidence so sparse scores are not presented as settled consensus.
- Compute dimension scores from timestamped 1–5 observations using the same recency weighting; show no score when there are no observations.
- Compute median wait from public observations in the latest 90 days; otherwise display `Unknown`.
- Derive confidence from source confidence, independent confirmations, contradictions, review volume, and freshness. Confidence must not imply that a bathroom is open.
- Apply open/access/cost/accessibility filters as hard constraints. Rank remaining results by 30% proximity, 25% community quality, 20% preference match, 15% freshness/confidence, and 10% expected wait.

## P0 — Useful, trustworthy bathroom finder

### Shared contract and data gate

- [x] **P0 · DATA-01 — Split facts from rated endorsements** — Owner: `@codex` · Depends on: none · Done when: TypeScript types and a forward-only Supabase migration implement the target contracts, restrict `RatingTag` to the approved good/bad catalog, require every tag row to reference a rating, and migrate compatible existing visit tags without losing data. PR: [#3](https://github.com/ColinHu07/poopi/pull/3)
- [x] **P0 · DATA-02 — Build trustworthy bathroom summaries** — Owner: `@codex` · Depends on: DATA-01 · Done when: nearby/detail queries return real recency-weighted scores, wait, counts, freshness, confidence, and status instead of hard-coded values. PR: [#4](https://github.com/ColinHu07/poopi/pull/4)
- [x] **P0 · DATA-03 — Separate public reads from identity-bound writes** — Owner: `@codex` · Depends on: DATA-01 · Done when: guests can read public data and submit rate-limited comparisons through persistent anonymous identities; account-only and private writes require permanent users; private notes and non-public visits fail public RLS tests. PR: [#5](https://github.com/ColinHu07/poopi/pull/5)
- [x] **P0 · DATA-04 — Resolve and persist every bathroom before rating** — Owner: `@codex` · Depends on: DATA-01 · Done when: Refuge/place-search results and user-created candidates are normalized, upserted, and deduplicated to Poopi UUIDs before entering the client; an existing bathroom at the same verified venue/location receives the new rating and photo instead of a duplicate; and every displayed result can be reviewed, saved, or reported. PR: [#7](https://github.com/ColinHu07/poopi/pull/7)
- [x] **P0 · DATA-05 — Add OSM ingestion** — Owner: `@codex` · Depends on: DATA-04 · Done when: the existing OSM normalizer feeds the same import pipeline, source IDs are preserved, and OSM/Refuge/user duplicates resolve to one bathroom. PR: [#7](https://github.com/ColinHu07/poopi/pull/7)
- [x] **P0 · DATA-06 — Remove false data certainty** — Owner: `@codex` · Depends on: DATA-01, DATA-02 · Done when: unknown hours never produce `isOpenNow = true`, missing confirmations stay missing, free filtering uses cost/access facts correctly, and the nearby RPC enforces a real radius. PR: [#7](https://github.com/ColinHu07/poopi/pull/7)

### Map and discovery

- [x] **P0 · MAP-01 — Enable guest discovery** — Owner: `@codex` · Depends on: DATA-03 · Done when: a user can continue as a guest, open Map, grant/deny location, search, inspect details, and submit comparisons without creating a profile; account-only actions present sign-in at the point of action. PR: [#15](https://github.com/ColinHu07/poopi/pull/15)
- [x] **P0 · MAP-02 — Add destination, venue, and viewport search** — Owner: `@codex` · Depends on: DATA-04 · Done when: users can search an address/place against a real-world place index, use current location to prioritize nearby suggestions, confirm or edit the venue/address/location, recenter, pan, and explicitly run “Search this area” without the camera unexpectedly snapping back. Location-denied and failed-match states offer manual place/address entry. PR: [#10](https://github.com/ColinHu07/poopi/pull/10), [#14](https://github.com/ColinHu07/poopi/pull/14)
- [x] **P0 · MAP-03 — Build an intuitive map/list result surface** — Owner: `@codex` · Depends on: DATA-02, MAP-02 · Done when: clustered markers and a synchronized bottom-sheet list show score/status, distance, access, freshness, and selection consistently. PR: [#14](https://github.com/ColinHu07/poopi/pull/14)
- [x] **P0 · MAP-04 — Add routing and ETA** — Owner: `@codex` · Depends on: MAP-03 · Done when: each result/detail displays distance and walking ETA and can open Apple Maps directions to the correct coordinates. PR: [#15](https://github.com/ColinHu07/poopi/pull/15)
- [x] **P0 · MAP-05 — Add fast need-based filters** — Owner: `@codex` · Depends on: DATA-02, MAP-02 · Done when: open status, free/public, maximum wait, minimum cleanliness, wheelchair, all-gender, single-stall, and changing-table filters produce correct map/list results and clear active-filter states. PR: [#15](https://github.com/ColinHu07/poopi/pull/15)

### Details, reviews, and corrections

- [x] **P0 · REVIEW-01 — Redesign bathroom details around trust** — Owner: `@codex` · Depends on: DATA-02, MAP-04 · Done when: details prioritize current status, distance/ETA, directions, access/cost, recent condition summaries, confidence, last confirmation, public reviews, and source attribution. PR: [#12](https://github.com/ColinHu07/poopi/pull/12)
- [x] **P0 · REVIEW-02 — Build the sub-30-second review flow** — Owner: `@codex` · Depends on: DATA-01 · Done when: a signed-in user must choose an overall rating before the optional label picker appears, can browse the complete 46-label good/bad catalog, and can submit the rating, structured observations, visibility, labels, and optional note with accessible controls and clear validation. PR: [#12](https://github.com/ColinHu07/poopi/pull/12)
- [x] **P0 · REVIEW-03 — Publish and aggregate safe reviews** — Owner: `@codex` · Depends on: DATA-02, DATA-03, REVIEW-02 · Done when: public reviews appear on details and update summaries immediately, commonly selected good/bad labels are aggregated only from valid ratings, friends/private reviews respect visibility, and private notes never leave owner-scoped queries. PR: [#12](https://github.com/ColinHu07/poopi/pull/12)
- [x] **P0 · REVIEW-04 — Connect reporting and missing-bathroom flows** — Owner: `@codex` · Depends on: DATA-03, DATA-04, MAP-02 · Done when: “Rate a bathroom” can start even when no map point exists; with permission, the app suggests the user’s current venue, checks nearby canonical bathrooms, and asks for confirmation before attaching the rating; without a reliable match, the user can search or manually enter and edit the venue name, address, and map pin before creation. Signed-in users can also report closed, out-of-order, unsafe, inaccessible, inaccurate, duplicate, or privacy issues and receive a clear success/error state. PR: [#10](https://github.com/ColinHu07/poopi/pull/10), [#12](https://github.com/ColinHu07/poopi/pull/12)
- [x] **P0 · REVIEW-05 — Wire a minimal private save action** — Owner: `@codex` · Depends on: DATA-03, DATA-04 · Done when: a signed-in user can save/unsave any bathroom to one private system-created `Saved` collection and the detail button always reflects the persisted state. PR: [#12](https://github.com/ColinHu07/poopi/pull/12)
- [x] **P0 · REVIEW-06 — Reopen and edit personal reviews** — Owner: `@codex` · Depends on: REVIEW-02, REVIEW-03 · Done when: bathroom details detect the signed-in user's prior review, Profile keeps a bathroom diary, reopening a review preloads every score/label/note/access/status/privacy field, and saving updates the same visit instead of creating a duplicate. PR: pending
- [x] **P0 · UX-01 — Establish Poopi's playful visual system** — Owner: `@codex` · Depends on: MAP-03, REVIEW-02 · Done when: the map, result cards, details, rating flow, auth, profile, lists, feed, ranking, and navigation use one responsive, accessible warm-paper/cocoa/jade/coral design system derived from an approved visual direction. PR: pending

### Reliability, accessibility, and validation

- [ ] **P0 · QA-01 — Cover resilient app states** — Owner: `@unassigned` · Depends on: MAP-03, REVIEW-03 · Done when: loading, retry, offline, location-denied, empty-result, stale-data, and partial-service failures have usable screens without erasing previously loaded results. PR: —
- [ ] **P0 · QA-02 — Complete accessibility pass** — Owner: `@unassigned` · Depends on: MAP-05, REVIEW-02 · Done when: VoiceOver labels/order, Dynamic Type, contrast, reduced motion, and minimum 44×44-point touch targets pass manual iPhone checks. PR: —
- [ ] **P0 · QA-03 — Add release-level automated coverage** — Owner: `@unassigned` · Depends on: DATA-06, MAP-05, REVIEW-04 · Done when: unit, Supabase integration, and end-to-end suites cover the P0 test matrix below and run alongside typecheck in CI. PR: —

## P1 — Beli-style social loop

- [ ] **P1 · SOCIAL-01 — Expand saves into custom lists** — Owner: `@unassigned` · Depends on: REVIEW-05 · Done when: users can create, edit, reorder, delete, and share named lists, move/copy saved bathrooms between them, and enforce private/friends/public visibility. PR: —
- [ ] **P1 · SOCIAL-02 — Add public-safe profiles and follows** — Owner: `@unassigned` · Depends on: DATA-03 · Done when: users can search profiles, follow/unfollow, and expose only display name, handle, avatar, and opted-in contribution data. PR: —
- [ ] **P1 · SOCIAL-03 — Build a real friends feed** — Owner: `@unassigned` · Depends on: SOCIAL-02, REVIEW-03 · Done when: opted-in reviews, rankings, confirmations, and public/friends lists create feed events visible only to the intended audience. PR: —
- [ ] **P1 · SOCIAL-04 — Separate personal, friends, and community scores** — Owner: `@unassigned` · Depends on: SOCIAL-02, REVIEW-03 · Done when: detail and ranking screens label each score, provide sample/confidence context, and never substitute one audience’s score for another. PR: —
- [ ] **P1 · SOCIAL-05 — Finish meaningful pairwise ranking** — Owner: `@unassigned` · Depends on: REVIEW-02 · Done when: pair selection avoids repeated questions, every identity has one mutable opinion per pair, the weighted community Bradley-Terry order updates deterministically, interpolated scores include confidence context, and personal ordering remains a separately labeled optional view. PR: —
- [ ] **P1 · SOCIAL-06 — Expand profile history and editing** — Owner: `@unassigned` · Depends on: SOCIAL-04 · Done when: users can view/edit their visits, see favorite traits and contribution counts, and remove their content. PR: —
- [ ] **P1 · SAFETY-01 — Implement moderated photo uploads** — Owner: `@unassigned` · Depends on: REVIEW-03, DATA-04 · Done when: empty-room/signage images attach to the resolved canonical bathroom, upload to private storage, strip EXIF, enter moderation, use resolvable URLs, and support reporting/removal; after approval, the first valid photo replaces the “No photos” placeholder without creating a duplicate location. PR: —
- [ ] **P1 · SAFETY-02 — Finish visit privacy controls** — Owner: `@unassigned` · Depends on: SOCIAL-02, REVIEW-03 · Done when: public, friends, and private visits behave consistently across details, feed, profile, exports, and deletion. PR: —

## P2 — Expansion

- [ ] **P2 · MAP-06 — Add Android map parity** — Owner: `@unassigned` · Depends on: P0 complete · Done when: Android has a Google Maps experience matching the iPhone/web P0 discovery behavior. PR: —
- [ ] **P2 · DATA-07 — Expand city datasets and refresh jobs** — Owner: `@unassigned` · Depends on: DATA-05 · Done when: supported city sources use the shared ingestion/dedupe pipeline, scheduled refreshes are observable, and source licenses are retained. PR: —
- [ ] **P2 · MAP-07 — Personalize recommendations** — Owner: `@unassigned` · Depends on: SOCIAL-04 · Done when: opted-in saved filters and review history improve ordering without overriding hard accessibility/access constraints, and users can reset personalization. PR: —
- [ ] **P2 · SAFETY-03 — Build moderation tools** — Owner: `@unassigned` · Depends on: SAFETY-01 · Done when: authorized moderators can triage duplicates, reports, photos, abusive notes, and appeals with an audit trail. PR: —
- [ ] **P2 · QA-04 — Add privacy-safe product analytics** — Owner: `@unassigned` · Depends on: P0 complete · Done when: time-to-first-result, directions usage, review completion, and data freshness are measured without storing precise movement history or private review content. PR: —

## Collaboration lanes

Merge **DATA-01** first because it defines the shared contract. Afterward, these lanes can move in parallel:

| Lane | Primary tasks | Shared-file caution |
|---|---|---|
| Data/API | DATA-02 through DATA-06 | Coordinate edits to `src/data/types.ts`, `src/services/bathroomApi.ts`, and Supabase migrations |
| Discovery | MAP-01 through MAP-05 | Keep map-provider code behind the existing map component boundary |
| Review/detail | REVIEW-01 through REVIEW-04 | Agree on the `VisitObservation` payload before building form state |
| Quality | QA-01 through QA-03 | Add tests with feature PRs; QA owns cross-flow and RLS gaps |

Each PR should:

1. Reference its task ID in the title or description.
2. Keep generated schema/types synchronized with the client contract.
3. Include tests proportional to its behavior and screenshots/video for visible changes.
4. Update the task’s PR link; mark it complete only after merge and verification.
5. Record any intentional scope change under the task instead of silently changing its acceptance criterion.

## Test matrix

### Unit

- Validate feature/rating-tag taxonomies, rating bounds, wait buckets, and visibility values.
- Verify labels cannot be displayed or submitted before an overall rating and cannot survive deletion of their parent rating.
- Verify weighted Bradley-Terry convergence, contributor-weight caps, one-vote-per-pair behavior, interpolation, median wait, confidence, and unknown-state behavior.
- Verify hard filters precede recommendation ranking and that recommendation ordering is deterministic.
- Cover Refuge/OSM/user dedupe and external-ID-to-Poopi-UUID persistence.

### Supabase integration

- Anonymous users can read public bathroom facts, summaries, approved photos, and public reviews.
- Anonymous users can write only identity-bound comparison votes; they cannot create account-only contributions, and no user can read another user’s private note or private visit.
- Authenticated review/report/candidate writes enforce ownership and valid values.
- Review creation updates summary data without exposing protected profile fields.
- Photo visibility follows moderation and ownership rules.

### End-to-end and manual

- Guest launches, accepts or denies location, finds a bathroom, opens details, and starts Apple Maps directions.
- Destination search and “Search this area” keep map markers and list results synchronized.
- Filters handle known, unknown, and stale data without presenting false availability.
- A signed-in user submits a review in under 30 seconds and sees the public summary update.
- A user reports incorrect data and adds a missing bathroom with success, retry, and duplicate states.
- A signed-in user starts a rating at an unlisted venue, confirms or corrects the current-location suggestion, and creates exactly one reusable bathroom record; the same flow succeeds through manual place/address entry when location is denied or inaccurate.
- A cold-opened bathroom link loads correct details without relying on the in-memory map cache.
- Core flows remain usable with VoiceOver, large text, reduced motion, slow network, and temporary offline state.

## P0 acceptance criteria

P0 is complete only when:

- A guest can find, evaluate, and route to a suitable nearby bathroom without creating an account.
- Every displayed bathroom has a Poopi UUID and supports authenticated review, save, and reporting actions.
- A signed-in user can submit structured feedback that becomes a privacy-safe public review and updates trustworthy summaries.
- The app distinguishes open, closed, stale, and unknown data and never fabricates confirmation freshness.
- Location denial, empty results, service errors, and offline behavior have tested recovery paths.
- Typecheck, unit tests, Supabase integration tests, and P0 end-to-end tests pass in CI.

## Assumptions and boundaries

- The first release is utility-first and iPhone-first, retaining Apple Maps.
- Bathroom discovery and public details are available without an account.
- Social features remain important but follow the reliable finder/review milestone.
- Live access codes are not stored or shared; the app shows only that a code is required.
- Photos containing people, faces, children, or sensitive reflections are prohibited.
- Current location is used only to suggest/confirm the venue for the active flow; Poopi does not retain a user’s raw location history.
- No delivery date or named collaborator assignments are assumed.
- Android Google Maps and full web parity are P2 unless release strategy changes.
