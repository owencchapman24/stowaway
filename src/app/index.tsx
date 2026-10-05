import { useCallback, useState } from 'react';
import { useFocusEffect, router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fixtureStory } from '../fixtures/story';
import type { ChapterSummary } from '../domain/types';
import { useStorage } from '../storage/context';
import { Control } from '../reader/controls';

export default function Contents() {
  const { repository, imageWarning } = useStorage();
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [lastChapter, setLastChapter] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    let active = true;
    Promise.all([repository.listChapters(), repository.getLastChapter()]).then(([list, last]) => {
      if (active) { setChapters(list); setLastChapter(last); setError(null); }
    }).catch(() => { if (active) setError('Could not read the local chapter list.'); });
    return () => { active = false; };
  }, [repository]));
  function open(chapter: string) { router.push({ pathname: '/reader', params: { chapter } }); }
  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.content}>
    <Text accessibilityRole="header" style={styles.heading}>Stowaway</Text>
    <Text style={styles.title}>{fixtureStory.title}</Text>
    <Text style={styles.note}>Original synthetic story · 3 offline chapters</Text>
    <Text style={styles.note}>S0 fixture reader. No live imports.</Text>
    {__DEV__ && <Control label="Open S1 development diagnostic" text="S1 diagnostic (dev only)" onPress={() => router.push('/s1')} />}
    {imageWarning && <Text accessibilityRole="alert">{imageWarning}</Text>}
    {error && <Text accessibilityRole="alert">{error}</Text>}
    {lastChapter && <Control label="Resume last saved chapter" text="Resume reading" onPress={() => open(lastChapter)} />}
    {chapters.map((chapter) => <View key={chapter.id} style={styles.chapter}>
      <Control label={`Read ${chapter.title}`} text={chapter.title} onPress={() => open(chapter.id)} />
    </View>)}
    <Text style={styles.note}>Positions and reading settings stay on this device. Physical iPhone acceptance is pending.</Text>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#faf7f0' },
  content: { padding: 24, gap: 16 },
  heading: { fontSize: 30, fontWeight: '700', color: '#22252a' },
  title: { fontSize: 24, color: '#22252a' },
  note: { fontSize: 16, lineHeight: 24, color: '#44484d' },
  chapter: { marginVertical: 4 },
});
