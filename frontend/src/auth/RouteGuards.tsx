import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { tw } from "../tw";

export function RequireAuth({ children, role, permission, excludeRole }: { children: ReactNode; role?: string | string[]; permission?: string; excludeRole?: string }) {
  const { user, status, error, refresh } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <main className={tw("route-state")} role="status">Checking your account…</main>;
  }

  if (status === "error") {
    return (
      <main className={tw("route-state")} role="alert">
        <p>We couldn’t verify your sign-in, so this page stays locked.</p>
        <p>{error}</p>
        <button className={tw("auth-submit")} onClick={() => void refresh()} type="button">Try again</button>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const hasAllowedRole = role && (Array.isArray(role) ? role.some((allowedRole) => user.roles.includes(allowedRole)) : user.roles.includes(role));
  const isAdmin = user.roles.includes("admin");
  if (permission && !isAdmin && !user.permissions.includes(permission)) {
    return <Navigate to="/account" replace />;
  }
  if (!permission && role && !hasAllowedRole && !isAdmin) {
    return <Navigate to="/account" replace />;
  }

  if (excludeRole && user.roles.includes(excludeRole)) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}
