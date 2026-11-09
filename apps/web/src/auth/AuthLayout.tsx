import type { ReactNode } from 'react';
import './auth-layout.css';
import './auth-controls.css';

interface AuthLayoutProps {
  title: string;
  description: string;
  children: ReactNode;
}

export const AuthLayout = ({ title, description, children }: AuthLayoutProps) => (
  <main className="auth-page">
    <div className="auth-wrap">
      <section className="auth-card">
        <div className="auth-brand">
          <span className="auth-logo" aria-hidden="true">
            <img src="/orange.svg" alt="" />
          </span>
          <span>HUB</span>
        </div>
        <header className="auth-heading">
          <h1>{title}</h1>
          <p>{description}</p>
        </header>
        {children}
      </section>
      <footer className="auth-footer">© 2026 HUB</footer>
    </div>
  </main>
);