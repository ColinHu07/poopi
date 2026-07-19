import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import {
  Image,
  ImageBackground,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ColorValue,
} from 'react-native';

import { FEATURE_LABELS } from '@/components/app/TagChip';
import { seedBathrooms, seedUserRatings } from '@/src/data/fixtures';
import type { Bathroom, BathroomFilters, FeatureTag, UserRating } from '@/src/data/types';
import { applyEloComparison, distanceKm, scoreMapFromRatings, sortRatings } from '@/src/lib/ranking';

const HOME = { latitude: 40.7536, longitude: -73.9832 };

const SCENARIOS: Array<{
  id: string;
  label: string;
  filters: BathroomFilters;
  preferredFeatures: FeatureTag[];
}> = [
  {
    id: 'nearby',
    label: 'Open now',
    filters: { openNow: true },
    preferredFeatures: ['multiple_stalls', 'hook_or_shelf'],
  },
  {
    id: 'trending',
    label: 'No code',
    filters: { openNow: true, highConfidence: true },
    preferredFeatures: ['mirror', 'hook_or_shelf'],
  },
  {
    id: 'accessible',
    label: 'Step-free',
    filters: { openNow: true, wheelchair: true },
    preferredFeatures: ['wheelchair_accessible', 'step_free'],
  },
  {
    id: 'family',
    label: 'Baby change',
    filters: { openNow: true, babyChanging: true },
    preferredFeatures: ['baby_changing', 'family_room'],
  },
];

const PAIRS = [
  ['bryant-park', 'hudson-yards'],
  ['nypl-main', 'falchi-building'],
  ['whole-foods-union', 'port-authority'],
  ['central-park-bethesda', 'mccarren-field-house'],
];

const GUIDE_CARDS = [
  {
    title: 'Late-night safe stops',
    eyebrow: 'after 8 PM',
    progress: '4 verified tonight',
    tint: 'rgba(49, 87, 255, 0.32)',
  },
  {
    title: 'Changing tables checked',
    eyebrow: 'family mode',
    progress: '12 recent confirms',
    tint: 'rgba(255, 193, 7, 0.34)',
  },
  {
    title: 'No-code public access',
    eyebrow: 'walk right in',
    progress: '8 high-trust stops',
    tint: 'rgba(0, 190, 166, 0.28)',
  },
  {
    title: 'Step-free entries',
    eyebrow: 'accessibility',
    progress: '6 wheelchair notes',
    tint: 'rgba(255, 104, 96, 0.3)',
  },
];

const BATHROOM_LABELS = [
  'Wheelchair friendly',
  'Smells good',
  'Roomy stall',
  'Bidet',
  'Strong lock',
  'Changing table',
  'Quiet',
  'Urinal only',
  'Stinks',
  'Wide seat',
  'Good lighting',
  'No code',
];

function getDemoBathroomById(id: string): Bathroom | undefined {
  return seedBathrooms.find((bathroom) => bathroom.id === id);
}

function getDemoNearbyBathrooms(filters: BathroomFilters = {}): Bathroom[] {
  return seedBathrooms.filter((bathroom) => {
    if (filters.openNow && !bathroom.isOpenNow) return false;
    if (filters.free && bathroom.access !== 'public') return false;
    if (filters.wheelchair && !bathroom.features.includes('wheelchair_accessible')) return false;
    if (filters.babyChanging && !bathroom.features.includes('baby_changing')) return false;
    if (filters.allGender && !bathroom.features.includes('all_gender')) return false;
    if (filters.singleStall && !bathroom.features.includes('single_stall')) return false;
    if (filters.customersOnly && bathroom.access !== 'customers_only') return false;
    if (filters.paid && bathroom.access !== 'paid') return false;
    if (filters.highConfidence && bathroom.confidence < 0.8) return false;
    return true;
  });
}

const cobalt = '#3157ff';
const inkBlue = '#171827';
const citrus = '#d9ff5b';
const coral = '#ff6860';
const aqua = '#00bea6';
const panel = '#eef1ff';
const line = '#e2e5f1';
const muted = '#697087';
const ink = '#191a23';
const paper = '#fbfbff';

