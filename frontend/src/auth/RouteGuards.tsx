import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function RequireAuth({ children, role, excludeRole }: { children: ReactNode; role?: string; excludeRole?: string }) {
  const { user, status, error, refresh } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <main className="route-state" role="status">Checking your account…</main>;
  }

  if (status === "error") {
    return (
      <main className="route-state" role="alert">
        <p>We couldn’t verify your sign-in, so this page stays locked.</p>
        <p>{error}</p>
        <button className="auth-submit" onClick={() => void refresh()} type="button">Try again</button>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (role && !user.roles.includes(role)) {
    return <Navigate to="/account" replace />;
  }

  if (excludeRole && user.roles.includes(excludeRole)) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}
