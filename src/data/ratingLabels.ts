import {
  NEGATIVE_RATING_LABELS,
  POSITIVE_RATING_LABELS,
  RATING_LABELS,
  type RatingLabel,
  type Sentiment,
} from './types';

export type RatingLabelTone = 'positive' | 'negative';

export type RatingLabelCategory =
  | 'cleanliness'
  | 'convenience'
  | 'privacy'
  | 'accessibility'
  | 'standout';

export interface RatingLabelDefinition {
  id: RatingLabel;
  label: string;
  tone: RatingLabelTone;
  category: RatingLabelCategory;
  featured: boolean;
}

export const RATING_LABEL_CATEGORY_TITLES: Record<RatingLabelCategory, string> = {
  cleanliness: 'Cleanliness & essentials',
  convenience: 'Wait & convenience',
  privacy: 'Privacy & comfort',
  accessibility: 'Accessibility & inclusion',
  standout: 'Standout features',
};

export const RATING_LABEL_DEFINITIONS: RatingLabelDefinition[] = [
  positive('sparkling_clean', 'Sparkling Clean', 'cleanliness', true),
  positive('fresh_smelling', 'Fresh-Smelling', 'cleanliness', true),
  positive('well_stocked', 'Well Stocked', 'cleanliness', true),
  positive('great_soap', 'Great Soap', 'cleanliness'),
  positive('paper_towels', 'Paper Towels', 'cleanliness'),
  positive('well_maintained', 'Well Maintained', 'cleanliness'),
  positive('no_wait', 'No Wait', 'convenience', true),
  positive('short_line', 'Short Line', 'convenience', true),
  positive('plenty_of_stalls', 'Plenty of Stalls', 'convenience'),
  positive('easy_to_find', 'Easy to Find', 'convenience'),
  positive('open_late', 'Open Late', 'convenience'),
  positive('free_to_use', 'Free to Use', 'convenience'),
  positive('very_private', 'Very Private', 'privacy', true),
  positive('single_stall', 'Single-Stall', 'privacy'),
  positive('strong_locks', 'Strong Locks', 'privacy', true),
  positive('minimal_stall_gaps', 'Minimal Stall Gaps', 'privacy'),
  positive('spacious', 'Spacious', 'privacy', true),
  positive('great_lighting', 'Great Lighting', 'privacy', true),
  positive('good_ventilation', 'Good Ventilation', 'privacy'),
  positive('hooks_and_shelves', 'Hooks & Shelves', 'privacy'),
  positive('gender_neutral', 'Gender Neutral', 'accessibility', true),
  positive('wheelchair_accessible', 'Wheelchair Accessible', 'accessibility', true),
  positive('step_free', 'Step-Free', 'accessibility'),
  positive('family_restroom', 'Family Restroom', 'accessibility'),
  positive('changing_table', 'Changing Table', 'accessibility', true),
  positive('menstrual_products', 'Menstrual Products', 'accessibility'),
  positive('touchless_fixtures', 'Touchless Fixtures', 'standout'),
  positive('bidet', 'Bidet', 'standout'),
  positive('luxury_bathroom', 'Luxury Bathroom', 'standout'),
  positive('hidden_gem', 'Hidden Gem', 'standout'),

  negative('dirty', 'Dirty', 'cleanliness', true),
  negative('smelly', 'Smelly', 'cleanliness', true),
  negative('poorly_stocked', 'Poorly Stocked', 'cleanliness', true),
  negative('no_toilet_paper', 'No Toilet Paper', 'cleanliness', true),
  negative('no_soap', 'No Soap', 'cleanliness', true),
  negative('long_line', 'Long Line', 'convenience', true),
  negative('crowded', 'Crowded', 'convenience', true),
  negative('hard_to_find', 'Hard to Find', 'convenience', true),
  negative('customers_only', 'Customers Only', 'convenience'),
  negative('broken_lock', 'Broken Lock', 'privacy', true),
  negative('little_privacy', 'Little Privacy', 'privacy', true),
  negative('cramped', 'Cramped', 'privacy'),
  negative('poor_lighting', 'Poor Lighting', 'privacy'),
  negative('poor_ventilation', 'Poor Ventilation', 'privacy'),
  negative('out_of_order', 'Out of Order', 'standout', true),
  negative('felt_unsafe', 'Felt Unsafe', 'standout', true),
];

const definitionById = new Map(RATING_LABEL_DEFINITIONS.map((definition) => [definition.id, definition]));
const validRatingLabels = new Set<string>(RATING_LABELS);

export function getRatingLabelDefinition(id: RatingLabel): RatingLabelDefinition {
  return definitionById.get(id)!;
}

export function getRatingLabels(tone: RatingLabelTone, featuredOnly = false): RatingLabelDefinition[] {
  return RATING_LABEL_DEFINITIONS.filter(
    (definition) => definition.tone === tone && (!featuredOnly || definition.featured),
  ).sort((left, right) => left.label.localeCompare(right.label));
}

export function searchRatingLabels(tone: RatingLabelTone, query: string): RatingLabelDefinition[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return getRatingLabels(tone).filter(
    (definition) => !normalizedQuery || definition.label.toLocaleLowerCase().includes(normalizedQuery),
  );
}

export function getInitialRatingLabelTone(sentiment: Sentiment): RatingLabelTone {
  return sentiment === 'disliked' ? 'negative' : 'positive';
}

export function isRatingLabel(value: string): value is RatingLabel {
  return validRatingLabels.has(value);
}

export function normalizeRatingLabels(labels: readonly string[]): RatingLabel[] {
  return [...new Set(labels)].filter(isRatingLabel);
}

function positive(
  id: (typeof POSITIVE_RATING_LABELS)[number],
  label: string,
  category: RatingLabelCategory,
  featured = false,
): RatingLabelDefinition {
  return { id, label, category, featured, tone: 'positive' };
}

function negative(
  id: (typeof NEGATIVE_RATING_LABELS)[number],
  label: string,
  category: RatingLabelCategory,
  featured = false,
): RatingLabelDefinition {
  return { id, label, category, featured, tone: 'negative' };
}
