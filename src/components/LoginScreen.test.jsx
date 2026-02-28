import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import LoginScreen from './LoginScreen';

// Mock the dataAccess module
vi.mock('../api/dataAccess', () => ({
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
}));

import { signInWithOtp, verifyOtp } from '../api/dataAccess';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('LoginScreen — email step', () => {
  it('renders the email form', () => {
    render(<LoginScreen onAuthenticated={() => {}} />);

    expect(screen.getByText('Startup Evaluator')).toBeInTheDocument();
    expect(screen.getByText('Enter your email to get started')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@company.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with email' })).toBeInTheDocument();
  });

  it('shows error for empty email', () => {
    render(<LoginScreen onAuthenticated={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Continue with email' }));

    expect(screen.getByText('Please enter your email')).toBeInTheDocument();
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it('calls signInWithOtp and advances to OTP step', async () => {
    signInWithOtp.mockResolvedValue();

    render(<LoginScreen onAuthenticated={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText('you@company.com'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue with email' }));

    await waitFor(() => {
      expect(screen.getByText('Check your email')).toBeInTheDocument();
    });

    expect(signInWithOtp).toHaveBeenCalledWith('test@example.com');
    expect(screen.getByPlaceholderText('Enter 8-digit code')).toBeInTheDocument();
  });

  it('shows error when signInWithOtp fails', async () => {
    signInWithOtp.mockRejectedValue(new Error('Rate limit exceeded'));

    render(<LoginScreen onAuthenticated={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText('you@company.com'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue with email' }));

    await waitFor(() => {
      expect(screen.getByText('Rate limit exceeded')).toBeInTheDocument();
    });
  });
});

describe('LoginScreen — OTP step', () => {
  async function goToOtpStep() {
    signInWithOtp.mockResolvedValue();

    render(<LoginScreen onAuthenticated={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText('you@company.com'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue with email' }));

    await waitFor(() => {
      expect(screen.getByText('Check your email')).toBeInTheDocument();
    });
  }

  it('shows error for empty OTP', async () => {
    await goToOtpStep();

    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    expect(screen.getByText('Please enter the verification code')).toBeInTheDocument();
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it('calls verifyOtp and onAuthenticated on valid code', async () => {
    const onAuth = vi.fn();
    signInWithOtp.mockResolvedValue();
    verifyOtp.mockResolvedValue({ session: {}, user: {} });

    render(<LoginScreen onAuthenticated={onAuth} />);

    fireEvent.change(screen.getByPlaceholderText('you@company.com'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue with email' }));

    await waitFor(() => {
      expect(screen.getByText('Check your email')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Enter 8-digit code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => {
      expect(verifyOtp).toHaveBeenCalledWith('test@example.com', '123456');
    });
    expect(onAuth).toHaveBeenCalledTimes(1);
  });

  it('shows error when verifyOtp fails', async () => {
    await goToOtpStep();

    verifyOtp.mockRejectedValue(new Error('Invalid code'));

    fireEvent.change(screen.getByPlaceholderText('Enter 8-digit code'), {
      target: { value: '000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid code')).toBeInTheDocument();
    });
  });

  it('can go back to email step', async () => {
    await goToOtpStep();

    fireEvent.click(screen.getByText('Use a different email'));

    expect(screen.getByText('Startup Evaluator')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@company.com')).toBeInTheDocument();
  });
});
