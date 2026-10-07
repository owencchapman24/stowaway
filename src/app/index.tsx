import { useCallback, useState } from 'react';
import { useFocusEffect, router } from 'expo-router';
import { FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { StorySummary } from '../domain/types';
import { useStorage } from '../storage/context';
import { Control } from '../reader/controls';
import { screenStyles as styles } from '../reader/screen-styles';

export default function Library() {
  const { repository, imageWarning } = useStorage();
  const [stories, setStories] = useState<StorySummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    let active = true;
    repository.listStories().then((list) => {
      if (active) { setStories(list); setError(null); }
    }).catch(() => { if (active) setError('Could not read the local library.'); });
    return () => { active = false; };
  }, [repository]));
  return <SafeAreaView style={styles.page}><FlatList data={stories} keyExtractor={(story) => story.id}
    contentContainerStyle={styles.content} ListHeaderComponent={<View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>Stowaway</Text>
      <Control label="Add Story" text="Add Story" onPress={() => router.push('/add-story')} />
      {imageWarning && <Text accessibilityRole="alert">{imageWarning}</Text>}
      {error && <Text accessibilityRole="alert">{error}</Text>}
    </View>} renderItem={({ item }) => <View style={styles.section}>
      <Control label={`Open ${item.title}`} text={item.title}
        onPress={() => router.push({ pathname: '/story', params: { story: item.id } })} />
      <Text>{item.author ?? 'Author unavailable'}</Text>
      <Text>{item.downloaded} / {item.total} text chapters downloaded</Text>
      <Text>{item.unread} unread</Text>
      {item.downloaded < item.total && <Text>Pending chapters — open contents to resume download.</Text>}
    </View>} ListFooterComponent={<View style={styles.section}>
      <Text>Downloaded text, read state and reading positions stay on this device.</Text>
      {__DEV__ && <><Text accessibilityRole="header">Development diagnostics</Text>
        <Control label="Open S1 development diagnostic" text="S1 diagnostic (dev only)" onPress={() => router.push('/s1')} />
        <Control label="Open S2A recovery diagnostic" text="S2A recovery diagnostic (dev only)" onPress={() => router.push('/s2a')} /></>}
    </View>} /></SafeAreaView>;
}
