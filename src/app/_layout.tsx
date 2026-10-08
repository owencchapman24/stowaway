import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StorageProvider } from '../storage/context';

export default function Layout() {
  return <StorageProvider><StatusBar style="auto" /><Stack screenOptions={{ headerShown: false }} /></StorageProvider>;
}
