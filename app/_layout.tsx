import { Stack } from 'expo-router'

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="library" />
      <Stack.Screen name="editor" />
      <Stack.Screen name="restore" />
      <Stack.Screen name="cleanup" />
      <Stack.Screen name="time-travel" />
      <Stack.Screen name="settings" />
    </Stack>
  )
}
