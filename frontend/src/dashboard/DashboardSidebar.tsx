import { Link, NavLink } from "react-router-dom";
import type { AuthUser } from "../auth/authApi";
import { tw } from "../tw";

export type DashboardNavItem = {
  label: string;
  to: string;
  icon: "overview" | "orders" | "rewards" | "profile" | "menu" | "tables" | "delivery" | "customers" | "team" | "reports" | "settings";
};

type DashboardSidebarProps = {
  user: AuthUser;
  items: DashboardNavItem[];
  onSignOut: () => void;
  sectionLabel?: string;
  userSubtitle?: string;
  showMenuCallout?: boolean;
  showSidebarUser?: boolean;
};

const iconPaths: Record<DashboardNavItem["icon"], string> = {
  overview: "M3 3h7v7H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 14h7v7H3z",
  orders: "M5 4h14v17H5zM8 8h8M8 12h8M8 16h5",
  rewards: "M12 3l2.2 5.1 5.5.5-4.2 3.6 1.3 5.4L12 14.7l-4.8 2.9 1.3-5.4-4.2-3.6 5.5-.5z",
  profile: "M20 21a8 8 0 00-16 0M12 12a4 4 0 100-8 4 4 0 000 8z",
  menu: "M4 6h16M4 12h16M4 18h16",
  tables: "M3 9h18v9H3zM6 9V6h12v3M6 18v2M18 18v2",
  delivery: "M3 6h11v11H3zM14 10h4l3 3v4h-7zM7 20a2 2 0 100-4 2 2 0 000 4zM18 20a2 2 0 100-4 2 2 0 000 4z",
  customers: "M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M10 11a4 4 0 100-8 4 4 0 000 8zM20 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8",
  team: "M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M10 11a4 4 0 100-8 4 4 0 000 8zM18 8v6M21 11h-6",
  reports: "M4 19V5M4 19h17M8 15l4-4 3 3 5-6",
  settings: "M12 8a4 4 0 100 8 4 4 0 000-8zM19.4 15a1.7 1.7 0 00.3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5v.2h-2.6v-.2a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.9.3l-.1.1-1.8-1.8.1-.1A1.7 1.7 0 008 15a1.7 1.7 0 00-1.5-1H6.3v-2.6h.2a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 001.9.3 1.7 1.7 0 001-1.5v-.2H15v.2a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 00-.3 1.9 1.7 1.7 0 001.5 1h.2v2.6h-.2a1.7 1.7 0 00-1.5 1z",
};

export function DashboardSidebar({
  user,
  items,
  onSignOut,
  sectionLabel = "YOUR SPACE",
  userSubtitle = "Customer account",
  showMenuCallout = true,
  showSidebarUser = true,
}: DashboardSidebarProps) {
  const initials = user.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <aside className={tw("dashboard-sidebar")} aria-label="Dashboard sidebar">
      <Link className={tw("dashboard-brand")} to="/" aria-label="Kape Amore home">
        <img className={tw("dashboard-brand-img")} src="/images/kape-amore-logo.png" alt="" />
        <span className={tw("dashboard-brand-text")}>KAPE <em className={tw("dashboard-brand-accent")}>AMORE</em></span>
      </Link>

      <p className={tw("dashboard-nav-label")}>{sectionLabel}</p>
      <nav className={tw("dashboard-nav")} aria-label={`${sectionLabel.toLowerCase()} navigation`}>
        {items.map((item) => (
          <NavLink
            className={({ isActive }) => tw(`dashboard-nav-link ${isActive ? "dashboard-nav-link-active" : ""}`)}
            end={item.to === "/account" || item.to === "/admin"}
            key={item.to}
            to={item.to}
          >
            <svg className={tw("dashboard-nav-icon")} aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <path d={iconPaths[item.icon]} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
            </svg>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {showMenuCallout && (
        <Link className={tw("dashboard-sidebar-order")} to="/#menu">
          <span className={tw("dashboard-sidebar-order-copy")}>Something good is brewing.</span>
          <strong className={tw("dashboard-sidebar-order-cta")}>Browse the menu <span aria-hidden="true">→</span></strong>
        </Link>
      )}

      {showSidebarUser && (
        <div className={tw("dashboard-sidebar-user")}>
          <span className={tw("dashboard-avatar")} aria-hidden="true">{initials || "KA"}</span>
          <span className={tw("dashboard-user-copy")}>
            <strong className={tw("dashboard-user-name")}>{user.name}</strong>
            <span className={tw("dashboard-user-subtitle")}>{userSubtitle}</span>
          </span>
          <button aria-label="Sign out" className={tw("dashboard-signout-icon")} onClick={onSignOut} title="Sign out" type="button">
            <svg className={tw("dashboard-signout-svg")} aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
            </svg>
          </button>
        </div>
      )}
    </aside>
  );
}