export default function VisualizerScreen() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [ratings, setRatings] = useState<UserRating[]>(seedUserRatings.map((rating) => ({ ...rating })));
  const [pairIndex, setPairIndex] = useState(0);
  const scenario = SCENARIOS.find((item) => item.id === scenarioId) ?? SCENARIOS[0];
  const bathrooms = useMemo(() => getDemoNearbyBathrooms(scenario.filters), [scenario]);
  const scoreMap = useMemo(() => scoreMapFromRatings(ratings), [ratings]);
  const ranked = useMemo(
    () =>
      sortRatings(ratings)
        .map((rating, index) => ({
          rating,
          bathroom: getDemoBathroomById(rating.bathroomId),
          rank: index + 1,
          score: scoreMap[rating.bathroomId],
        }))
        .filter((item) => item.bathroom),
    [ratings, scoreMap],
  );
  const featured = bathrooms.slice(0, 4);
  const heroBathroom = featured[0] ?? getDemoNearbyBathrooms({})[0];
  const pair = PAIRS[pairIndex % PAIRS.length];
  const left = getDemoBathroomById(pair[0]);
  const right = getDemoBathroomById(pair[1]);

  function choose(winnerId: string, loserId: string) {
    setRatings((current) => applyEloComparison(current, winnerId, loserId));
    setPairIndex((current) => current + 1);
  }

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.stage} showsVerticalScrollIndicator={false}>
        <View style={styles.stageHeader}>
          <Text style={styles.brandMark}>concept 02</Text>
          <Text style={styles.stageTitle}>Poopi</Text>
          <Text style={styles.stageSubcopy}>A bathroom-native direction: access intel, trust cards, quick compares, and less restaurant energy.</Text>
        </View>

        <View style={styles.deviceRow}>
          <PhoneFrame>
            <HomePreview
              bathrooms={featured}
              heroBathroom={heroBathroom}
              scenarioId={scenarioId}
              onScenarioChange={setScenarioId}
              ranked={ranked}
            />
          </PhoneFrame>

          <PhoneFrame>
            <RankPreview
              left={left}
              right={right}
              ranked={ranked}
              onChoose={choose}
              onReset={() => {
                setRatings(seedUserRatings.map((rating) => ({ ...rating })));
                setPairIndex(0);
              }}
              scenario={scenario}
              bathrooms={bathrooms}
            />
          </PhoneFrame>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.phoneShadow}>
      <View style={styles.phone}>
        <View style={styles.dynamicIsland} />
        {children}
      </View>
    </View>
  );
}

