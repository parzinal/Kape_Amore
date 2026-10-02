import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { authApi } from "./authApi";

function destinationFor(user: { roles: string[] }): string {
  return user.roles.includes("admin") ? "/admin" : "/account";
}

function AuthShell({ children, title, subtitle }: {
  children: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <aside className="auth-art" aria-label="Kape Amore coffee and café">
          <img className="auth-art-logo" src="/images/kape-amore-logo.png" alt="Kape Amore logo" />
          <p className="auth-art-title">Find your<br /><strong>coffee moment.</strong></p>
          <p className="auth-art-copy">A good cup to accompany your day.</p>
          <span>COFFEE · FOOD · GOOD VIBES</span>
          <i className="auth-art-bean" aria-hidden="true" />
        </aside>
        <section className="auth-panel" aria-labelledby="auth-title">
          <Link className="auth-brand" to="/" aria-label="Kape Amore home">KAPE <em>AMORE</em></Link>
          <p className="auth-eyebrow">WELCOME BACK</p>
          <h1 id="auth-title">{title}</h1>
          <p className="auth-subtitle">{subtitle}</p>
          {children}
          <Link className="auth-back" to="/">← Back to Kape Amore</Link>
        </section>
      </div>
    </main>
  );
}

function useFormError() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return { error, setError, busy, setBusy };
}

function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  minLength,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <span className="auth-password-field">
      <input
        id={id}
        autoComplete={autoComplete}
        minLength={minLength}
        onChange={(event) => onChange(event.target.value)}
        required
        type={visible ? "text" : "password"}
        value={value}
      />
      <button
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="auth-password-toggle"
        onClick={() => setVisible((isVisible) => !isVisible)}
        type="button"
      >
        {visible ? (
          <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
            <path d="M3 3l18 18M10.6 10.7a2 2 0 002.7 2.7M9.9 5.2A10.8 10.8 0 0112 5c5.2 0 9 4.4 10 7-.3 1-1.2 2.4-2.5 3.6M6.2 6.3C3.9 7.7 2.4 9.9 2 12c.5 1.6 3.3 7 10 7 1.2 0 2.3-.2 3.3-.6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
          </svg>
        ) : (
          <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
          </svg>
        )}
      </button>
    </span>
  );
}

