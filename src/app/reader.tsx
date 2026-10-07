import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useStorage } from '../storage/context';
import { ChapterReader } from '../reader/ChapterReader';
import { ReadCompletion } from '../reader/read-state';

export default function Reader() {
  const params = useLocalSearchParams<{ chapter?: string | string[] }>();
  const chapterId = typeof params.chapter === 'string' ? params.chapter : '';
  return <ReaderChapter key={chapterId} chapterId={chapterId} />;
}

function ReaderChapter({ chapterId }: { chapterId: string }) {
  const [attempt, setAttempt] = useState(0);
  const storage = useStorage();
  const [readCompletion] = useState(() => new ReadCompletion(() => storage.repository.markChapterRead(chapterId)));
  return <ChapterReader key={`${chapterId}:${attempt}`} {...storage} chapterId={chapterId}
    readCompletion={readCompletion}
    onRetry={() => setAttempt((value) => value + 1)} onNavigate={(destination, story) => {
      if (destination) router.replace({ pathname: '/reader', params: { chapter: destination } });
      else if (story) router.replace({ pathname: '/story', params: { story } });
      else router.replace('/');
    }} />;
}
