import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useStorage } from '../storage/context';
import { ChapterReader } from '../reader/ChapterReader';

export default function Reader() {
  const params = useLocalSearchParams<{ chapter?: string | string[] }>();
  const chapterId = typeof params.chapter === 'string' ? params.chapter : '';
  const [attempt, setAttempt] = useState(0);
  const storage = useStorage();
  return <ChapterReader key={`${chapterId}:${attempt}`} {...storage} chapterId={chapterId}
    onRetry={() => setAttempt((value) => value + 1)} onNavigate={(destination, story) => {
      if (destination) router.replace({ pathname: '/reader', params: { chapter: destination } });
      else if (story) router.replace({ pathname: '/story', params: { story } });
      else router.replace('/');
    }} />;
}
