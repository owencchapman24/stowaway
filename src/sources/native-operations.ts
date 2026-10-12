import { BUILD_AUDIENCE } from '../config/build-audience';
import { importNativeStory, updateNativeStory } from '../importing/native';
import { downloadNativeImages } from '../images/native';
import { cleanupNativeStoryFiles, manageNativeStory } from '../storage/management-native';
import { createSourceOperations } from './operations';

export const sourceOperations = createSourceOperations(BUILD_AUDIENCE, {
  importStory: importNativeStory, updateStory: updateNativeStory, downloadImages: downloadNativeImages,
  manageStory: manageNativeStory, cleanupStoryFiles: cleanupNativeStoryFiles,
});
// S1 retains its independent native development + audience guards.
export { runNativeDiagnostic } from './spacebattles/native';
export { USER_AGENT } from './spacebattles/request';
