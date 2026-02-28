import { useState } from 'react';
import { signInWithOtp, verifyOtp } from '../api/dataAccess';

export default function LoginScreen({ onAuthenticated }) {
  const [step, setStep] = useState('email'); // 'email' | 'otp'
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Please enter your email');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signInWithOtp(trimmed);
      setStep('otp');
    } catch (err) {
      setError(err.message || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    const trimmed = otpCode.trim();
    if (!trimmed) {
      setError('Please enter the verification code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await verifyOtp(email.trim(), trimmed);
      onAuthenticated();
    } catch (err) {
      setError(err.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep('email');
    setOtpCode('');
    setError('');
  };

  if (step === 'otp') {
    return (
      <div className="password-screen">
        <form className="password-box" onSubmit={handleOtpSubmit}>
          <div className="logo-mark">S</div>
          <h2>Check your email</h2>
          <p>
            We sent a verification code to<br />
            <strong style={{ color: '#e8e8ed' }}>{email.trim()}</strong>
          </p>
          <input
            type="text"
            className={`password-input${error ? ' error' : ''}`}
            placeholder="Enter 8-digit code"
            value={otpCode}
            onChange={(e) => { setOtpCode(e.target.value); setError(''); }}
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
          />
          <div className="password-error">{error}</div>
          <button type="submit" className="password-submit" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify'}
          </button>
          <button type="button" className="login-back-btn" onClick={handleBack}>
            Use a different email
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="password-screen">
      <form className="password-box" onSubmit={handleEmailSubmit}>
        <div className="logo-mark">S</div>
        <h2>Startup Evaluator</h2>
        <p>Enter your email to get started</p>
        <input
          type="email"
          className={`password-input${error ? ' error' : ''}`}
          placeholder="you@company.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(''); }}
          autoFocus
          autoComplete="email"
        />
        <div className="password-error">{error}</div>
        <button type="submit" className="password-submit" disabled={loading}>
          {loading ? 'Sending code...' : 'Continue with email'}
        </button>
      </form>
    </div>
  );
}
