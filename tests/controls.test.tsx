import { fireEvent, render } from '@testing-library/react-native';
import { ReaderControls } from '../src/reader/controls';

test('accessible typography controls expose bounds and light/dark selection', () => {
  const onChange = jest.fn();
  const screen = render(<ReaderControls preferences={{ theme: 'light', fontSize: 32 }} disabled={false} onChange={onChange} />);
  expect(screen.getByLabelText('Increase reading font size')).toBeDisabled();
  fireEvent.press(screen.getByLabelText('Decrease reading font size'));
  expect(onChange).toHaveBeenCalledWith({ theme: 'light', fontSize: 30 });
  fireEvent.press(screen.getByLabelText('Use dark reading theme'));
  expect(onChange).toHaveBeenCalledWith({ theme: 'dark', fontSize: 32 });
  screen.rerender(<ReaderControls preferences={{ theme: 'dark', fontSize: 14 }} disabled onChange={onChange} />);
  expect(screen.getByLabelText('Decrease reading font size')).toBeDisabled();
  expect(screen.getByLabelText('Use light reading theme')).toBeDisabled();
});
