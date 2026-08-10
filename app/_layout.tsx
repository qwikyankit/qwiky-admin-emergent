import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="booking/[id]" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="experts" />
        <Stack.Screen name="operating-hours" />
        <Stack.Screen name="hood-items" />
        <Stack.Screen name="admin-settings" />
        <Stack.Screen name="catalog" />
        <Stack.Screen name="hood-management" />
      </Stack>
    </SafeAreaProvider>
  );
}