export function LoginPage() {
  const { user, status, error: serviceError, signIn, refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const { error, setError, busy, setBusy } = useFormError();

  if (status === "signed-in" && user) return <Navigate to={destinationFor(user)} replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const authenticatedUser = await signIn(email.trim(), password, remember);
      navigate(destinationFor(authenticatedUser), { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Welcome back." subtitle="Sign in to continue to your Kape Amore account.">
      {status === "error" && (
        <div className="auth-notice" role="alert">
          <span>We can’t connect to the account service. Make sure Laravel is running, then try again.</span>
          {serviceError && <span className="auth-notice-detail">{serviceError}</span>}
          <button type="button" onClick={() => void refresh()}>Try again</button>
        </div>
      )}
      <form className="auth-form" onSubmit={submit}>
        <label htmlFor="login-email">Email address</label>
        <input id="login-email" autoComplete="email" inputMode="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />

        <label htmlFor="login-password">Password</label>
        <PasswordInput id="login-password" autoComplete="current-password" onChange={setPassword} value={password} />
        <Link className="auth-forgot-link" to="/forgot-password">Forgot password?</Link>

        <label className="auth-check">
          <input checked={remember} onChange={(event) => setRemember(event.target.checked)} type="checkbox" />
          <span>Keep me signed in</span>
        </label>
        {(location.state as { notice?: string } | null)?.notice && (
          <p className="auth-success" role="status">{(location.state as { notice: string }).notice}</p>
        )}
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-submit" disabled={busy} type="submit">{busy ? "Signing in…" : "Sign in"} <span aria-hidden="true">→</span></button>
      </form>
      <p className="auth-switch">New to Kape Amore? <Link to="/register">Create an account</Link></p>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const { error, setError, busy, setBusy } = useFormError();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const newUser = await signUp(name.trim(), email.trim(), password, confirmation);
      navigate(destinationFor(newUser), { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Account creation failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Make yourself at home." subtitle="Create an account to keep your Kape Amore details in one place.">
      <form className="auth-form" onSubmit={submit}>
        <label htmlFor="register-name">Full name</label>
        <input id="register-name" autoComplete="name" maxLength={150} onChange={(event) => setName(event.target.value)} required value={name} />
        <label htmlFor="register-email">Email address</label>
        <input id="register-email" autoComplete="email" inputMode="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
        <label htmlFor="register-password">Password</label>
        <PasswordInput id="register-password" autoComplete="new-password" minLength={12} onChange={setPassword} value={password} />
        <p className="auth-hint">Use at least 12 characters. A password manager is a good idea.</p>
        <label htmlFor="register-confirmation">Confirm password</label>
        <PasswordInput id="register-confirmation" autoComplete="new-password" onChange={setConfirmation} value={confirmation} />
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-submit" disabled={busy} type="submit">{busy ? "Creating account…" : "Create account"} <span aria-hidden="true">→</span></button>
        <p className="auth-terms">Account creation is for customer accounts. Staff and admin access is managed separately.</p>
      </form>
      <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const { error, setError, busy, setBusy } = useFormError();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      setMessage(await authApi.sendPasswordReset(email.trim()));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to request a password reset.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Let’s get you back in." subtitle="Enter the email linked to your account and we’ll send reset instructions.">
      <form className="auth-form" onSubmit={submit}>
        <label htmlFor="forgot-email">Email address</label>
        <input id="forgot-email" autoComplete="email" inputMode="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
        {message && <p className="auth-success" role="status">{message}</p>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-submit" disabled={busy} type="submit">{busy ? "Sending…" : "Send reset link"} <span aria-hidden="true">→</span></button>
      </form>
      <p className="auth-switch">Remembered it? <Link to="/login">Back to sign in</Link></p>
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const [email, setEmail] = useState(query.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const { error, setError, busy, setBusy } = useFormError();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await authApi.resetPassword({
        token: query.get("token") ?? "",
        email: email.trim(),
        password,
        passwordConfirmation: confirmation,
      });
      navigate("/login", { replace: true, state: { notice: "Password updated. Please sign in." } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to reset your password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Choose a new password." subtitle="Create a new password for your Kape Amore account.">
      <form className="auth-form" onSubmit={submit}>
        <label htmlFor="reset-email">Email address</label>
        <input id="reset-email" autoComplete="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
        <label htmlFor="reset-password">New password</label>
        <PasswordInput id="reset-password" autoComplete="new-password" minLength={12} onChange={setPassword} value={password} />
        <label htmlFor="reset-confirmation">Confirm new password</label>
        <PasswordInput id="reset-confirmation" autoComplete="new-password" onChange={setConfirmation} value={confirmation} />
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-submit" disabled={busy} type="submit">{busy ? "Updating…" : "Update password"} <span aria-hidden="true">→</span></button>
      </form>
    </AuthShell>
  );
}

export function AdminPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  async function logout() {
    setError(null);
    try {
      await signOut();
      navigate("/", { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign out.");
    }
  }

  return (
    <main className="account-page admin-page">
      <header className="account-header">
        <Link className="account-brand" to="/"><img src="/images/kape-amore-logo.png" alt="" /> KAPE AMORE <span>ADMIN</span></Link>
        <button className="account-signout" onClick={() => void logout()} type="button">Sign out</button>
      </header>
      <section className="account-card">
        <p className="auth-eyebrow">STAFF WORKSPACE</p>
        <h1>Welcome, {user?.name}.</h1>
        <p>This protected area is reserved for accounts with the admin role.</p>
        {error && <p className="auth-error" role="alert">{error}</p>}
      </section>
    </main>
  );
}
