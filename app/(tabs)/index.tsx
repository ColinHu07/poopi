import * as Location from 'expo-location';
import { Link } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

import { BathroomCard } from '@/components/app/BathroomCard';
import { BathroomMap } from '@/components/app/BathroomMap';
import { Screen } from '@/components/app/Screen';
import { TagChip } from '@/components/app/TagChip';
import { palette, shadow } from '@/components/app/tokens';
import type { Bathroom, BathroomFilters, WaitBucket } from '@/src/data/types';
import { buildWalkingDirectionsUrl, formatDistance, formatWalkingEta } from '@/src/lib/directions';
import { viewportMoved, viewportRadiusMeters, type MapViewport } from '@/src/lib/mapDiscovery';
import { useAuth } from '@/src/providers/AuthProvider';
import { DEFAULT_MAP_CENTER, getNearbyBathrooms } from '@/src/services/bathroomApi';
import { searchPlaces, type PlaceSearchResult } from '@/src/services/placeSearch';

type ToggleFilterKey =
  | 'openNow'
  | 'free'
  | 'publicAccess'
  | 'wheelchair'
  | 'babyChanging'
  | 'allGender'
  | 'singleStall';

const QUICK_FILTERS: Array<{ id: ToggleFilterKey; label: string }> = [
  { id: 'openNow', label: 'Open now' },
  { id: 'free', label: 'Free' },
  { id: 'publicAccess', label: 'Public access' },
  { id: 'wheelchair', label: 'Wheelchair' },
  { id: 'babyChanging', label: 'Baby change' },
  { id: 'allGender', label: 'All-gender' },
  { id: 'singleStall', label: 'Single-stall' },
];

const WAIT_FILTERS: Array<{ value?: WaitBucket; label: string }> = [
  { label: 'Any wait' },
  { value: 'none', label: 'No wait' },
  { value: 'under_five', label: '≤ 5 min' },
  { value: 'five_to_ten', label: '≤ 10 min' },
  { value: 'ten_to_twenty', label: '≤ 20 min' },
];

const CLEANLINESS_FILTERS: Array<{ value?: 1 | 2 | 3 | 4 | 5; label: string }> = [
  { label: 'Any rating' },
  { value: 3, label: '3+ clean' },
  { value: 4, label: '4+ clean' },
  { value: 5, label: '5 clean' },
];

