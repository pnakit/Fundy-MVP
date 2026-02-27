import { useState } from 'react';

const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD || 'fundy2026';

export default function PasswordScreen({ onAuthenticated }) {
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (passwordInput === APP_PASSWORD) {
      sessionStorage.setItem('fundy_authenticated', 'true');
      onAuthenticated();
    } else {
      setPasswordError('Incorrect password');
    }
  };

  return (
    <div className="password-screen">
      <form className="password-box" onSubmit={handleSubmit}>
        <div className="logo-mark">S</div>
        <h2>Startup Evaluator</h2>
        <p>Enter the password to continue</p>
        <input
          type="password"
          className={`password-input${passwordError ? ' error' : ''}`}
          placeholder="Password"
          value={passwordInput}
          onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(''); }}
          autoFocus
        />
        <div className="password-error">{passwordError}</div>
        <button type="submit" className="password-submit">Enter</button>
      </form>
    </div>
  );
}
