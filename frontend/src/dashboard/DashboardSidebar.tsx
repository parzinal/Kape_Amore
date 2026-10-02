import { Link, NavLink } from "react-router-dom";
import type { AuthUser } from "../auth/authApi";

export type DashboardNavItem = {
  label: string;
  to: string;
  icon: "overview" | "orders" | "rewards" | "profile";
};

type DashboardSidebarProps = {
  user: AuthUser;
  items: DashboardNavItem[];
  onSignOut: () => void;
};

const iconPaths: Record<DashboardNavItem["icon"], string> = {
  overview: "M3 3h7v7H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 14h7v7H3z",
  orders: "M5 4h14v17H5zM8 8h8M8 12h8M8 16h5",
  rewards: "M12 3l2.2 5.1 5.5.5-4.2 3.6 1.3 5.4L12 14.7l-4.8 2.9 1.3-5.4-4.2-3.6 5.5-.5z",
  profile: "M20 21a8 8 0 00-16 0M12 12a4 4 0 100-8 4 4 0 000 8z",
};

export function DashboardSidebar({ user, items, onSignOut }: DashboardSidebarProps) {
  const initials = user.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <aside className="dashboard-sidebar" aria-label="Account sidebar">
      <Link className="dashboard-brand" to="/" aria-label="Kape Amore home">
        <img src="/images/kape-amore-logo.png" alt="" />
        <span>KAPE <em>AMORE</em></span>
      </Link>

      <p className="dashboard-nav-label">YOUR SPACE</p>
      <nav className="dashboard-nav" aria-label="Account navigation">
        {items.map((item) => (
          <NavLink
            className={({ isActive }) => `dashboard-nav-link${isActive ? " is-active" : ""}`}
            end={item.to === "/account"}
            key={item.to}
            to={item.to}
          >
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <path d={iconPaths[item.icon]} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
            </svg>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <Link className="dashboard-sidebar-order" to="/#menu">
        <span>Something good is brewing.</span>
        <strong>Browse the menu <span aria-hidden="true">→</span></strong>
      </Link>

      <div className="dashboard-sidebar-user">
        <span className="dashboard-avatar" aria-hidden="true">{initials || "KA"}</span>
        <span className="dashboard-user-copy">
          <strong>{user.name}</strong>
          <span>Customer account</span>
        </span>
        <button aria-label="Sign out" className="dashboard-signout-icon" onClick={onSignOut} title="Sign out" type="button">
          <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
            <path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
