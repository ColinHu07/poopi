import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AuthRequired } from '@/components/app/AuthRequired';
import { BathroomCard } from '@/components/app/BathroomCard';
import { RatingLabelPicker } from '@/components/app/RatingLabelPicker';
import { LocationPinEditor } from '@/components/app/LocationPinEditor';
import { Section, Screen } from '@/components/app/Screen';
import { palette } from '@/components/app/tokens';
import type {
  AccessType,
  Bathroom,
  OperatingStatus,
  RatingLabel,
  Sentiment,
  VisitVisibility,
  WaitBucket,
} from '@/src/data/types';
import { useAuth } from '@/src/providers/AuthProvider';
import {
  createBathroomCandidate,
  DEFAULT_MAP_CENTER,
  getBathroomById,
  getNearbyBathrooms,
  logVisit,
} from '@/src/services/bathroomApi';
import {
  findCurrentPlace,
  type PlaceSearchCenter,
  type PlaceSearchResult,
  searchPlaces,
} from '@/src/services/placeSearch';
import { STATUS_LABELS, WAIT_LABELS } from '@/src/lib/bathroomSummary';
import { errorMessage } from '@/src/lib/errors';

const SENTIMENTS: Array<{ id: Sentiment; label: string }> = [
  { id: 'liked', label: 'Liked' },
  { id: 'fine', label: 'Fine' },
  { id: 'disliked', label: 'Disliked' },
];

const ACCESS_OPTIONS: Array<{ id: AccessType; label: string }> = [
  { id: 'customers_only', label: 'Customers only' },
  { id: 'public', label: 'Public' },
  { id: 'purchase_required', label: 'Purchase required' },
  { id: 'unknown', label: 'Not sure' },
];

const OBSERVED_ACCESS_OPTIONS: Array<{ id: AccessType; label: string }> = [
  { id: 'public', label: 'Public' },
  { id: 'customers_only', label: 'Customers only' },
  { id: 'purchase_required', label: 'Purchase required' },
  { id: 'paid', label: 'Paid' },
  { id: 'code_required', label: 'Code required' },
  { id: 'staff_permission', label: 'Ask staff' },
  { id: 'members_only', label: 'Members only' },
  { id: 'unknown', label: 'Not sure' },
];

const WAIT_OPTIONS: WaitBucket[] = ['none', 'under_five', 'five_to_ten', 'ten_to_twenty', 'over_twenty'];
const STATUS_OPTIONS: OperatingStatus[] = ['open', 'closed', 'partly_out_of_order', 'out_of_order', 'unknown'];
const VISIBILITY_OPTIONS: Array<{ id: VisitVisibility; label: string; description: string }> = [
  { id: 'public', label: 'Public', description: 'Helps everyone' },
  { id: 'friends', label: 'Friends', description: 'Friends only' },
  { id: 'private', label: 'Private', description: 'Only you' },
];

interface PlaceDraft {
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  access: AccessType;
  source: 'place-search' | 'manual';
  useCurrentLocation: boolean;
  pinAdjusted: boolean;
}

