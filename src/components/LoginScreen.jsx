import { useState } from 'react';
import { signInWithOtp, verifyOtp, signInWithPassword } from '../api/dataAccess';

export default function LoginScreen({ onAuthenticated }) {
  const [step, setStep] = useState('email'); // 'email' | 'otp'
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

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

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    setError('');
    try {
      await signInWithPassword(
        import.meta.env.VITE_DEMO_USER_EMAIL,
        import.meta.env.VITE_DEMO_USER_PASSWORD,
      );
      onAuthenticated();
    } catch (err) {
      setError(err.message || 'Demo login failed');
    } finally {
      setDemoLoading(false);
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
        <h2>Fundy MVP</h2>
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
        {import.meta.env.VITE_DEMO_USER_EMAIL && (
          <>
            <div className="login-divider">or</div>
            <button
              type="button"
              className="demo-login-btn"
              onClick={handleDemoLogin}
              disabled={demoLoading || loading}
            >
              {demoLoading ? 'Loading demo...' : 'Try Demo'}
            </button>
            <p className="demo-login-note">Explore with a pre-populated startup profile</p>
          </>
        )}
      </form>
    </div>
  );
}
