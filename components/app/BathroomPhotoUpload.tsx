import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { BathroomPhoto } from '@/src/data/types';
import { errorMessage } from '@/src/lib/errors';
import { uploadBathroomPhoto } from '@/src/services/bathroomApi';
import { palette, shadow } from './tokens';

interface PreparedPhoto {
  base64: string;
  height: number;
  uri: string;
  width: number;
}

export function BathroomPhotoUpload({
  bathroomId,
  bathroomName,
  onUploaded,
}: {
  bathroomId: string;
  bathroomName: string;
  onUploaded?: (photo: BathroomPhoto) => void;
}) {
  const [chooserOpen, setChooserOpen] = useState(false);
  const [prepared, setPrepared] = useState<PreparedPhoto>();
  const [confirmedSafe, setConfirmedSafe] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  async function choosePhoto(source: 'camera' | 'library') {
    setChooserOpen(false);
    setError('');
    setSuccess('');
    setProcessing(true);
    try {
      if (Platform.OS !== 'web') {
        const permission = source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          throw new Error(
            source === 'camera'
              ? 'Allow camera access to take a bathroom photo.'
              : 'Allow photo-library access to choose a bathroom photo.',
          );
        }
      }

      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const longestSide = Math.max(asset.width, asset.height);
      const resize = longestSide > 1800
        ? asset.width >= asset.height
          ? [{ resize: { width: 1800 } }]
          : [{ resize: { height: 1800 } }]
        : [];
      const normalized = await manipulateAsync(asset.uri, resize, {
        base64: true,
        compress: 0.82,
        format: SaveFormat.JPEG,
      });
      if (!normalized.base64) throw new Error('Poopi could not prepare that image for upload.');

      setPrepared({
        base64: normalized.base64,
        height: normalized.height,
        uri: normalized.uri,
        width: normalized.width,
      });
      setConfirmedSafe(false);
    } catch (err) {
      setError(errorMessage(err, 'Unable to open your camera or photo library.'));
    } finally {
      setProcessing(false);
    }
  }

  async function upload() {
    if (!prepared || !confirmedSafe) return;
    setUploading(true);
    setError('');
    try {
      const photo = await uploadBathroomPhoto({
        bathroomId,
        base64: prepared.base64,
        alt: `Bathroom photo at ${bathroomName}`,
      });
      setSuccess('Photo uploaded! You can see it now; everyone else will see it after moderation.');
      setPrepared(undefined);
      setConfirmedSafe(false);
      onUploaded?.(photo);
    } catch (err) {
      setError(errorMessage(err, 'Unable to upload this photo.'));
    } finally {
      setUploading(false);
    }
  }

  return (
    <View style={styles.card}>
      <Image
        accessibilityLabel="Poopi mascot holding a camera beside a bathroom door"
        resizeMode="cover"
        source={require('../../assets/images/photo-upload-hero-v1.png')}
        style={styles.hero}
      />
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>Show people what it’s really like</Text>
          <Text style={styles.copy}>Empty-room photos and bathroom signs are welcome.</Text>
        </View>
      </View>

      {prepared ? (
        <View style={styles.previewWrap}>
          <Image accessibilityLabel="Selected bathroom photo preview" source={{ uri: prepared.uri }} style={styles.preview} />
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: confirmedSafe }}
            onPress={() => setConfirmedSafe((value) => !value)}
            style={[styles.safetyCheck, confirmedSafe && styles.safetyCheckActive]}>
            <View style={[styles.checkbox, confirmedSafe && styles.checkboxActive]}>
              {confirmedSafe ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
            <Text style={styles.safetyText}>No people, faces, children, or sensitive reflections are visible.</Text>
          </Pressable>
          <View style={styles.previewActions}>
            <Pressable
              accessibilityRole="button"
              disabled={uploading}
              onPress={() => setChooserOpen(true)}
              style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>Choose another</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: uploading || !confirmedSafe }}
              disabled={uploading || !confirmedSafe}
              onPress={upload}
              style={[styles.uploadButton, !confirmedSafe && styles.disabledButton]}>
              {uploading ? <ActivityIndicator color={palette.surface} /> : <Text style={styles.uploadText}>Upload photo</Text>}
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          disabled={processing}
          onPress={() => setChooserOpen(true)}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
          {processing ? <ActivityIndicator color={palette.jade} /> : <Text style={styles.addIcon}>＋</Text>}
          <Text style={styles.addText}>{processing ? 'Preparing photo…' : 'Add a bathroom photo'}</Text>
        </Pressable>
      )}

      {success ? <Text accessibilityLiveRegion="polite" style={styles.success}>{success}</Text> : null}
      {error ? <Text accessibilityLiveRegion="assertive" style={styles.error}>{error}</Text> : null}

      <Modal
        animationType="slide"
        onRequestClose={() => setChooserOpen(false)}
        transparent
        visible={chooserOpen}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close photo options" onPress={() => setChooserOpen(false)} style={styles.backdrop}>
          <Pressable onPress={(event) => event.stopPropagation()} style={styles.actionSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Add a bathroom photo</Text>
            <Text style={styles.sheetCopy}>Choose where your photo comes from.</Text>
            <Pressable accessibilityRole="button" onPress={() => choosePhoto('camera')} style={styles.sheetOption}>
              <Text style={styles.sheetOptionIcon}>◎</Text>
              <View style={styles.sheetOptionCopy}>
                <Text style={styles.sheetOptionTitle}>Take a photo</Text>
                <Text style={styles.sheetOptionText}>Open your camera</Text>
              </View>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => choosePhoto('library')} style={styles.sheetOption}>
              <Text style={styles.sheetOptionIcon}>▧</Text>
              <View style={styles.sheetOptionCopy}>
                <Text style={styles.sheetOptionTitle}>Choose from library</Text>
                <Text style={styles.sheetOptionText}>Use a photo already on your phone</Text>
              </View>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setChooserOpen(false)} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: palette.cocoaSoft,
    backgroundColor: palette.surface,
    padding: 15,
    gap: 12,
  },
  hero: {
    width: '100%',
    aspectRatio: 3 / 2,
    borderRadius: 18,
    backgroundColor: palette.mint,
  },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  headingCopy: { flex: 1, gap: 2 },
  title: { color: palette.ink, fontSize: 15, fontWeight: '900' },
  copy: { color: palette.muted, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  addButton: {
    minHeight: 56,
    borderRadius: 17,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: palette.jade,
    backgroundColor: palette.mint,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addIcon: { color: palette.jade, fontSize: 24, lineHeight: 27, fontWeight: '700' },
  addText: { color: palette.jade, fontSize: 14, fontWeight: '900' },
  previewWrap: { gap: 10 },
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: 17, backgroundColor: palette.mint },
  safetyCheck: {
    minHeight: 54,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: palette.line,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  safetyCheckActive: { borderColor: palette.jade, backgroundColor: palette.mint },
  checkbox: {
    width: 25,
    height: 25,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: { borderColor: palette.jade, backgroundColor: palette.jade },
  checkmark: { color: palette.surface, fontSize: 15, fontWeight: '900' },
  safetyText: { flex: 1, color: palette.ink, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  previewActions: { flexDirection: 'row', gap: 8 },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { color: palette.ink, fontSize: 12, fontWeight: '900' },
  uploadButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 15,
    backgroundColor: palette.jade,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: { color: palette.surface, fontSize: 13, fontWeight: '900' },
  disabledButton: { opacity: 0.45 },
  success: { color: palette.jade, fontSize: 12, lineHeight: 17, fontWeight: '800' },
  error: { color: palette.coral, fontSize: 12, lineHeight: 17, fontWeight: '800' },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(43, 29, 24, 0.38)',
  },
  actionSheet: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: palette.paper,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
    gap: 10,
    ...shadow,
  },
  sheetHandle: { width: 42, height: 5, borderRadius: 99, backgroundColor: palette.line, alignSelf: 'center' },
  sheetTitle: { color: palette.ink, fontSize: 21, fontWeight: '900', textAlign: 'center', marginTop: 4 },
  sheetCopy: { color: palette.muted, fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  sheetOption: {
    minHeight: 68,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: palette.cocoaSoft,
    backgroundColor: palette.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 12,
  },
  sheetOptionIcon: { width: 34, color: palette.jade, fontSize: 26, textAlign: 'center', fontWeight: '900' },
  sheetOptionCopy: { flex: 1, gap: 2 },
  sheetOptionTitle: { color: palette.ink, fontSize: 16, fontWeight: '900' },
  sheetOptionText: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  cancelButton: {
    minHeight: 54,
    borderRadius: 17,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  cancelText: { color: palette.coral, fontSize: 15, fontWeight: '900' },
  pressed: { opacity: 0.7 },
});
