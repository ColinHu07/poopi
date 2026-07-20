export type DirectionsPlatform = 'ios' | 'android' | 'web' | 'other';

export function formatDistance(meters: number | undefined): string {
  if (meters == null || !Number.isFinite(meters)) return 'Distance unknown';
  if (meters < 1_000) return `${Math.max(1, Math.round(meters))} m away`;
  const miles = meters / 1_609.344;
  return `${miles.toFixed(miles < 10 ? 1 : 0)} mi away`;
}

export function formatWalkingEta(meters: number | undefined): string {
  if (meters == null || !Number.isFinite(meters)) return 'ETA unknown';
  const minutes = Math.max(1, Math.round(meters / 80));
  if (minutes < 60) return `${minutes} min walk`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min walk` : `${hours} hr walk`;
}

export function buildWalkingDirectionsUrl(
  destination: { latitude: number; longitude: number; name?: string },
  platform: DirectionsPlatform,
): string {
  const coordinates = `${destination.latitude},${destination.longitude}`;
  if (platform === 'ios') {
    const query = new URLSearchParams({ daddr: coordinates, dirflg: 'w' });
    if (destination.name) query.set('q', destination.name);
    return `https://maps.apple.com/?${query.toString()}`;
  }
  const query = new URLSearchParams({ api: '1', destination: coordinates, travelmode: 'walking' });
  return `https://www.google.com/maps/dir/?${query.toString()}`;
}
