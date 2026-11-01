import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ToastProvider, useSilenceToasts, useToast } from '../src/ui/Toast.js';

function Exercise() {
  useSilenceToasts(true);
  const say = useToast();
  return <><button onClick={() => { say('Collection complete'); }}>Collect</button><button onClick={() => { say('Not enough fuel', 'error'); }}>Fail</button></>;
}
describe('training feedback', () => {
  it('keeps success toasts out of the dialogue while still explaining refusals', () => {
    render(<ToastProvider><Exercise /></ToastProvider>);
    fireEvent.click(screen.getByText('Collect'));
    expect(screen.queryByText('Collection complete')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Fail'));
    expect(screen.getByText('Not enough fuel')).toBeVisible();
  });
});
