import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClaimDialog } from '../src/onboarding/ClaimDialog.js';
describe('commander identity conversation', () => {
  it('explains the public name first, then asks for a way to return to that commander', () => {
    render(<ClaimDialog planetName="Aurora" introduction="Training progress stays in the Academy." onClaim={vi.fn().mockResolvedValue(undefined)} onSignIn={vi.fn()} />);
    expect(screen.getByText(/Other players will know you by this name/)).toBeVisible();
    expect(screen.queryByText('Training progress stays in the Academy.')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Commander name'), { target: { value: 'Northstar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue with this name' }));
    expect(screen.getByText(/return to this commander later or from another device/)).toBeVisible();
    expect(screen.getByRole('heading')).toHaveTextContent('Northstar');
    expect(screen.queryByRole('textbox', { name: 'Commander name' })).not.toBeInTheDocument();
    expect(document.querySelector('input[autocomplete="username"]')).toHaveValue('Northstar');
    expect(screen.getByText('Training progress stays in the Academy.')).toBeVisible();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });
});
