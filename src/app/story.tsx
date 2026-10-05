import { useCallback, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { FlatList, Linking, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { StoryContentsEntry, StorySummary } from '../domain/types';
import { Control } from '../reader/controls';
import { screenStyles as styles } from '../reader/screen-styles';
import { useStorage } from '../storage/context';

export default function StoryContents() {
  const params = useLocalSearchParams<{ story?: string }>();
  const id = typeof params.story === 'string' ? params.story : '';
  const { repository } = useStorage();
  const [story, setStory] = useState<StorySummary | null>(null);
  const [entries, setEntries] = useState<StoryContentsEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    let active = true;
    Promise.all([repository.getStory(id), repository.listContents(id)]).then(([story, entries]) => {
      if (active) { setStory(story); setEntries(entries); setError(story ? null : 'Story is not in the local library.'); }
    }).catch(() => { if (active) setError('Could not read local story contents.'); });
    return () => { active = false; };
  }, [id, repository]));
  return <SafeAreaView style={styles.page}><FlatList data={entries} keyExtractor={(entry) => entry.id}
    contentContainerStyle={styles.content} ListHeaderComponent={<View style={styles.section}>
      <Control label="Return to Library" text="Library" onPress={() => router.replace('/')} />
      <Text accessibilityRole="header" style={styles.heading}>{story?.title ?? 'Story contents'}</Text>
      {story && <><Text>{story.author ?? 'Author unavailable'}</Text>
        <Text>{story.downloaded} / {story.total} text chapters downloaded</Text>
        {story.source === 'spacebattles' && <Text>Text downloaded/offline. Source images are not downloaded in I0. Only primary Threadmarks are included.</Text>}
        {!!story.sourceUrl && <Control label="Open story source in browser" text="View source"
          onPress={() => { void Linking.openURL(story.sourceUrl).catch(() => setError('Could not open the source in your browser.')); }} />}
        {story.downloaded < story.total && <Control label="Resume Download" text="Resume Download"
          onPress={() => router.push({ pathname: '/add-story', params: { story: id } })} />}</>}
      {error && <Text accessibilityRole="alert">{error}</Text>}
    </View>} renderItem={({ item }) => <View style={styles.section}>
      <Control label={`Read ${item.title}`} text={`${item.position + 1}. ${item.title}`} disabled={!item.downloaded}
        onPress={() => { if (item.downloaded) router.push({ pathname: '/reader', params: { chapter: item.id } }); }} />
      <Text>{item.downloaded ? 'Text downloaded' : 'Not downloaded'}</Text>
      {__DEV__ && <Text selectable>Post ID: {item.postId}</Text>}
    </View>} /></SafeAreaView>;
}