function HomePreview({
  bathrooms,
  heroBathroom,
  scenarioId,
  onScenarioChange,
  ranked,
}: {
  bathrooms: Bathroom[];
  heroBathroom: Bathroom;
  scenarioId: string;
  onScenarioChange: (id: string) => void;
  ranked: Array<{ bathroom?: Bathroom; rank: number; score: number; rating: UserRating }>;
}) {
  const feedBathroom = ranked[1]?.bathroom ?? heroBathroom;
  const suggested = ranked[2]?.bathroom ?? heroBathroom;

  return (
    <View style={styles.screen}>
      <StatusBar />
      <AppHeader />

      <View style={styles.searchBox}>
        <Symbol name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={16} color={muted} fallback="S" />
        <Text style={styles.searchText}>Search access notes, stations, friends</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pillScroller}
        contentContainerStyle={styles.pills}>
        {SCENARIOS.map((scenario) => {
          const active = scenario.id === scenarioId;
          return (
            <Pressable
              key={scenario.id}
              onPress={() => onScenarioChange(scenario.id)}
              style={[styles.pill, active && styles.activePill]}>
              <Text style={[styles.pillText, active && styles.activePillText]}>{scenario.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable style={styles.inviteCard}>
        <View style={styles.mailIcon}>
          <Symbol name={{ ios: 'key', android: 'key', web: 'key' }} size={19} color={cobalt} fallback="K" />
        </View>
        <View style={styles.inviteCopy}>
          <Text style={styles.inviteTitle}>Access intel updated</Text>
          <Text style={styles.inviteText}>3 codes, 2 closures, and 5 changing-table notes refreshed nearby</Text>
        </View>
        <Symbol name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={18} color={muted} fallback=">" />
      </Pressable>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>FIELD GUIDES</Text>
        <Text style={styles.seeAll}>See all</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredRow}>
        {GUIDE_CARDS.map((guide, index) => (
          <ListCard
            key={guide.title}
            bathroom={bathrooms[index % bathrooms.length] ?? heroBathroom}
            title={guide.title}
            eyebrow={guide.eyebrow}
            progress={guide.progress}
            tint={guide.tint}
          />
        ))}
      </ScrollView>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>YOUR FEED</Text>
      </View>

      <View style={styles.feedCard}>
        <Image source={{ uri: feedBathroom.photos[0]?.url }} style={styles.avatar} />
        <View style={styles.feedBody}>
          <Text style={styles.feedHeadline}>
            Maya verified {feedBathroom.name}
          </Text>
          <Text style={styles.feedMeta}>with Theo · {feedBathroom.neighborhood} · source check</Text>
          <Text style={styles.feedNote}>Notes: lock works, stocked, no code needed</Text>
          <View style={styles.feedPhotos}>
            <Image source={{ uri: heroBathroom.photos[0]?.url }} style={styles.feedThumb} />
            <Image source={{ uri: suggested.photos[0]?.url }} style={styles.feedThumb} />
          </View>
        </View>
        <View style={styles.feedScore}>
          <Text style={styles.feedScoreText}>{feedBathroom.scores.community.toFixed(1)}</Text>
        </View>
      </View>

      <BottomNav active="Feed" />
    </View>
  );
}

function RankPreview({
  left,
  right,
  ranked,
  onChoose,
  onReset,
  scenario,
  bathrooms,
}: {
  left?: Bathroom;
  right?: Bathroom;
  ranked: Array<{ bathroom?: Bathroom; rank: number; score: number; rating: UserRating }>;
  onChoose: (winnerId: string, loserId: string) => void;
  onReset: () => void;
  scenario: (typeof SCENARIOS)[number];
  bathrooms: Bathroom[];
}) {
  const topBathroom = ranked[0]?.bathroom ?? bathrooms[0];
  const explanation = topBathroom ? explainRecommendation(topBathroom, scenario.preferredFeatures) : null;

  return (
    <View style={styles.screen}>
      <StatusBar />
      <AppHeader compact />

      <ScrollView
        style={styles.phoneScroll}
        contentContainerStyle={styles.rankPreviewContent}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.compareEyebrow}>THIS OR THAT</Text>
        <Text style={styles.compareTitle}>Pick the better bathroom</Text>

        {left && right ? (
          <View style={styles.compareRow}>
            <CompareCard bathroom={left} onPress={() => onChoose(left.id, right.id)} />
            <View style={styles.compareDivider}>
              <Text style={styles.compareDividerText}>VS</Text>
            </View>
            <CompareCard bathroom={right} onPress={() => onChoose(right.id, left.id)} />
          </View>
        ) : null}

        <Pressable style={styles.resetButton} onPress={onReset}>
          <Text style={styles.resetButtonText}>Reset picks</Text>
        </Pressable>

        <GuideLabelsPanel bathroom={topBathroom} />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>YOUR RANKINGS</Text>
          <Text style={styles.seeAll}>Live</Text>
        </View>

        <View style={styles.rankList}>
          {ranked.slice(0, 4).map((item) => {
            if (!item.bathroom) return null;
            return <RankRow key={item.rating.bathroomId} item={item} />;
          })}
        </View>

        {topBathroom && explanation ? (
          <View style={styles.scorePanel}>
            <View style={styles.scorePanelHeader}>
              <Text style={styles.scorePanelTitle}>Why #{topBathroom.name.split(' ')[0]} wins</Text>
              <Text style={styles.scorePanelTotal}>{explanation.total.toFixed(2)}</Text>
            </View>
            <MiniBar label="Need" value={explanation.need} />
            <MiniBar label="Quality" value={explanation.quality} />
            <MiniBar label="Trust" value={explanation.confidence} />
          </View>
        ) : null}
      </ScrollView>

      <BottomNav active="Rank" />
    </View>
  );
}

function PoopiIcon({ size = 34 }: { size?: number }) {
  return (
    <View style={[styles.poopiIcon, { width: size, height: size, borderRadius: size * 0.3 }]}>
      <View style={styles.poopiIconBowl} />
      <View style={styles.poopiIconSeat} />
      <View style={styles.poopiIconDotLarge} />
      <View style={styles.poopiIconDotSmall} />
      <View style={styles.poopiIconSpark} />
    </View>
  );
}

function AppHeader({ compact }: { compact?: boolean }) {
  return (
    <View style={[styles.appHeader, compact && styles.compactHeader]}>
      <View style={styles.logoLockup}>
        <PoopiIcon />
        <Text style={styles.logo}>Poopi</Text>
      </View>
      <View style={styles.headerActions}>
        <Symbol name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }} size={22} color={ink} fallback="C" />
        <View style={styles.bellWrap}>
          <Symbol name={{ ios: 'bell', android: 'notifications', web: 'notifications' }} size={22} color={ink} fallback="B" />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>6</Text>
          </View>
        </View>
        <Symbol name={{ ios: 'line.3.horizontal', android: 'menu', web: 'menu' }} size={24} color={ink} fallback="M" />
      </View>
    </View>
  );
}