export default function MapScreen() {
  const { width } = useWindowDimensions();
  const { isAnonymous, session } = useAuth();
  const [filters, setFilters] = useState<BathroomFilters>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [center, setCenter] = useState(DEFAULT_MAP_CENTER);
  const [userLocation, setUserLocation] = useState<typeof DEFAULT_MAP_CENTER>();
  const [radiusMeters, setRadiusMeters] = useState(5_000);
  const [bathrooms, setBathrooms] = useState<Bathroom[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [query, setQuery] = useState('');
  const [placeResults, setPlaceResults] = useState<PlaceSearchResult[]>([]);
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [placeSearchAttempted, setPlaceSearchAttempted] = useState(false);
  const [placeSearchError, setPlaceSearchError] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [destinationLabel, setDestinationLabel] = useState('Nearby bathrooms');
  const [pendingViewport, setPendingViewport] = useState<MapViewport>();
  const [recenterNonce, setRecenterNonce] = useState(0);
  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationGranted, setLocationGranted] = useState(false);
  const [error, setError] = useState('');

  const matchingBathrooms = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (normalized.length < 2) return [];
    return bathrooms
      .filter((bathroom) =>
        [bathroom.name, bathroom.address, bathroom.neighborhood, bathroom.city]
          .filter(Boolean)
          .some((value) => value.toLocaleLowerCase().includes(normalized)),
      )
      .slice(0, 4);
  }, [bathrooms, query]);
  const selected = useMemo(() => bathrooms.find((bathroom) => bathroom.id === selectedId), [bathrooms, selectedId]);
  const wideLayout = width >= 900;
  const canContribute = Boolean(session && !isAnonymous);
  const canSearchArea = Boolean(pendingViewport && viewportMoved(center, pendingViewport));
  const activeFilterCount = Object.values(filters).filter((value) => value !== undefined && value !== false).length;

  useEffect(() => {
    resolveLocation();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadBathrooms() {
      setLoading(true);
      setError('');
      try {
        const nextBathrooms = await getNearbyBathrooms({ ...center, radiusMeters, filters });
        if (!cancelled) {
          setBathrooms(nextBathrooms);
          setSelectedId((current) =>
            current && nextBathrooms.some((bathroom) => bathroom.id === current) ? current : undefined,
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load nearby bathrooms.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadBathrooms();
    return () => {
      cancelled = true;
    };
  }, [center.latitude, center.longitude, filters, radiusMeters]);

  async function resolveLocation() {
    setLocationLoading(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationGranted(false);
        setCenter(DEFAULT_MAP_CENTER);
        setDestinationLabel('New York');
        return;
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const nextCenter = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setLocationGranted(true);
      setUserLocation(nextCenter);
      setCenter(nextCenter);
      setDestinationLabel('Near you');
      setRadiusMeters(5_000);
      setRecenterNonce((value) => value + 1);
    } catch {
      setLocationGranted(false);
      setCenter(DEFAULT_MAP_CENTER);
      setDestinationLabel('New York');
    } finally {
      setLocationLoading(false);
    }
  }

  async function runPlaceSearch() {
    if (query.trim().length < 2) return;
    setSearchingPlaces(true);
    setPlaceSearchAttempted(true);
    setPlaceSearchError('');
    setSearchOpen(true);
    try {
      setPlaceResults(await searchPlaces(query, userLocation ?? center));
    } catch (err) {
      setPlaceResults([]);
      setPlaceSearchError(err instanceof Error ? err.message : 'Place search is temporarily unavailable.');
    } finally {
      setSearchingPlaces(false);
    }
  }

  function chooseBathroom(bathroom: Bathroom) {
    setQuery(bathroom.name);
    setDestinationLabel(bathroom.name);
    setCenter({ latitude: bathroom.latitude, longitude: bathroom.longitude });
    setRadiusMeters(5_000);
    setSelectedId(bathroom.id);
    setSearchOpen(false);
    setPendingViewport(undefined);
    setRecenterNonce((value) => value + 1);
  }

  function choosePlace(place: PlaceSearchResult) {
    setQuery(place.name);
    setDestinationLabel(place.name);
    setCenter({ latitude: place.latitude, longitude: place.longitude });
    setRadiusMeters(5_000);
    setSelectedId(undefined);
    setSearchOpen(false);
    setPendingViewport(undefined);
    setRecenterNonce((value) => value + 1);
  }

  function searchThisArea() {
    if (!pendingViewport) return;
    setCenter({ latitude: pendingViewport.latitude, longitude: pendingViewport.longitude });
    setRadiusMeters(viewportRadiusMeters(pendingViewport));
    setDestinationLabel('This map area');
    setSelectedId(undefined);
  }

  function recenter() {
    if (!userLocation) {
      resolveLocation();
      return;
    }
    setCenter(userLocation);
    setRadiusMeters(5_000);
    setDestinationLabel('Near you');
    setSelectedId(undefined);
    setPendingViewport(undefined);
    setRecenterNonce((value) => value + 1);
  }

  function clearSearch() {
    setQuery('');
    setPlaceResults([]);
    setPlaceSearchAttempted(false);
    setPlaceSearchError('');
    setSearchOpen(false);
  }

  function toggleFilter(id: ToggleFilterKey) {
    setFilters((current) => ({ ...current, [id]: !current[id] }));
  }

  function openDirections(bathroom: Bathroom) {
    const url = buildWalkingDirectionsUrl(
      { latitude: bathroom.latitude, longitude: bathroom.longitude, name: bathroom.name },
      Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
    );
    Linking.openURL(url);
  }

  return (
    <Screen
      kicker={destinationLabel}
      title="Find a bathroom"
      right={
        <View style={styles.headerActions}>
          <TagChip label={`${bathrooms.length} results`} tone="info" />
          {!session ? (
            <Link href={'/sign-in' as any} asChild>
              <Pressable accessibilityRole="link" style={styles.loginButton}>
                <Text style={styles.loginButtonText}>Log in</Text>
              </Pressable>
            </Link>
          ) : null}
        </View>
      }>
      <View style={styles.searchRegion}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            accessibilityLabel="Search destinations, venues, and addresses"
            autoCapitalize="words"
            autoCorrect={false}
            onChangeText={(value) => {
              setQuery(value);
              setSearchOpen(value.trim().length >= 2);
              setPlaceSearchAttempted(false);
              setPlaceResults([]);
              setPlaceSearchError('');
            }}
            onFocus={() => setSearchOpen(query.trim().length >= 2)}
            onSubmitEditing={runPlaceSearch}
            placeholder="Where do you need a bathroom?"
            placeholderTextColor={palette.muted}
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />
          {query ? (
            <Pressable accessibilityLabel="Clear destination search" onPress={clearSearch} style={styles.clearSearch}>
              <Text style={styles.clearSearchText}>×</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityLabel="Search real-world places"
            disabled={searchingPlaces || query.trim().length < 2}
            onPress={runPlaceSearch}
            style={[styles.searchButton, query.trim().length < 2 && styles.disabledButton]}>
            {searchingPlaces ? <ActivityIndicator color={palette.surface} size="small" /> : <Text style={styles.searchButtonText}>Search</Text>}
          </Pressable>
        </View>

        {searchOpen ? (
          <View style={styles.searchResults}>
            {matchingBathrooms.map((bathroom) => (
              <Pressable key={bathroom.id} onPress={() => chooseBathroom(bathroom)} style={styles.placeRow}>
                <Text style={styles.placePin}>●</Text>
                <View style={styles.placeCopy}>
                  <Text style={styles.placeName}>{bathroom.name}</Text>
                  <Text style={styles.placeAddress} numberOfLines={1}>{bathroom.address} · Already on Poopi</Text>
                </View>
              </Pressable>
            ))}
            {placeResults.map((place) => (
              <Pressable key={place.id} onPress={() => choosePlace(place)} style={styles.placeRow}>
                <Text style={styles.placePin}>⌖</Text>
                <View style={styles.placeCopy}>
                  <Text style={styles.placeName}>{place.name}</Text>
                  <Text style={styles.placeAddress} numberOfLines={2}>{place.address}</Text>
                </View>
              </Pressable>
            ))}
            {!searchingPlaces && !placeSearchAttempted && matchingBathrooms.length === 0 ? (
              <Pressable onPress={runPlaceSearch} style={styles.searchPrompt}>
                <Text style={styles.searchPromptText}>Search all real-world places for “{query.trim()}”</Text>
              </Pressable>
            ) : null}
            {!searchingPlaces && placeSearchAttempted && placeResults.length === 0 && matchingBathrooms.length === 0 ? (
              <View style={styles.noPlaceResult}>
                <Text style={styles.noPlaceTitle}>We couldn’t find that place</Text>
                <Text style={styles.noPlaceText}>{placeSearchError || 'Try the full address, or enter the bathroom yourself.'}</Text>
                <Link
                  href={canContribute ? { pathname: '/modal', params: { initialQuery: query } } : ('/sign-in' as any)}
                  asChild>
                  <Pressable style={styles.manualButton}>
                    <Text style={styles.manualButtonText}>{canContribute ? 'Enter it manually' : 'Sign in to add it'}</Text>
                  </Pressable>
                </Link>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.filterHeader}>
        <Text style={styles.filterHeading}>What do you need?</Text>
        <View style={styles.filterHeaderActions}>
          {activeFilterCount ? (
            <Pressable accessibilityLabel="Clear all filters" onPress={() => setFilters({})}>
              <Text style={styles.clearFilters}>Clear all</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: filtersOpen }}
            onPress={() => setFiltersOpen((value) => !value)}
            style={[styles.moreFiltersButton, filtersOpen && styles.activeFilter]}>
            <Text style={[styles.filterText, filtersOpen && styles.activeFilterText]}>
              Filters{activeFilterCount ? ` · ${activeFilterCount}` : ''} {filtersOpen ? '↑' : '↓'}
            </Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.filterRow}>
        {QUICK_FILTERS.map((filter) => {
          const active = Boolean(filters[filter.id]);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              key={filter.id}
              onPress={() => toggleFilter(filter.id)}
              style={[styles.filterButton, active && styles.activeFilter]}>
              <Text style={[styles.filterText, active && styles.activeFilterText]}>{filter.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {filtersOpen ? (
        <View style={styles.advancedFilters}>
          <View style={styles.filterGroup}>
            <Text style={styles.filterGroupTitle}>Maximum reported wait</Text>
            <View style={styles.filterRow}>
              {WAIT_FILTERS.map((option) => {
                const active = filters.maxWait === option.value;
                return (
                  <Pressable
                    accessibilityState={{ selected: active }}
                    key={option.label}
                    onPress={() => setFilters((current) => ({ ...current, maxWait: option.value }))}
                    style={[styles.filterButton, active && styles.activeFilter]}>
                    <Text style={[styles.filterText, active && styles.activeFilterText]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={styles.filterGroup}>
            <Text style={styles.filterGroupTitle}>Minimum cleanliness</Text>
            <View style={styles.filterRow}>
              {CLEANLINESS_FILTERS.map((option) => {
                const active = filters.minCleanliness === option.value;
                return (
                  <Pressable
                    accessibilityState={{ selected: active }}
                    key={option.label}
                    onPress={() => setFilters((current) => ({ ...current, minCleanliness: option.value }))}
                    style={[styles.filterButton, active && styles.activeFilter]}>
                    <Text style={[styles.filterText, active && styles.activeFilterText]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Text style={styles.unknownFilterNote}>Bathrooms with unknown wait or cleanliness are excluded only when that filter is active.</Text>
        </View>
      ) : null}

      {!locationGranted && !locationLoading ? (
        <View style={styles.locationPanel}>
          <View style={styles.locationCopy}>
            <Text style={styles.locationTitle}>Location is off</Text>
            <Text style={styles.locationText}>Search any venue or address, or enable location to prioritize nearby places.</Text>
          </View>
          <Pressable style={styles.locationButton} onPress={resolveLocation}>
            <Text style={styles.locationButtonText}>Enable</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={[styles.discoveryLayout, wideLayout && styles.discoveryLayoutWide]}>
        <View style={[styles.mapColumn, wideLayout && styles.mapColumnWide]}>
          <View style={styles.mapSurface}>
            <BathroomMap
              bathrooms={bathrooms}
              center={center}
              locationGranted={locationGranted}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onViewportChange={setPendingViewport}
              recenterNonce={recenterNonce}
            />
            <View style={styles.mapActions} pointerEvents="box-none">
              {canSearchArea ? (
                <Pressable onPress={searchThisArea} style={styles.searchAreaButton}>
                  <Text style={styles.searchAreaText}>Search this area</Text>
                </Pressable>
              ) : null}
              <Pressable accessibilityLabel="Recenter on my location" onPress={recenter} style={styles.recenterButton}>
                <Text style={styles.recenterText}>◎</Text>
              </Pressable>
            </View>
          </View>

          {loading ? (
            <View style={styles.statusPanel}>
              <ActivityIndicator color={palette.jade} />
              <Text style={styles.statusText}>Finding bathrooms in this area…</Text>
            </View>
          ) : error ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Could not refresh this area</Text>
              <Text style={styles.emptyText}>{error} Previously loaded results remain on the map.</Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.resultSheet, wideLayout && styles.resultSheetWide]}>
          {!wideLayout ? <View style={styles.sheetHandle} /> : null}
          <View style={styles.resultsHeader}>
            <View>
              <Text style={styles.sectionLabel}>{selected ? 'Selected bathroom' : 'Bathrooms nearby'}</Text>
              <Text style={styles.resultsHint}>{selected ? 'Highlighted on the map' : 'Best matches first'}</Text>
            </View>
            {selected ? (
              <Link href={{ pathname: '/bathroom/[id]', params: { id: selected.id } }} asChild>
                <Pressable style={styles.detailsButton}>
                  <Text style={styles.detailsButtonText}>View details</Text>
                </Pressable>
              </Link>
            ) : null}
          </View>

          <View style={styles.ratePrompt}>
            <View style={styles.ratePromptCopy}>
              <Text style={styles.ratePromptTitle}>Used a bathroom recently?</Text>
              <Text style={styles.ratePromptText}>{selected ? `Rate ${selected.name} while it’s fresh.` : 'Add or rate any bathroom—even if it is not on the map yet.'}</Text>
            </View>
            <Link
              href={canContribute ? (selected ? { pathname: '/modal', params: { bathroomId: selected.id } } : ('/modal' as any)) : ('/sign-in' as any)}
              asChild>
              <Pressable accessibilityRole="link" style={styles.rateButton}>
                <Text style={styles.rateButtonText}>{canContribute ? 'Rate a bathroom' : 'Sign in to rate'}</Text>
              </Pressable>
            </Link>
          </View>

          <View style={styles.list}>
            {bathrooms.map((bathroom) => (
              <View key={bathroom.id} style={styles.resultItem}>
                <BathroomCard
                  bathroom={bathroom}
                  compact
                  selected={bathroom.id === selectedId}
                  onPress={() => setSelectedId(bathroom.id)}
                />
                <View style={styles.resultRouteRow}>
                  <Text style={styles.resultRouteText} numberOfLines={1}>
                    {formatDistance(bathroom.distanceMeters)} · {formatWalkingEta(bathroom.distanceMeters)}
                  </Text>
                  <Pressable
                    accessibilityLabel={`Walking directions to ${bathroom.name}`}
                    accessibilityRole="link"
                    onPress={() => openDirections(bathroom)}
                    style={styles.resultDirectionsButton}>
                    <Text style={styles.resultDirectionsText}>Directions ↗</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>

          {!loading && bathrooms.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No bathrooms found here</Text>
              <Text style={styles.emptyText}>Try a wider map area, clear some filters, or add the bathroom you know about.</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loginButton: { minHeight: 40, borderRadius: 9, backgroundColor: palette.ink, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  loginButtonText: { color: palette.surface, fontSize: 13, fontWeight: '900' },
  searchRegion: { zIndex: 10 },
  searchBox: { minHeight: 56, borderRadius: 14, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 14, paddingRight: 6, ...shadow },
  searchIcon: { color: palette.jade, fontSize: 23, fontWeight: '900' },
  searchInput: { flex: 1, minWidth: 120, minHeight: 52, color: palette.ink, fontSize: 16 },
  clearSearch: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  clearSearchText: { color: palette.muted, fontSize: 26, lineHeight: 28 },
  searchButton: { minWidth: 74, minHeight: 44, borderRadius: 10, paddingHorizontal: 13, backgroundColor: palette.jade, alignItems: 'center', justifyContent: 'center' },
  searchButtonText: { color: palette.surface, fontSize: 13, fontWeight: '900' },
  disabledButton: { opacity: 0.45 },
  searchResults: { position: 'absolute', top: 62, left: 0, right: 0, borderRadius: 14, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, overflow: 'hidden', ...shadow },
  placeRow: { minHeight: 66, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: palette.line },
  placePin: { width: 24, color: palette.coral, fontSize: 18, textAlign: 'center', fontWeight: '900' },
  placeCopy: { flex: 1, gap: 2 },
  placeName: { color: palette.ink, fontSize: 15, fontWeight: '900' },
  placeAddress: { color: palette.muted, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  searchPrompt: { minHeight: 54, alignItems: 'center', justifyContent: 'center', padding: 12 },
  searchPromptText: { color: palette.jade, fontSize: 14, fontWeight: '900' },
  noPlaceResult: { padding: 16, gap: 7 },
  noPlaceTitle: { color: palette.ink, fontSize: 16, fontWeight: '900' },
  noPlaceText: { color: palette.muted, fontSize: 13, lineHeight: 18 },
  manualButton: { minHeight: 42, borderRadius: 9, backgroundColor: palette.coralSoft, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  manualButtonText: { color: palette.coral, fontSize: 13, fontWeight: '900' },
  filterHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  filterHeading: { color: palette.ink, fontSize: 16, fontWeight: '900' },
  filterHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clearFilters: { color: palette.coral, fontSize: 13, fontWeight: '900' },
  moreFiltersButton: { minHeight: 38, borderRadius: 999, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterButton: { minHeight: 38, borderRadius: 999, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  activeFilter: { borderColor: '#8bcdbf', backgroundColor: palette.mint },
  filterText: { color: palette.ink, fontSize: 13, fontWeight: '800' },
  activeFilterText: { color: palette.jade },
  advancedFilters: { borderRadius: 12, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, padding: 14, gap: 15 },
  filterGroup: { gap: 8 },
  filterGroupTitle: { color: palette.ink, fontSize: 13, fontWeight: '900' },
  unknownFilterNote: { color: palette.muted, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  locationPanel: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 10, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, padding: 12 },
  locationCopy: { flex: 1, gap: 3 },
  locationTitle: { color: palette.ink, fontSize: 15, fontWeight: '900' },
  locationText: { color: palette.muted, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  locationButton: { minHeight: 42, borderRadius: 9, backgroundColor: palette.ink, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  locationButtonText: { color: palette.surface, fontSize: 13, fontWeight: '900' },
  discoveryLayout: { gap: 0 },
  discoveryLayoutWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 18 },
  mapColumn: { gap: 12 },
  mapColumnWide: { flex: 1.25 },
  mapSurface: { position: 'relative' },
  mapActions: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  searchAreaButton: { minHeight: 44, borderRadius: 999, backgroundColor: palette.ink, paddingHorizontal: 17, alignItems: 'center', justifyContent: 'center', ...shadow },
  searchAreaText: { color: palette.surface, fontSize: 13, fontWeight: '900' },
  recenterButton: { marginLeft: 'auto', width: 46, height: 46, borderRadius: 23, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center', ...shadow },
  recenterText: { color: palette.jade, fontSize: 25, lineHeight: 27, fontWeight: '900' },
  statusPanel: { minHeight: 70, borderRadius: 10, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  statusText: { color: palette.muted, fontSize: 13, fontWeight: '800' },
  resultSheet: { zIndex: 2, marginTop: -26, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.paper, padding: 16, gap: 14, ...shadow },
  resultSheetWide: { flex: 0.75, marginTop: 0, borderRadius: 14 },
  sheetHandle: { width: 44, height: 5, borderRadius: 99, backgroundColor: palette.line, alignSelf: 'center', marginBottom: 2 },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  resultsHint: { color: palette.muted, fontSize: 12, fontWeight: '700', marginTop: 2 },
  sectionLabel: { color: palette.ink, fontSize: 20, fontWeight: '900' },
  detailsButton: { minHeight: 40, borderRadius: 9, backgroundColor: palette.mint, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  detailsButtonText: { color: palette.jade, fontSize: 13, fontWeight: '900' },
  ratePrompt: { borderRadius: 12, borderWidth: 1, borderColor: '#ffc4b5', backgroundColor: palette.coralSoft, padding: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  ratePromptCopy: { flex: 1, minWidth: 180, gap: 3 },
  ratePromptTitle: { color: palette.ink, fontSize: 15, fontWeight: '900' },
  ratePromptText: { color: palette.muted, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  rateButton: { minHeight: 44, borderRadius: 9, backgroundColor: palette.coral, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center' },
  rateButtonText: { color: '#fffaf6', fontSize: 13, fontWeight: '900' },
  list: { gap: 10 },
  resultItem: { gap: 0 },
  resultRouteRow: { minHeight: 46, marginTop: -1, borderWidth: 1, borderColor: palette.line, borderBottomLeftRadius: 9, borderBottomRightRadius: 9, backgroundColor: palette.surface, paddingLeft: 12, paddingRight: 7, flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultRouteText: { flex: 1, color: palette.muted, fontSize: 11, fontWeight: '800' },
  resultDirectionsButton: { minHeight: 34, borderRadius: 8, backgroundColor: palette.mint, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center' },
  resultDirectionsText: { color: palette.jade, fontSize: 12, fontWeight: '900' },
  empty: { borderRadius: 10, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, padding: 18, gap: 4 },
  emptyTitle: { color: palette.ink, fontSize: 17, fontWeight: '900' },
  emptyText: { color: palette.muted, fontSize: 13, lineHeight: 19 },
});
