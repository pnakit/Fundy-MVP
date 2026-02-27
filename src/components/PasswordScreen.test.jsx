import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import PasswordScreen from './PasswordScreen';

afterEach(cleanup);

describe('PasswordScreen', () => {
  it('renders the password form', () => {
    render(<PasswordScreen onAuthenticated={() => {}} />);

    expect(screen.getByText('Startup Evaluator')).toBeInTheDocument();
    expect(screen.getByText('Enter the password to continue')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enter' })).toBeInTheDocument();
  });

  it('shows error on incorrect password', () => {
    render(<PasswordScreen onAuthenticated={() => {}} />);

    const input = screen.getByPlaceholderText('Password');
    const button = screen.getByRole('button', { name: 'Enter' });

    fireEvent.change(input, { target: { value: 'wrongpassword' } });
    fireEvent.click(button);

    expect(screen.getByText('Incorrect password')).toBeInTheDocument();
  });

  it('calls onAuthenticated on correct password', () => {
    const onAuth = vi.fn();
    render(<PasswordScreen onAuthenticated={onAuth} />);

    const input = screen.getByPlaceholderText('Password');
    const button = screen.getByRole('button', { name: 'Enter' });

    fireEvent.change(input, { target: { value: 'fundy2026' } });
    fireEvent.click(button);

    expect(onAuth).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Incorrect password')).not.toBeInTheDocument();
  });

  it('clears error when user types after failed attempt', () => {
    render(<PasswordScreen onAuthenticated={() => {}} />);

    const input = screen.getByPlaceholderText('Password');
    const button = screen.getByRole('button', { name: 'Enter' });

    fireEvent.change(input, { target: { value: 'wrong' } });
    fireEvent.click(button);
    expect(screen.getByText('Incorrect password')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'w' } });
    expect(screen.queryByText('Incorrect password')).not.toBeInTheDocument();
  });

  it('submits on form submit', () => {
    const onAuth = vi.fn();
    render(<PasswordScreen onAuthenticated={onAuth} />);

    const input = screen.getByPlaceholderText('Password');

    fireEvent.change(input, { target: { value: 'fundy2026' } });
    fireEvent.submit(input.closest('form'));

    expect(onAuth).toHaveBeenCalledTimes(1);
  });
});