export default function ModalScreen() {
  const { bathroomId, initialQuery } = useLocalSearchParams<{ bathroomId?: string; initialQuery?: string }>();
  const { isAnonymous, loading: authLoading, session } = useAuth();
  const [bathroom, setBathroom] = useState<Bathroom | undefined>();
  const [candidates, setCandidates] = useState<Bathroom[]>([]);
  const [query, setQuery] = useState(initialQuery ?? '');
  const [currentLocation, setCurrentLocation] = useState<PlaceSearchCenter>();
  const [searchCenter, setSearchCenter] = useState<PlaceSearchCenter>(DEFAULT_MAP_CENTER);
  const [placeResults, setPlaceResults] = useState<PlaceSearchResult[]>([]);
  const [placeSearchAttempted, setPlaceSearchAttempted] = useState(false);
  const [placeSearching, setPlaceSearching] = useState(false);
  const [detectingPlace, setDetectingPlace] = useState(false);
  const [draft, setDraft] = useState<PlaceDraft>();
  const [creating, setCreating] = useState(false);
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [cleanlinessRating, setCleanlinessRating] = useState<number>();
  const [odorRating, setOdorRating] = useState<number>();
  const [privacyRating, setPrivacyRating] = useState<number>();
  const [waitBucket, setWaitBucket] = useState<WaitBucket>();
  const [observedAccess, setObservedAccess] = useState<AccessType>();
  const [observedStatus, setObservedStatus] = useState<OperatingStatus>('unknown');
  const [visibility, setVisibility] = useState<VisitVisibility>('public');
  const [selectedTags, setSelectedTags] = useState<RatingLabel[]>([]);
  const [note, setNote] = useState('');
  const [privateNote, setPrivateNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const filteredCandidates = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return candidates;
    return candidates.filter((candidate) =>
      [candidate.name, candidate.address, candidate.neighborhood, candidate.city]
        .filter(Boolean)
        .some((value) => value.toLocaleLowerCase().includes(normalized)),
    );
  }, [candidates, query]);

  useEffect(() => {
    if (!bathroomId) {
      setBathroom(undefined);
      loadNearbyCandidates();
    } else {
      setLoading(true);
      getBathroomById(bathroomId)
        .then(setBathroom)
        .finally(() => setLoading(false));
    }
  }, [bathroomId]);

  async function loadNearbyCandidates() {
    setLoading(true);
    setError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      let center = DEFAULT_MAP_CENTER;
      if (permission.status === 'granted') {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        center = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        setCurrentLocation(center);
      }
      setSearchCenter(center);
      setCandidates(await getNearbyBathrooms(center));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load nearby bathrooms.');
    } finally {
      setLoading(false);
    }
  }

  async function searchRealPlaces() {
    if (query.trim().length < 2) {
      setError('Enter at least two characters to search places.');
      return;
    }
    setPlaceSearching(true);
    setPlaceSearchAttempted(true);
    setError('');
    try {
      setPlaceResults(await searchPlaces(query, searchCenter));
    } catch (err) {
      setPlaceResults([]);
      setError(err instanceof Error ? err.message : 'Unable to search places right now.');
    } finally {
      setPlaceSearching(false);
    }
  }

  async function useCurrentPlace() {
    setDetectingPlace(true);
    setError('');
    try {
      let center = currentLocation;
      if (!center) {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          throw new Error('Location is off. Search for the place or enter it manually instead.');
        }
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        center = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        setCurrentLocation(center);
        setSearchCenter(center);
      }
      const place = await findCurrentPlace(center);
      if (!place) throw new Error('We could not identify the place. Search or enter it manually instead.');
      const customerVenue = ['restaurant', 'cafe', 'fast_food', 'bar', 'pub'].includes(place.type);
      setDraft({
        name: place.name,
        address: place.address,
        latitude: center.latitude,
        longitude: center.longitude,
        access: customerVenue ? 'customers_only' : 'unknown',
        source: 'place-search',
        useCurrentLocation: true,
        pinAdjusted: false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to identify your current place.');
    } finally {
      setDetectingPlace(false);
    }
  }

  function startPlaceConfirmation(place: PlaceSearchResult) {
    const customerVenue = ['restaurant', 'cafe', 'fast_food', 'bar', 'pub'].includes(place.type);
    setDraft({
      name: place.name,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
      access: customerVenue ? 'customers_only' : 'unknown',
      source: 'place-search',
      useCurrentLocation: false,
      pinAdjusted: false,
    });
    setError('');
  }

  function startManualEntry() {
    setDraft({
      name: query.trim(),
      address: '',
      latitude: currentLocation?.latitude,
      longitude: currentLocation?.longitude,
      access: 'unknown',
      source: 'manual',
      useCurrentLocation: Boolean(currentLocation),
      pinAdjusted: false,
    });
    setError('');
  }

  async function createAndContinue() {
    if (!draft) return;
    if (!draft.name.trim() || !draft.address.trim()) {
      setError('Add both the place name and address before continuing.');
      return;
    }

    setCreating(true);
    setError('');
    try {
      let latitude = draft.latitude;
      let longitude = draft.longitude;

      if (draft.useCurrentLocation && currentLocation) {
        latitude = currentLocation.latitude;
        longitude = currentLocation.longitude;
      } else if (draft.source === 'manual') {
        const matches = await searchPlaces(`${draft.name}, ${draft.address}`, searchCenter);
        const match = matches[0];
        if (!match) {
          throw new Error(
            currentLocation
              ? 'We could not find that address. Check it, or choose “Use my current location.”'
              : 'We could not find that address. Check the address and try again.',
          );
        }
        latitude = match.latitude;
        longitude = match.longitude;
      }

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error('Choose a searchable address or allow location access before continuing.');
      }

      const resolved = await createBathroomCandidate({
        name: draft.name.trim(),
        address: draft.address.trim(),
        latitude: latitude!,
        longitude: longitude!,
        access: draft.access,
      });
      setBathroom(resolved);
      setDraft(undefined);
      router.setParams({ bathroomId: resolved.id });
    } catch (err) {
      setError(errorMessage(err, 'Unable to add this bathroom.'));
    } finally {
      setCreating(false);
    }
  }

  async function submit() {
    if (!bathroom) {
      return;
    }
    if (!sentiment) {
      setError('Choose an overall rating before saving your visit.');
      return;
    }
    if (!cleanlinessRating || !odorRating || !privacyRating) {
      setError('Rate cleanliness, smell, and privacy before saving your visit.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await logVisit({
        bathroomId: bathroom.id,
        sentiment,
        publicNote: note.trim(),
        privateNote: privateNote.trim() || undefined,
        tags: selectedTags,
        cleanlinessRating,
        odorRating,
        privacyRating,
        waitBucket,
        observedAccess,
        observedStatus,
        visibility,
      });
      router.replace({ pathname: '/bathroom/[id]', params: { id: bathroom.id, reviewed: '1' } });
    } catch (err) {
      setError(errorMessage(err, 'Unable to save visit.'));
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
    return (
      <Screen kicker="New visit" title="Getting ready">
        <View style={styles.loading}>
          <ActivityIndicator color={palette.jade} />
          <Text style={styles.safetyCopy}>Loading your account...</Text>
        </View>
      </Screen>
    );
  }

  if (!session || isAnonymous) {
    return (
      <AuthRequired
        title="Log in to rate bathrooms"
        description="Ratings are tied to your account so your labels, notes, and rankings stay yours."
      />
    );
  }

  if (!bathroomId && draft) {
    return (
      <Screen kicker="Add a bathroom" title="Confirm the place">
        <Text style={styles.pickerIntro}>
          Check the details before Poopi creates this bathroom. You can fix the name, address, and access now.
        </Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Place name</Text>
          <TextInput
            accessibilityLabel="Place name"
            onChangeText={(name) => setDraft((value) => (value ? { ...value, name } : value))}
            placeholder="Example: Wenwen"
            placeholderTextColor={palette.muted}
            style={styles.fieldInput}
            value={draft.name}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Street address</Text>
          <TextInput
            accessibilityLabel="Street address"
            autoCapitalize="words"
            onChangeText={(address) => setDraft((value) => (value ? { ...value, address } : value))}
            placeholder="1025 Manhattan Ave, Brooklyn, NY"
            placeholderTextColor={palette.muted}
            style={styles.fieldInput}
            value={draft.address}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Bathroom access</Text>
          <View style={styles.accessOptions}>
            {ACCESS_OPTIONS.map((option) => {
              const selected = draft.access === option.id;
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => setDraft((value) => (value ? { ...value, access: option.id } : value))}
                  style={[styles.accessOption, selected && styles.activeAccessOption]}>
                  <Text style={[styles.accessOptionText, selected && styles.activeAccessOptionText]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.locationBox}>
          <Text style={styles.locationTitle}>
            {draft.useCurrentLocation
              ? 'Pin: your current location'
              : draft.pinAdjusted
                ? 'Pin: manually adjusted'
              : draft.source === 'place-search'
                ? 'Pin: place-search result'
                : 'Pin: address result'}
          </Text>
          <Text style={styles.locationCopy}>
            {draft.useCurrentLocation
              ? 'Poopi will use the location reported by your phone.'
              : 'Poopi will use the location matched to this place or address.'}
          </Text>
          {currentLocation ? (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                setDraft((value) =>
                  value ? { ...value, useCurrentLocation: !value.useCurrentLocation } : value,
                )
              }
              style={styles.locationChoice}>
              <Text style={styles.locationChoiceText}>
                {draft.useCurrentLocation
                  ? draft.source === 'manual'
                    ? 'Use the entered address instead'
                    : 'Use the searched place instead'
                  : 'Use my current location instead'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {Number.isFinite(draft.latitude) && Number.isFinite(draft.longitude) ? (
          <View style={styles.pinEditorBlock}>
            <Text style={styles.fieldLabel}>Bathroom location</Text>
            <Text style={styles.locationCopy}>Tap the map or drag the pin if the suggested location is wrong.</Text>
            <LocationPinEditor
              latitude={draft.latitude!}
              longitude={draft.longitude!}
              onChange={({ latitude, longitude }) =>
                setDraft((value) =>
                  value
                    ? { ...value, latitude, longitude, useCurrentLocation: false, pinAdjusted: true }
                    : value,
                )
              }
            />
          </View>
        ) : null}

        <Text style={styles.dedupeCopy}>
          If this matches an existing Poopi bathroom, your rating will attach to that bathroom instead of making a
          duplicate.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.confirmActions}>
          <Pressable
            accessibilityRole="button"
            disabled={creating}
            onPress={() => {
              setDraft(undefined);
              setError('');
            }}
            style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Back</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: creating }}
            disabled={creating}
            onPress={createAndContinue}
            style={styles.primaryButton}>
            {creating ? <ActivityIndicator color="#fffaf6" /> : <Text style={styles.primaryButtonText}>Continue to rating</Text>}
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (!bathroomId) {
    return (
      <Screen kicker="New rating" title="Which bathroom did you use?">
        <Text style={styles.pickerIntro}>
          Search any venue or address. If its bathroom is not in Poopi yet, you can add it and continue rating.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: detectingPlace }}
          disabled={detectingPlace}
          onPress={useCurrentPlace}
          style={styles.currentPlaceButton}>
          {detectingPlace ? (
            <ActivityIndicator color={palette.jade} />
          ) : (
            <>
              <Text style={styles.currentPlaceTitle}>◎ Use my current place</Text>
              <Text style={styles.currentPlaceCopy}>We’ll suggest the nearest venue for you to confirm.</Text>
            </>
          )}
        </Pressable>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            accessibilityLabel="Search bathrooms and places to rate"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={(value) => {
              setQuery(value);
              setPlaceSearchAttempted(false);
              setPlaceResults([]);
            }}
            onSubmitEditing={searchRealPlaces}
            placeholder="Try Wenwen or an address"
            placeholderTextColor={palette.muted}
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />
        </View>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={palette.jade} />
            <Text style={styles.safetyCopy}>Finding nearby bathrooms...</Text>
          </View>
        ) : filteredCandidates.length ? (
          <Section title="Already on Poopi">
            <View style={styles.candidateList}>
              {filteredCandidates.slice(0, query.trim() ? 12 : 5).map((candidate) => (
                <BathroomCard
                  key={candidate.id}
                  bathroom={candidate}
                  compact
                  onPress={() => router.setParams({ bathroomId: candidate.id })}
                />
              ))}
            </View>
          </Section>
        ) : query.trim() ? (
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Not on Poopi yet</Text>
            <Text style={styles.infoCopy}>Search nearby real-world places below, or enter this bathroom yourself.</Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: placeSearching || query.trim().length < 2 }}
          disabled={placeSearching || query.trim().length < 2}
          onPress={searchRealPlaces}
          style={[styles.placeSearchButton, query.trim().length < 2 && styles.disabledButton]}>
          {placeSearching ? (
            <ActivityIndicator color="#fffaf6" />
          ) : (
            <Text style={styles.placeSearchButtonText}>Search nearby places</Text>
          )}
        </Pressable>

        {placeSearchAttempted && placeResults.length ? (
          <Section title="Places we can add">
            <View style={styles.placeList}>
              {placeResults.map((place) => (
                <Pressable
                  key={place.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${place.name} and rate its bathroom`}
                  onPress={() => startPlaceConfirmation(place)}
                  style={({ pressed }) => [styles.placeCard, pressed && styles.pressed]}>
                  <View style={styles.placePin}>
                    <Text style={styles.placePinText}>●</Text>
                  </View>
                  <View style={styles.placeText}>
                    <Text style={styles.placeName}>{place.name}</Text>
                    <Text numberOfLines={2} style={styles.placeAddress}>{place.address}</Text>
                  </View>
                  <Text style={styles.addPlaceText}>Add →</Text>
                </Pressable>
              ))}
            </View>
          </Section>
        ) : placeSearchAttempted && !placeSearching ? (
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>No place match found</Text>
            <Text style={styles.infoCopy}>You can still enter the name and address manually.</Text>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable accessibilityRole="button" onPress={startManualEntry} style={styles.manualButton}>
          <Text style={styles.manualButtonTitle}>Can’t find it? Enter the place manually</Text>
          <Text style={styles.manualButtonCopy}>Add its name, address, access, and location before rating.</Text>
        </Pressable>

        <Pressable
          accessibilityRole="link"
          onPress={() => Linking.openURL('https://www.openstreetmap.org/copyright')}
          style={styles.attributionLink}>
          <Text style={styles.attributionText}>Place search © OpenStreetMap contributors</Text>
        </Pressable>
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen kicker="New visit" title="Loading bathroom">
        <View style={styles.loading}>
          <ActivityIndicator color={palette.jade} />
          <Text style={styles.safetyCopy}>Loading bathroom...</Text>
        </View>
      </Screen>
    );
  }

  if (!bathroom) {
    return (
      <Screen kicker="New visit" title="Bathroom unavailable">
        <View style={styles.safetyBox}>
          <Text style={styles.safetyTitle}>Cannot rate this bathroom yet</Text>
          <Text style={styles.safetyCopy}>Return to the map and choose another bathroom.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen kicker="New visit" title={bathroom.name}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.replace('/modal' as any)}
        style={styles.changeButton}>
        <Text style={styles.changeButtonText}>← Choose a different bathroom</Text>
      </Pressable>
      <Section title="Overall rating">
        <View style={styles.segmented}>
          {SENTIMENTS.map((item) => {
            const active = item.id === sentiment;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                onPress={() => {
                  setSentiment(item.id);
                  setError('');
                }}
                style={({ pressed }) => [
                  styles.segment,
                  active && styles.activeSegment,
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.segmentText, active && styles.activeSegmentText]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {!sentiment ? <Text style={styles.ratingHint}>Pick one to unlock bathroom labels.</Text> : null}
      </Section>

      <Section title="Core ratings">
        <Text style={styles.sectionHelp}>Three quick ratings make the community summary more trustworthy.</Text>
        <DimensionScale
          label="Cleanliness"
          lowLabel="Unusable"
          highLabel="Spotless"
          value={cleanlinessRating}
          onChange={setCleanlinessRating}
        />
        <DimensionScale
          label="Smell"
          lowLabel="Severe"
          highLabel="Fresh"
          value={odorRating}
          onChange={setOdorRating}
        />
        <DimensionScale
          label="Privacy"
          lowLabel="Poor"
          highLabel="Excellent"
          value={privacyRating}
          onChange={setPrivacyRating}
        />
      </Section>

      <Section title="What was it like right now?">
        <Text style={styles.fieldLabel}>Wait time</Text>
        <OptionPills
          options={WAIT_OPTIONS.map((id) => ({ id, label: WAIT_LABELS[id] }))}
          value={waitBucket}
          onChange={setWaitBucket}
        />
        <Text style={styles.fieldLabel}>Operating status</Text>
        <OptionPills
          options={STATUS_OPTIONS.map((id) => ({ id, label: STATUS_LABELS[id] }))}
          value={observedStatus}
          onChange={setObservedStatus}
        />
        <Text style={styles.fieldLabel}>Access you observed</Text>
        <OptionPills options={OBSERVED_ACCESS_OPTIONS} value={observedAccess} onChange={setObservedAccess} />
      </Section>

      <Section title="Labels">
        <RatingLabelPicker sentiment={sentiment} selected={selectedTags} onChange={setSelectedTags} />
      </Section>

      <Section title="Share a note">
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={visibility === 'public' ? 'Optional public note about this visit' : 'Optional note for this audience'}
          placeholderTextColor={palette.muted}
          multiline
          style={styles.noteInput}
        />
      </Section>

      <Section title="Who can see this review?">
        <View style={styles.visibilityRow}>
          {VISIBILITY_OPTIONS.map((option) => {
            const active = visibility === option.id;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                onPress={() => setVisibility(option.id)}
                style={[styles.visibilityOption, active && styles.activeVisibilityOption]}>
                <Text style={[styles.visibilityTitle, active && styles.activeVisibilityText]}>{option.label}</Text>
                <Text style={styles.visibilityDescription}>{option.description}</Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={privateNote}
          onChangeText={setPrivateNote}
          placeholder="Private note—only you can read this"
          placeholderTextColor={palette.muted}
          multiline
          style={[styles.noteInput, styles.privateNoteInput]}
        />
      </Section>

      <View style={styles.safetyBox}>
        <Text style={styles.safetyTitle}>Photo moderation</Text>
        <Text style={styles.safetyCopy}>
          Uploads are intended for empty rooms, fixtures, and signs. Images with people, kids, faces, or sensitive
          reflections should be rejected or queued.
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: saving || !sentiment || !cleanlinessRating || !odorRating || !privacyRating }}
        disabled={saving || !sentiment || !cleanlinessRating || !odorRating || !privacyRating}
        style={({ pressed }) => [
          styles.submitButton,
          (!sentiment || !cleanlinessRating || !odorRating || !privacyRating) && styles.disabledSubmitButton,
          pressed && sentiment && styles.pressed,
        ]}
        onPress={submit}>
        {saving ? <ActivityIndicator color="#fffaf6" /> : <Text style={styles.submitText}>Save visit</Text>}
      </Pressable>

      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </Screen>
  );
}

function DimensionScale({
  label,
  lowLabel,
  highLabel,
  value,
  onChange,
}: {
  label: string;
  lowLabel: string;
  highLabel: string;
  value?: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.dimensionBlock}>
      <View style={styles.dimensionHeader}>
        <Text style={styles.dimensionLabel}>{label}</Text>
        <Text style={styles.dimensionValue}>{value ? `${value}/5` : 'Choose'}</Text>
      </View>
      <View style={styles.numberScale}>
        {[1, 2, 3, 4, 5].map((number) => {
          const active = value === number;
          return (
            <Pressable
              key={number}
              accessibilityRole="radio"
              accessibilityLabel={`${label} ${number} out of 5`}
              accessibilityState={{ checked: active }}
              onPress={() => onChange(number)}
              style={[styles.numberOption, active && styles.activeNumberOption]}>
              <Text style={[styles.numberText, active && styles.activeNumberText]}>{number}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.scaleAnchors}>
        <Text style={styles.scaleAnchor}>{lowLabel}</Text>
        <Text style={styles.scaleAnchor}>{highLabel}</Text>
      </View>
    </View>
  );
}

function OptionPills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: T; label: string }>;
  value?: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.optionPills}>
      {options.map((option) => {
        const active = value === option.id;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            onPress={() => onChange(option.id)}
            style={[styles.optionPill, active && styles.activeOptionPill]}>
            <Text style={[styles.optionPillText, active && styles.activeOptionPillText]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pickerIntro: {
    color: palette.ink,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  searchBox: {
    minHeight: 50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  currentPlaceButton: {
    minHeight: 66,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#b6dfd4',
    backgroundColor: palette.mint,
    justifyContent: 'center',
    paddingHorizontal: 14,
    gap: 3,
  },
  currentPlaceTitle: {
    color: palette.jade,
    fontSize: 15,
    fontWeight: '900',
  },
  currentPlaceCopy: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  searchIcon: {
    color: palette.muted,
    fontSize: 22,
  },
  searchInput: {
    flex: 1,
    minHeight: 48,
    color: palette.ink,
    fontSize: 15,
  },
  candidateList: {
    gap: 10,
  },
  fieldGroup: {
    gap: 7,
  },
  fieldLabel: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  fieldInput: {
    minHeight: 50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    color: palette.ink,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  accessOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  accessOption: {
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  activeAccessOption: {
    borderColor: '#b6dfd4',
    backgroundColor: palette.mint,
  },
  accessOptionText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  activeAccessOptionText: {
    color: palette.jade,
  },
  locationBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#b6dfd4',
    backgroundColor: palette.mint,
    padding: 14,
    gap: 5,
  },
  pinEditorBlock: {
    gap: 8,
  },
  locationTitle: {
    color: palette.jade,
    fontSize: 14,
    fontWeight: '900',
  },
  locationCopy: {
    color: palette.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  locationChoice: {
    minHeight: 44,
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  locationChoiceText: {
    color: palette.jade,
    fontSize: 13,
    fontWeight: '900',
    textDecorationLine: 'underline',
  },
  dedupeCopy: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    minHeight: 52,
    minWidth: 88,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  primaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 10,
    backgroundColor: palette.coral,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#fffaf6',
    fontSize: 15,
    fontWeight: '900',
  },
  infoBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    padding: 14,
    gap: 4,
  },
  infoTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  infoCopy: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  placeSearchButton: {
    minHeight: 50,
    borderRadius: 10,
    backgroundColor: palette.jade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeSearchButtonText: {
    color: '#fffaf6',
    fontSize: 15,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.45,
  },
  placeList: {
    gap: 9,
  },
  placeCard: {
    minHeight: 76,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 13,
  },
  placePin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.coralSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placePinText: {
    color: palette.coral,
    fontSize: 17,
  },
  placeText: {
    flex: 1,
    gap: 3,
  },
  placeName: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  placeAddress: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  addPlaceText: {
    color: palette.jade,
    fontSize: 13,
    fontWeight: '900',
  },
  manualButton: {
    minHeight: 72,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ffc4b5',
    backgroundColor: palette.coralSoft,
    justifyContent: 'center',
    padding: 14,
    gap: 4,
  },
  manualButtonTitle: {
    color: palette.coral,
    fontSize: 15,
    fontWeight: '900',
  },
  manualButtonCopy: {
    color: palette.ink,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  attributionLink: {
    minHeight: 44,
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  attributionText: {
    color: palette.muted,
    fontSize: 11,
    textDecorationLine: 'underline',
  },
  retryButton: {
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: palette.coral,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  retryText: {
    color: '#fffaf6',
    fontSize: 14,
    fontWeight: '900',
  },
  changeButton: {
    minHeight: 44,
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  changeButtonText: {
    color: palette.jade,
    fontSize: 14,
    fontWeight: '900',
  },
  segmented: {
    flexDirection: 'row',
    gap: 8,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeSegment: {
    backgroundColor: palette.mint,
    borderColor: '#b6dfd4',
  },
  segmentText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  activeSegmentText: {
    color: palette.jade,
  },
  ratingHint: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
  },
  sectionHelp: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  dimensionBlock: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    padding: 12,
    gap: 8,
  },
  dimensionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dimensionLabel: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  dimensionValue: {
    color: palette.jade,
    fontSize: 13,
    fontWeight: '900',
  },
  numberScale: {
    flexDirection: 'row',
    gap: 7,
  },
  numberOption: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeNumberOption: {
    backgroundColor: palette.jade,
    borderColor: palette.jade,
  },
  numberText: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  activeNumberText: {
    color: '#fffaf6',
  },
  scaleAnchors: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scaleAnchor: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  optionPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  optionPill: {
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    justifyContent: 'center',
    paddingHorizontal: 13,
  },
  activeOptionPill: {
    backgroundColor: palette.mint,
    borderColor: '#b6dfd4',
  },
  optionPillText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '800',
  },
  activeOptionPillText: {
    color: palette.jade,
  },
  visibilityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  visibilityOption: {
    flex: 1,
    minHeight: 68,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    justifyContent: 'center',
    padding: 10,
    gap: 3,
  },
  activeVisibilityOption: {
    borderColor: '#b6dfd4',
    backgroundColor: palette.mint,
  },
  visibilityTitle: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  activeVisibilityText: {
    color: palette.jade,
  },
  visibilityDescription: {
    color: palette.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  noteInput: {
    minHeight: 120,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    color: palette.ink,
    padding: 14,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  privateNoteInput: {
    minHeight: 82,
    backgroundColor: palette.goldSoft,
  },
  safetyBox: {
    borderRadius: 8,
    backgroundColor: palette.coralSoft,
    borderWidth: 1,
    borderColor: '#ffc4b5',
    padding: 14,
    gap: 4,
  },
  safetyTitle: {
    color: palette.coral,
    fontSize: 16,
    fontWeight: '900',
  },
  safetyCopy: {
    color: palette.ink,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  error: {
    color: palette.coral,
    fontSize: 13,
    fontWeight: '800',
  },
  loading: {
    minHeight: 130,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  submitButton: {
    minHeight: 52,
    borderRadius: 8,
    backgroundColor: palette.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledSubmitButton: {
    backgroundColor: palette.muted,
    opacity: 0.52,
  },
  submitText: {
    color: '#fffaf6',
    fontSize: 16,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.72,
  },
});
