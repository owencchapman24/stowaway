import { screen } from '@testing-library/react-native';

/** Capture the real callback, so invoking it later also tests imperative guards. */
export function retainedPress(label: string): () => void {
  let node: ReturnType<typeof screen.getByLabelText> | null = screen.getByLabelText(label);
  while (node) {
    if (typeof node.props.onPress === 'function') return node.props.onPress;
    node = node.parent;
  }
  throw new Error('No press handler for ' + label);
}
