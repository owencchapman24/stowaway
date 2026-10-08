import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { useFocusEffect, router } from 'expo-router';
import { FlatList, View } from 'react-native';
import type { ContinueReadingTarget, StorySummary } from '../domain/types';
import { isStoryBusy, subscribeStoryOperations, subscribeStorySettled } from '../importing/ownership';
import { useStorage } from '../storage/context';
import { AppScreen, AppText, Button, ContinueReadingCard, InlineBanner, LoadingState, ScreenHeader, SectionHeader, StoryRow, uiStyles } from '../ui/components';

export default function Library() {
  const { repository, imageWarning } = useStorage();
  const [stories, setStories] = useState<StorySummary[]>([]);
  const [target, setTarget] = useState<ContinueReadingTarget | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const targetRef = useRef<ContinueReadingTarget | null>(null);
  const refreshing = useRef(true);
  const focused = useRef(false);
  const targetBusy = useSyncExternalStore(subscribeStoryOperations, () => !!target && isStoryBusy(target.storyId));
  const [refreshPending, setRefreshPending] = useState(true);
  useFocusEffect(useCallback(() => {
    let active = true; focused.current = true;
    let version = 0;
    const refresh = () => {
      const request = ++version; refreshing.current = true; setRefreshPending(true);
      void Promise.all([repository.listStories(), repository.getContinueReading()]).then(([list, resume]) => {
      if (active && request === version) { setStories(list); setTarget(resume); targetRef.current = resume; setError(null); }
    }).catch(() => { if (active && request === version) { setTarget(null); targetRef.current = null; setError('Local storage failure: could not read the library. Please reopen and retry.'); } })
      .finally(() => { if (active && request === version) { setLoaded(true); refreshing.current = false; setRefreshPending(false); } });
    };
    refresh();
    const unsubscribe = subscribeStorySettled(() => { if (active) refresh(); });
    return () => { active = false; focused.current = false; unsubscribe(); };
  }, [repository]));
  return <AppScreen><FlatList data={stories} keyExtractor={(story) => story.id}
    contentContainerStyle={uiStyles.content} ListHeaderComponent={<View style={uiStyles.section}>
      <ScreenHeader title="Stowaway" large action={<Button label="Add Story" text="＋" variant="tertiary" onPress={() => router.push('/add-story')} />} />
      {imageWarning && <InlineBanner tone="warning" message={imageWarning} />}
      {error && <InlineBanner tone="error" message={error} />}
      {target && <View><SectionHeader>Continue Reading</SectionHeader><ContinueReadingCard target={target} disabled={targetBusy || refreshPending}
        onPress={() => { if (focused.current && !refreshing.current && !isStoryBusy(target.storyId) && targetRef.current?.chapterId === target.chapterId) router.push({ pathname: '/reader', params: { chapter: target.chapterId } }); }} /></View>}
      {stories.length > 0 && <SectionHeader>Library</SectionHeader>}
    </View>} renderItem={({ item }) => <StoryRow story={item}
      onPress={() => router.push({ pathname: '/story', params: { story: item.id } })} />}
    ListEmptyComponent={!loaded ? <LoadingState text="Opening your library…" /> : !error ? <View style={uiStyles.section}>
      <SectionHeader>No stories yet</SectionHeader><AppText>Paste a public SpaceBattles thread URL to build your offline library.</AppText>
      <Button label="Add your first story" text="Add Story" variant="primary" onPress={() => router.push('/add-story')} />
    </View> : null} ListFooterComponent={__DEV__ ? <View style={{ marginTop: 32 }}>
      <SectionHeader>Development diagnostics</SectionHeader>
      <Button label="Open S1 development diagnostic" text="S1 diagnostic (dev only)" variant="tertiary" onPress={() => router.push('/s1')} />
      <Button label="Open S2A recovery diagnostic" text="S2A recovery diagnostic (dev only)" variant="tertiary" onPress={() => router.push('/s2a')} />
    </View> : null} /></AppScreen>;
}
