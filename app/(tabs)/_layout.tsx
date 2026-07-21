import { SymbolView } from 'expo-symbols';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, Text, View, type ColorValue } from 'react-native';

import { palette } from '@/components/app/tokens';
import { useAuth } from '@/src/providers/AuthProvider';

function TabIcon({ color, name, fallback }: { color: ColorValue; name: any; fallback: string }) {
  return (
    <SymbolView
      name={name}
      tintColor={color}
      size={24}
      fallback={<Text style={{ color, fontSize: 18, fontWeight: '900' }}>{fallback}</Text>}
    />
  );
}

export default function TabLayout() {
  const { isAnonymous, loading, profileComplete, session } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.paper }}>
        <ActivityIndicator color={palette.jade} />
      </View>
    );
  }

  if (session && !isAnonymous && !profileComplete) {
    return <Redirect href={'/complete-profile' as any} />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.jade,
        tabBarInactiveTintColor: palette.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '900', paddingBottom: 2 },
        tabBarStyle: {
          borderTopColor: palette.cocoaSoft,
          borderTopWidth: 1.5,
          backgroundColor: palette.surface,
          minHeight: 74,
          paddingTop: 9,
          elevation: 12,
          shadowColor: palette.ink,
          shadowOpacity: 0.1,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -4 },
        },
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Map',
          tabBarIcon: ({ color }) => (
            <TabIcon color={color} fallback="M" name={{ ios: 'map', android: 'map', web: 'map' }} />
          ),
        }}
      />
      <Tabs.Screen
        name="rank"
        options={{
          title: 'Rank',
          tabBarIcon: ({ color }) => (
            <TabIcon color={color} fallback="R" name={{ ios: 'trophy', android: 'trophy', web: 'trophy' }} />
          ),
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color }) => (
            <TabIcon color={color} fallback="F" name={{ ios: 'person.2', android: 'feed', web: 'feed' }} />
          ),
        }}
      />
      <Tabs.Screen
        name="lists"
        options={{
          title: 'Lists',
          tabBarIcon: ({ color }) => (
            <TabIcon color={color} fallback="L" name={{ ios: 'list.bullet', android: 'list', web: 'list' }} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: session && !isAnonymous ? 'Profile' : 'Log in',
          tabBarIcon: ({ color }) => (
            <TabIcon color={color} fallback="P" name={{ ios: 'person.crop.circle', android: 'person', web: 'person' }} />
          ),
        }}
      />
    </Tabs>
  );
}
