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
      <section className="auth-panel" aria-labelledby="auth-title">
        <Link className="auth-brand" to="/" aria-label="Kape Amore home">
          <img src="/images/kape-amore-logo.png" alt="" />
          <span>KAPE <em>AMORE</em></span>
        </Link>
        <p className="auth-eyebrow">WELCOME TO KAPE AMORE</p>
        <h1 id="auth-title">{title}</h1>
        <p className="auth-subtitle">{subtitle}</p>
        {children}
        <Link className="auth-back" to="/">← Back to Kape Amore</Link>
      </section>
      <aside className="auth-image" aria-label="Coffee being prepared in a café">
        <div className="auth-image-shade" />
        <p>Good coffee.<br />A place to <em>belong.</em></p>
        <span>COFFEE · FOOD · GOOD VIBES</span>
      </aside>
    </main>
  );
}

function useFormError() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return { error, setError, busy, setBusy };
}

export function LoginPage() {
  const { user, status, signIn, refresh } = useAuth();
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
          <span>The account service is currently unavailable.</span>
          <button type="button" onClick={() => void refresh()}>Try again</button>
        </div>
      )}
      <form className="auth-form" onSubmit={submit}>
        <label htmlFor="login-email">Email address</label>
        <input id="login-email" autoComplete="email" inputMode="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />

        <div className="auth-label-row">
          <label htmlFor="login-password">Password</label>
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
        <input id="login-password" autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />

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
        <input id="register-password" autoComplete="new-password" minLength={12} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
        <p className="auth-hint">Use at least 12 characters. A password manager is a good idea.</p>
        <label htmlFor="register-confirmation">Confirm password</label>
        <input id="register-confirmation" autoComplete="new-password" onChange={(event) => setConfirmation(event.target.value)} required type="password" value={confirmation} />
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
        <input id="reset-password" autoComplete="new-password" minLength={12} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
        <label htmlFor="reset-confirmation">Confirm new password</label>
        <input id="reset-confirmation" autoComplete="new-password" onChange={(event) => setConfirmation(event.target.value)} required type="password" value={confirmation} />
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-submit" disabled={busy} type="submit">{busy ? "Updating…" : "Update password"} <span aria-hidden="true">→</span></button>
      </form>
    </AuthShell>
  );
}

export function AccountPage() {
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
    <main className="account-page">
      <header className="account-header">
        <Link className="account-brand" to="/"><img src="/images/kape-amore-logo.png" alt="" /> KAPE AMORE</Link>
        <button className="account-signout" onClick={() => void logout()} type="button">Sign out</button>
      </header>
      <section className="account-card">
        <p className="auth-eyebrow">YOUR KAPE AMORE ACCOUNT</p>
        <h1>Hello, {user?.name}.</h1>
        <p>You’re signed in as a customer. Your account area is ready for order history and saved details.</p>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <Link className="account-menu-link" to="/#menu">Browse the menu <span aria-hidden="true">→</span></Link>
      </section>
    </main>
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