function GuideLabelsPanel({ bathroom }: { bathroom?: Bathroom }) {
  const previewImage = bathroom?.photos[0]?.url;

  return (
    <View style={styles.labelsPanel}>
      <View style={styles.labelsHeader}>
        <Text style={styles.labelsTitle}>Your notes and photos</Text>
        <Symbol name={{ ios: 'chevron.up', android: 'keyboard_arrow_up', web: 'keyboard_arrow_up' }} size={22} color={muted} fallback="^" />
      </View>

      <View style={styles.photoStrip}>
        <View style={styles.addPhotoTile}>
          <Text style={styles.addPhotoPlus}>+</Text>
        </View>
        {previewImage ? <Image source={{ uri: previewImage }} style={styles.notePhoto} /> : null}
      </View>

      <EditorRow
        icon={{ ios: 'tag', android: 'sell', web: 'sell' }}
        title="Edit Guides and Labels"
        chips={BATHROOM_LABELS.slice(0, 9)}
      />
      <EditorRow icon={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }} title="Add a visit date" chips={['Jun 29, 2026']} />
      <EditorRow icon={{ ios: 'square.and.pencil', android: 'edit_square', web: 'edit_square' }} title="Add Notes" />
    </View>
  );
}

function EditorRow({
  icon,
  title,
  chips = [],
}: {
  icon: { ios: any; android: any; web: any };
  title: string;
  chips?: string[];
}) {
  return (
    <View style={styles.editorRow}>
      <View style={styles.editorRowTop}>
        <Symbol name={icon} size={24} color={muted} fallback="-" />
        <Text style={styles.editorTitle}>{title}</Text>
        <Symbol name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={20} color={muted} fallback=">" />
      </View>
      {chips.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.labelChips}>
          {chips.map((chip) => (
            <View key={chip} style={[styles.labelChip, chip === 'Stinks' && styles.warningChip]}>
              <Text style={[styles.labelChipText, chip === 'Stinks' && styles.warningChipText]}>{chip}</Text>
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

function StatusBar() {
  return (
    <View style={styles.statusBar}>
      <Text style={styles.time}>9:41</Text>
      <View style={styles.statusRight}>
        <View style={styles.signalBars}>
          <View style={[styles.signal, { height: 5 }]} />
          <View style={[styles.signal, { height: 7 }]} />
          <View style={[styles.signal, { height: 9 }]} />
        </View>
        <View style={styles.battery} />
      </View>
    </View>
  );
}

function ListCard({
  bathroom,
  title,
  eyebrow,
  progress,
  tint,
}: {
  bathroom: Bathroom;
  title: string;
  eyebrow: string;
  progress: string;
  tint: string;
}) {
  return (
    <ImageBackground source={{ uri: bathroom.photos[0]?.url }} style={styles.listCard} imageStyle={styles.listCardImage}>
      <View style={[styles.imageShade, { backgroundColor: tint }]} />
      <Text style={styles.listEyebrow}>{eyebrow}</Text>
      <Text style={styles.listTitle}>{title}</Text>
      <Text style={styles.listProgress}>{progress}</Text>
    </ImageBackground>
  );
}

function CompareCard({ bathroom, onPress }: { bathroom: Bathroom; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.compareCard, pressed && styles.pressed]} onPress={onPress}>
      <Image source={{ uri: bathroom.photos[0]?.url }} style={styles.compareImage} />
      <Text style={styles.compareName} numberOfLines={2}>
        {bathroom.name}
      </Text>
      <Text style={styles.compareMeta}>{bathroom.features.slice(0, 2).map((tag) => FEATURE_LABELS[tag]).join(' · ')}</Text>
    </Pressable>
  );
}

function RankRow({
  item,
}: {
  item: { bathroom?: Bathroom; rank: number; score: number; rating: UserRating };
}) {
  const bathroom = item.bathroom;
  if (!bathroom) return null;
  return (
    <View style={styles.rankRow}>
      <Text style={styles.rankIndex}>{item.rank}</Text>
      <Image source={{ uri: bathroom.photos[0]?.url }} style={styles.rankImage} />
      <View style={styles.rankCopy}>
        <Text style={styles.rankName} numberOfLines={1}>
          {bathroom.name}
        </Text>
        <Text style={styles.rankMeta}>{bathroom.neighborhood}</Text>
      </View>
      <View style={styles.rankScore}>
        <Text style={styles.rankScoreText}>{item.score.toFixed(1)}</Text>
      </View>
    </View>
  );
}

function MiniBar({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.miniBarRow}>
      <Text style={styles.miniBarLabel}>{label}</Text>
      <View style={styles.miniBarTrack}>
        <View style={[styles.miniBarFill, { width: `${Math.round(value * 100)}%` }]} />
      </View>
    </View>
  );
}

function BottomNav({ active }: { active: 'Feed' | 'Rank' }) {
  const items = [
    { label: 'Home', icon: { ios: 'house', android: 'home', web: 'home' } },
    { label: 'Guides', icon: { ios: 'map', android: 'map', web: 'map' } },
    { label: 'Log', icon: { ios: 'plus.circle.fill', android: 'add_circle', web: 'add_circle' } },
    { label: 'Rank', icon: { ios: 'arrow.left.arrow.right', android: 'compare_arrows', web: 'compare_arrows' } },
    { label: 'Me', icon: { ios: 'person.crop.circle', android: 'person', web: 'person' } },
  ] as const;

  return (
    <View style={styles.bottomNav}>
      {items.map((item) => {
        const selected = item.label === active || (active === 'Feed' && item.label === 'Home') || (active === 'Rank' && item.label === 'Log');
        return (
          <View key={item.label} style={styles.navItem}>
            <View style={item.label === 'Log' ? styles.addButton : undefined}>
              <Symbol name={item.icon} size={item.label === 'Log' ? 28 : 22} color={selected ? cobalt : '#202725'} fallback={item.label[0]} />
            </View>
            <Text style={[styles.navLabel, selected && styles.activeNavLabel]}>{item.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function Symbol({
  name,
  size,
  color,
  fallback,
}: {
  name: { ios: any; android: any; web: any };
  size: number;
  color: ColorValue;
  fallback: string;
}) {
  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={color}
      fallback={<Text style={{ color, fontSize: size * 0.72, fontWeight: '900' }}>{fallback}</Text>}
    />
  );
}

function explainRecommendation(bathroom: Bathroom, preferredFeatures: FeatureTag[]) {
  const need = preferredFeatures.length
    ? preferredFeatures.filter((feature) => bathroom.features.includes(feature)).length / preferredFeatures.length
    : 0.8;
  const quality = bathroom.scores.community / 10;
  const confidence = bathroom.confidence;
  const proximity = Math.max(
    0,
    Math.min(1, 1 - distanceKm(HOME.latitude, HOME.longitude, bathroom.latitude, bathroom.longitude) / 6),
  );
  const freshness = bathroom.isOpenNow ? 1 : 0.35;
  const total = need * 0.35 + quality * 0.25 + confidence * 0.15 + proximity * 0.15 + freshness * 0.1;
  return { need, quality, confidence, proximity, freshness, total };
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#e8ecff',
  },
  stage: {
    minHeight: '100%',
    padding: 22,
    gap: 24,
    alignItems: 'center',
  },
  stageHeader: {
    width: '100%',
    maxWidth: 900,
    gap: 5,
  },
  brandMark: {
    color: coral,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    fontFamily: 'SpaceMono',
    textTransform: 'uppercase',
  },
  stageTitle: {
    color: inkBlue,
    fontSize: 30,
    lineHeight: 35,
    fontWeight: '900',
    fontFamily: 'SpaceMono',
  },
  stageSubcopy: {
    color: '#5c6483',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  deviceRow: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 28,
  },
  phoneShadow: {
    borderRadius: 46,
    backgroundColor: inkBlue,
    padding: 8,
    boxShadow: '0 24px 70px rgba(16, 27, 25, 0.22)',
  } as any,
  phone: {
    width: 390,
    height: 820,
    maxWidth: '100%',
    borderRadius: 39,
    overflow: 'hidden',
    backgroundColor: paper,
    borderWidth: 1,
    borderColor: '#bcc5ee',
    position: 'relative',
  },
  dynamicIsland: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    width: 116,
    height: 33,
    borderRadius: 18,
    backgroundColor: '#020303',
    zIndex: 5,
  },
  screen: {
    flex: 1,
    backgroundColor: paper,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 0,
  },
  phoneScroll: {
    flex: 1,
  },
  rankPreviewContent: {
    paddingBottom: 96,
  },
  statusBar: {
    height: 33,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  time: {
    color: '#040807',
    fontSize: 15,
    fontWeight: '900',
  },
  statusRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  signalBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 12,
  },
  signal: {
    width: 3,
    borderRadius: 2,
    backgroundColor: '#050706',
  },
  battery: {
    width: 22,
    height: 10,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: '#050706',
  },
  appHeader: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compactHeader: {
    marginBottom: 4,
  },
  logo: {
    color: inkBlue,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '900',
    fontFamily: 'SpaceMono',
  },
  logoLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: citrus,
    color: inkBlue,
    fontSize: 13,
    lineHeight: 34,
    textAlign: 'center',
    fontWeight: '900',
    fontFamily: 'SpaceMono',
  },
  poopiIcon: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: cobalt,
  },
  poopiIconSeat: {
    position: 'absolute',
    left: 7,
    bottom: 16,
    width: 20,
    height: 4,
    borderRadius: 2,
    backgroundColor: citrus,
  },
  poopiIconBowl: {
    position: 'absolute',
    left: 9,
    bottom: 7,
    width: 16,
    height: 12,
    borderBottomLeftRadius: 9,
    borderBottomRightRadius: 9,
    borderWidth: 3,
    borderTopWidth: 0,
    borderColor: '#fff',
  },
  poopiIconDotLarge: {
    position: 'absolute',
    top: 7,
    left: 9,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  poopiIconDotSmall: {
    position: 'absolute',
    top: 12,
    right: 8,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: citrus,
  },
  poopiIconSpark: {
    position: 'absolute',
    right: 7,
    bottom: 7,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: coral,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  bellWrap: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    right: -7,
    top: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: coral,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: paper,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  searchBox: {
    minHeight: 39,
    borderRadius: 8,
    backgroundColor: '#f1f3fb',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 11,
  },
  searchText: {
    color: muted,
    fontSize: 14,
    fontWeight: '700',
  },
  pills: {
    gap: 8,
    paddingRight: 20,
  },
  pillScroller: {
    height: 45,
    maxHeight: 45,
    marginVertical: 12,
  },
  pill: {
    minHeight: 32,
    borderRadius: 10,
    backgroundColor: panel,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePill: {
    backgroundColor: cobalt,
  },
  pillText: {
    color: inkBlue,
    fontSize: 13,
    fontWeight: '900',
    fontFamily: 'SpaceMono',
  },
  activePillText: {
    color: '#fff',
  },
  inviteCard: {
    minHeight: 69,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: line,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  mailIcon: {
    width: 35,
    height: 35,
    borderRadius: 8,
    backgroundColor: citrus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteCopy: {
    flex: 1,
  },
  inviteTitle: {
    color: inkBlue,
    fontSize: 14,
    fontWeight: '900',
  },
  inviteText: {
    color: muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 11,
  },
  sectionTitle: {
    color: inkBlue,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    fontFamily: 'SpaceMono',
  },
  seeAll: {
    color: cobalt,
    fontSize: 12,
    fontWeight: '900',
  },
  featuredRow: {
    gap: 14,
    paddingRight: 20,
    paddingBottom: 21,
  },
  listCard: {
    width: 145,
    height: 132,
    overflow: 'hidden',
    borderRadius: 8,
    justifyContent: 'flex-end',
    padding: 12,
  },
  listCardImage: {
    borderRadius: 8,
  },
  imageShade: {
    position: 'absolute',
    inset: 0,
  },
  listEyebrow: {
    alignSelf: 'flex-start',
    borderRadius: 7,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.92)',
    color: inkBlue,
    fontSize: 10,
    fontWeight: '900',
    fontFamily: 'SpaceMono',
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginBottom: 34,
    textTransform: 'uppercase',
  },
  listTitle: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '900',
  },
  listProgress: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  feedCard: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 4,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: line,
  },
  avatar: {
    width: 57,
    height: 57,
    borderRadius: 28.5,
    backgroundColor: line,
  },
  feedBody: {
    flex: 1,
  },
  feedHeadline: {
    color: ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  feedMeta: {
    color: muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 2,
  },
  feedNote: {
    color: ink,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 8,
  },
  feedPhotos: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  feedThumb: {
    width: 42,
    height: 42,
    borderRadius: 6,
    backgroundColor: line,
  },
  feedScore: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    borderWidth: 1,
    borderColor: line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  feedScoreText: {
    color: aqua,
    fontSize: 15,
    fontWeight: '900',
  },
  compareEyebrow: {
    color: coral,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 4,
    fontFamily: 'SpaceMono',
  },
  compareTitle: {
    color: ink,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
    marginBottom: 14,
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 9,
  },
  compareCard: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: line,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  compareImage: {
    height: 118,
    backgroundColor: line,
  },
  compareName: {
    color: ink,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '900',
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  compareMeta: {
    color: muted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingTop: 4,
    paddingBottom: 12,
  },
  compareDivider: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compareDividerText: {
    color: cobalt,
    fontSize: 12,
    fontWeight: '900',
  },
  resetButton: {
    minHeight: 37,
    borderRadius: 19,
    backgroundColor: panel,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 18,
  },
  resetButtonText: {
    color: cobalt,
    fontSize: 13,
    fontWeight: '900',
  },
  labelsPanel: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: line,
    backgroundColor: '#fff',
    marginBottom: 18,
    overflow: 'hidden',
  },
  labelsHeader: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  labelsTitle: {
    color: inkBlue,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
  },
  photoStrip: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 13,
  },
  addPhotoTile: {
    width: 76,
    height: 76,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#c8cedf',
    backgroundColor: '#f6f7fc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoPlus: {
    color: muted,
    fontSize: 36,
    lineHeight: 38,
    fontWeight: '300',
  },
  notePhoto: {
    width: 76,
    height: 76,
    borderRadius: 10,
    backgroundColor: line,
  },
  editorRow: {
    borderTopWidth: 1,
    borderTopColor: line,
    paddingVertical: 11,
  },
  editorRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
  },
  editorTitle: {
    flex: 1,
    color: ink,
    fontSize: 16,
    fontWeight: '800',
  },
  labelChips: {
    gap: 8,
    paddingTop: 10,
    paddingLeft: 48,
    paddingRight: 12,
  },
  labelChip: {
    minHeight: 30,
    borderRadius: 16,
    backgroundColor: inkBlue,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningChip: {
    backgroundColor: '#ffe5e2',
    borderWidth: 1,
    borderColor: '#ffc2bd',
  },
  labelChipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  warningChipText: {
    color: coral,
  },
  rankList: {
    gap: 8,
    marginBottom: 16,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 58,
  },
  rankIndex: {
    width: 20,
    color: cobalt,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  rankImage: {
    width: 43,
    height: 43,
    borderRadius: 8,
    backgroundColor: line,
  },
  rankCopy: {
    flex: 1,
  },
  rankName: {
    color: ink,
    fontSize: 14,
    fontWeight: '900',
  },
  rankMeta: {
    color: muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  rankScore: {
    width: 42,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  rankScoreText: {
    color: cobalt,
    fontSize: 14,
    fontWeight: '900',
  },
  scorePanel: {
    borderRadius: 10,
    backgroundColor: inkBlue,
    padding: 13,
    gap: 9,
  },
  scorePanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  scorePanelTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  scorePanelTotal: {
    color: citrus,
    fontSize: 19,
    fontWeight: '900',
  },
  miniBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  miniBarLabel: {
    width: 52,
    color: '#d8defb',
    fontSize: 12,
    fontWeight: '800',
  },
  miniBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 7,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  miniBarFill: {
    height: 8,
    borderRadius: 7,
    backgroundColor: citrus,
  },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 76,
    borderTopWidth: 1,
    borderTopColor: line,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 9,
  },
  navItem: {
    width: 60,
    alignItems: 'center',
    gap: 4,
  },
  navLabel: {
    color: '#202725',
    fontSize: 10,
    fontWeight: '800',
  },
  activeNavLabel: {
    color: cobalt,
  },
  addButton: {
    width: 33,
    height: 33,
    borderRadius: 16.5,
    backgroundColor: panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
