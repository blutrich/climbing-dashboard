import React, { useState } from 'react';

interface EmailLoginProps {
  onSubmit: (email: string) => void;
  error: string | null;
}

const EmailLogin: React.FC<EmailLoginProps> = ({ onSubmit, error }) => {
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(email);
  };

  return (
    <div className="email-login">
      <form onSubmit={handleSubmit}>
        <div className="control-group">
          <label htmlFor="email">Enter your email to access your data</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            className="email-input"
          />
        </div>
        {error && <div className="error-message">{error}</div>}
        <button type="submit" className="submit-btn">
          Access Dashboard
        </button>
      </form>
    </div>
  );
};

export default EmailLogin; 