import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { palette } from '@/components/app/tokens';
import { useAuth } from '@/src/providers/AuthProvider';

export default function EntryScreen() {
  const { configured, isAnonymous, loading, profileComplete, session } = useAuth();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={palette.jade} />
      </View>
    );
  }

  if (!configured || !session) {
    return <Redirect href={'/welcome' as any} />;
  }

  if (!isAnonymous && !profileComplete) {
    return <Redirect href={'/complete-profile' as any} />;
  }

  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.paper,
  },
});
