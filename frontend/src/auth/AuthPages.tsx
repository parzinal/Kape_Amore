import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { authApi } from "./authApi";
import { tw } from "../tw";

function destinationFor(user: { roles: string[]; permissions: string[] }): string {
  return user.roles.includes("admin") || user.permissions.includes("dashboard.view") ? "/admin" : "/account";
}

function AuthShell({ children, title, subtitle }: {
  children: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <main className={tw("auth-page")}>
      <div className={tw("auth-card")}>
        <aside className={tw("auth-art")} aria-label="Kape Amore coffee and café">
          <img className={tw("auth-art-logo")} src="/images/kape-amore-logo.png" alt="Kape Amore logo" />
          <p className={tw("auth-art-title")}>Find your<br /><strong>coffee moment.</strong></p>
          <p className={tw("auth-art-copy")}>A good cup to accompany your day.</p>
          <span className={tw("auth-art-tagline")}>COFFEE · FOOD · GOOD VIBES</span>
          <i className={tw("auth-art-bean")} aria-hidden="true" />
        </aside>
        <section className={tw("auth-panel")} aria-labelledby="auth-title">
          <div className={tw("auth-panel-content")}>
            <Link className={tw("auth-brand")} to="/" aria-label="Kape Amore home">KAPE <em className={tw("auth-brand-accent")}>AMORE</em></Link>
            <p className={tw("auth-eyebrow")}>WELCOME BACK</p>
            <h1 className={tw("auth-panel-title")} id="auth-title">{title}</h1>
            <p className={tw("auth-subtitle")}>{subtitle}</p>
            {children}
            <Link className={tw("auth-back")} to="/">← Back to Kape Amore</Link>
          </div>
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
  return (
    <span className={tw("auth-password-field")}>
      <input
        className={tw("auth-password-input")}
        id={id}
        autoComplete={autoComplete}
        minLength={minLength}
        onChange={(event) => onChange(event.target.value)}
        required
        type="password"
        value={value}
      />
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
        <div className={tw("auth-notice")} role="alert">
          <span>The account service is currently unavailable.</span>
          {serviceError && <span className={tw("auth-notice-detail")}>{serviceError}</span>}
          <button className={tw("auth-notice-button")} type="button" onClick={() => void refresh()}>Try again</button>
        </div>
      )}
      <form className={tw("auth-form")} onSubmit={submit}>
        <label className={tw("auth-field-label")} htmlFor="login-email">Email address</label>
        <input className={tw("auth-input")} id="login-email" autoComplete="email" inputMode="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />

        <div className={tw("auth-password-row")}>
          <label htmlFor="login-password">Password</label>
        </div>
        <PasswordInput id="login-password" autoComplete="current-password" onChange={setPassword} value={password} />
        <Link className={tw("auth-forgot-link")} to="/forgot-password">Forgot password?</Link>

        <label className={tw("auth-check")}>
          <input checked={remember} onChange={(event) => setRemember(event.target.checked)} type="checkbox" />
          <span>Keep me signed in</span>
        </label>
        {(location.state as { notice?: string } | null)?.notice && (
          <p className={tw("auth-success")} role="status">{(location.state as { notice: string }).notice}</p>
        )}
        {error && <p className={tw("auth-error")} role="alert">{error}</p>}
        <button className={tw("auth-submit")} disabled={busy} type="submit">
          <span>{busy ? "Signing in…" : "Sign in"}</span>
          <span aria-hidden="true">→</span>
        </button>
      </form>
      <p className={tw("auth-switch")}>New to Kape Amore? <Link className={tw("auth-switch-link")} to="/register">Create an account</Link></p>
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
      <form className={tw("auth-form")} onSubmit={submit}>
        <label className={tw("auth-field-label")} htmlFor="register-name">Full name</label>
        <input className={tw("auth-input")} id="register-name" autoComplete="name" maxLength={150} onChange={(event) => setName(event.target.value)} required value={name} />
        <label className={tw("auth-field-label")} htmlFor="register-email">Email address</label>
        <input className={tw("auth-input")} id="register-email" autoComplete="email" inputMode="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
        <label className={tw("auth-field-label")} htmlFor="register-password">Password</label>
        <PasswordInput id="register-password" autoComplete="new-password" minLength={12} onChange={setPassword} value={password} />
        <p className={tw("auth-hint")}>Use at least 12 characters. A password manager is a good idea.</p>
        <label className={tw("auth-field-label")} htmlFor="register-confirmation">Confirm password</label>
        <PasswordInput id="register-confirmation" autoComplete="new-password" onChange={setConfirmation} value={confirmation} />
        {error && <p className={tw("auth-error")} role="alert">{error}</p>}
        <button className={tw("auth-submit")} disabled={busy} type="submit">{busy ? "Creating account…" : "Create account"} <span aria-hidden="true">→</span></button>
        <p className={tw("auth-terms")}>Account creation is for customer accounts. Staff and admin access is managed separately.</p>
      </form>
      <p className={tw("auth-switch")}>Already have an account? <Link className={tw("auth-switch-link")} to="/login">Sign in</Link></p>
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
      <form className={tw("auth-form")} onSubmit={submit}>
        <label className={tw("auth-field-label")} htmlFor="forgot-email">Email address</label>
        <input className={tw("auth-input")} id="forgot-email" autoComplete="email" inputMode="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
        {message && <p className={tw("auth-success")} role="status">{message}</p>}
        {error && <p className={tw("auth-error")} role="alert">{error}</p>}
        <button className={tw("auth-submit")} disabled={busy} type="submit">{busy ? "Sending…" : "Send reset link"} <span aria-hidden="true">→</span></button>
      </form>
      <p className={tw("auth-switch")}>Remembered it? <Link className={tw("auth-switch-link")} to="/login">Back to sign in</Link></p>
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
      <form className={tw("auth-form")} onSubmit={submit}>
        <label className={tw("auth-field-label")} htmlFor="reset-email">Email address</label>
        <input className={tw("auth-input")} id="reset-email" autoComplete="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
        <label className={tw("auth-field-label")} htmlFor="reset-password">New password</label>
        <PasswordInput id="reset-password" autoComplete="new-password" minLength={12} onChange={setPassword} value={password} />
        <label className={tw("auth-field-label")} htmlFor="reset-confirmation">Confirm new password</label>
        <PasswordInput id="reset-confirmation" autoComplete="new-password" onChange={setConfirmation} value={confirmation} />
        {error && <p className={tw("auth-error")} role="alert">{error}</p>}
        <button className={tw("auth-submit")} disabled={busy} type="submit">{busy ? "Updating…" : "Update password"} <span aria-hidden="true">→</span></button>
      </form>
    </AuthShell>
  );
}
