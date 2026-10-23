import { useState } from 'react';

interface AuthFieldProps {
  id: string;
  label: string;
  type: 'text' | 'email' | 'password';
  value: string;
  placeholder: string;
  autoComplete: string;
  onChange: (value: string) => void;
}

export const AuthField = ({
  id,
  label,
  type,
  value,
  placeholder,
  autoComplete,
  onChange,
}: AuthFieldProps) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <div className="auth-input-wrap">
        <input
          id={id}
          name={id}
          type={isPassword && isPasswordVisible ? 'text' : type}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
          required
        />
        {isPassword && (
          <button
            type="button"
            className="auth-password-toggle"
            aria-label={isPasswordVisible ? 'Скрыть пароль' : 'Показать пароль'}
            aria-pressed={isPasswordVisible}
            onClick={() => setIsPasswordVisible((visible) => !visible)}
          >
            {isPasswordVisible ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5.2 0 8.7 4.5 9.5 6-.3.6-1.3 2-2.9 3.3M6.2 6.2C4.1 7.5 2.8 9.5 2.5 11c.8 1.5 4.3 6 9.5 6 1 0 1.9-.2 2.7-.5" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                <circle cx="12" cy="12" r="2.5" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
};