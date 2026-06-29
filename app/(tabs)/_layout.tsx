import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

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
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        tabBarInactiveTintColor: Colors[colorScheme].tabIconDefault,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '800' },
        tabBarStyle: {
          borderTopColor: '#dedbd2',
          backgroundColor: '#fffdf8',
          minHeight: 68,
          paddingTop: 8,
        },
        headerShown: useClientOnlyValue(false, true),
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
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <TabIcon color={color} fallback="P" name={{ ios: 'person.crop.circle', android: 'person', web: 'person' }} />
          ),
        }}
      />
    </Tabs>
  );
}
