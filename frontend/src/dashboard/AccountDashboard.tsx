import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { DashboardNavItem } from "./DashboardSidebar";
import { DashboardSidebar } from "./DashboardSidebar";
import { tw } from "../tw";

const navigation: DashboardNavItem[] = [
  { label: "Overview", to: "/account", icon: "overview" },
  { label: "My orders", to: "/account/orders", icon: "orders" },
  { label: "Rewards", to: "/account/rewards", icon: "rewards" },
  { label: "Profile", to: "/account/profile", icon: "profile" },
];

const pageDetails: Record<string, { eyebrow: string; title: string; description: string }> = {
  "/account": {
    eyebrow: "YOUR KAPE AMORE",
    title: "A little moment, just for you.",
    description: "Your coffee life, all in one place.",
  },
  "/account/orders": {
    eyebrow: "ORDER HISTORY",
    title: "Your orders.",
    description: "A look back at your Kape Amore favorites.",
  },
  "/account/rewards": {
    eyebrow: "AMORE REWARDS",
    title: "Good things add up.",
    description: "Your rewards and points will live here.",
  },
  "/account/profile": {
    eyebrow: "ACCOUNT DETAILS",
    title: "Your profile.",
    description: "The details connected to your account.",
  },
};

const sampleActivity = [2, 3, 2, 5, 4, 6, 4];
const chartPoints = sampleActivity
  .map((value, index) => `${68 + index * 87},${177 - value * 20}`);

function ActivityChart() {
  return (
    <section className={tw("dashboard-panel dashboard-activity")} aria-labelledby="activity-title">
      <div className={tw("dashboard-panel-heading")}>
        <div>
          <p className={tw("dashboard-section-kicker")}>A WEEK IN AMORE</p>
          <h2 className={tw("dashboard-panel-title")} id="activity-title">Your weekly activity</h2>
        </div>
        <span className={tw("dashboard-preview-tag")}>Sample preview</span>
      </div>

      <p className={tw("dashboard-chart-note")}>Illustrative sample only. Your real order activity will appear here once ordering is connected.</p>

      <div className={tw("dashboard-chart-wrap")}>
        <svg
          aria-label="Illustrative sample chart showing weekly activity from Monday to Sunday. It does not represent your actual orders."
          className={tw("dashboard-chart")}
          preserveAspectRatio="none"
          role="img"
          viewBox="0 0 680 220"
        >
          <defs>
            <linearGradient id="activity-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#a94d34" stopOpacity=".2" />
              <stop offset="100%" stopColor="#a94d34" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[57, 97, 137, 177].map((y) => (
            <line className={tw("dashboard-chart-grid")} key={y} x1="52" x2="660" y1={y} y2={y} />
          ))}
          <path d={`M${chartPoints.join(" L")} L590 177 L68 177 Z`} fill="url(#activity-area)" />
          <polyline className={tw("dashboard-chart-line")} points={chartPoints.join(" ")} />
          {sampleActivity.map((value, index) => (
            <circle
              className={tw("dashboard-chart-point")}
              cx={68 + index * 87}
              cy={177 - value * 20}
              key={`${index}-${value}`}
              r="4"
            />
          ))}
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, index) => (
            <text className={tw("dashboard-chart-label")} key={day} x={68 + index * 87} y="207" textAnchor="middle">{day}</text>
          ))}
          {[6, 4, 2, 0].map((value, index) => (
            <text className={tw("dashboard-chart-label")} key={value} x="34" y={61 + index * 40} textAnchor="end">{value}</text>
          ))}
        </svg>
      </div>

      <div className={tw("dashboard-chart-legend")}>
        <span className={tw("dashboard-chart-legend-label")}><i className={tw("dashboard-chart-legend-dot")} aria-hidden="true" /> Activity preview</span>
        <span>Actual account data is not connected yet</span>
      </div>
    </section>
  );
}

export function AccountDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const details = pageDetails[location.pathname] ?? pageDetails["/account"];

  if (!user) return <Navigate to="/login" replace />;

  async function handleSignOut() {
    setError(null);
    try {
      await signOut();
      navigate("/", { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign out.");
    }
  }

  return (
    <div className={tw("customer-dashboard")}>
      <DashboardSidebar items={navigation} onSignOut={() => void handleSignOut()} user={user!} />

      <main className={tw("dashboard-main")}>
        <header className={tw("dashboard-topbar")}>
          <div className={tw("dashboard-breadcrumb")}><span className={tw("dashboard-breadcrumb-muted")}>MY ACCOUNT</span><i className={tw("dashboard-breadcrumb-slash")} aria-hidden="true">/</i>{details.eyebrow}</div>
          <Link className={tw("dashboard-topbar-link")} to="/">Visit Kape Amore <span aria-hidden="true">↗</span></Link>
        </header>

        <div className={tw("dashboard-content")}>
          <section className={tw("dashboard-welcome")}>
            <div>
              <p className={tw("dashboard-eyebrow")}>{details.eyebrow}</p>
              <h1 className={tw("dashboard-welcome-title")}>{details.title}</h1>
              <p className={tw("dashboard-welcome-description")}>{details.description}{location.pathname === "/account" && user?.name ? ` Welcome, ${user.name.split(/\s+/)[0]}.` : ""}</p>
            </div>
            <Link className={tw("dashboard-order-button")} to="/#menu">Order something lovely <span aria-hidden="true">→</span></Link>
          </section>

          {error && <p className={tw("dashboard-error")} role="alert">{error}</p>}

          {location.pathname === "/account" && (
            <>
              <section className={tw("dashboard-stat-grid")} aria-label="Account summary">
                <article className={tw("dashboard-stat-card")}>
                  <span className={tw("dashboard-stat-icon dashboard-stat-icon-green")} aria-hidden="true">01</span>
                  <p className={tw("dashboard-stat-label")}>Orders placed</p>
                  <strong className={tw("dashboard-stat-value")}>—</strong>
                  <span className={tw("dashboard-stat-note")}>Order history is not connected yet</span>
                </article>
                <article className={tw("dashboard-stat-card")}>
                  <span className={tw("dashboard-stat-icon dashboard-stat-icon-caramel")} aria-hidden="true">02</span>
                  <p className={tw("dashboard-stat-label")}>Amore rewards</p>
                  <strong className={tw("dashboard-stat-value")}>—</strong>
                  <span className={tw("dashboard-stat-note")}>Rewards will appear here</span>
                </article>
                <article className={tw("dashboard-stat-card dashboard-member-card")}>
                  <span className={tw("dashboard-stat-icon dashboard-stat-icon-cream")} aria-hidden="true">✳</span>
                  <p className={tw("dashboard-stat-label")}>Your membership</p>
                  <strong className={tw("dashboard-stat-value dashboard-stat-value-small")}>Welcome in</strong>
                  <span className={tw("dashboard-stat-note")}>Your Kape Amore account is active</span>
                </article>
              </section>

              <ActivityChart />

              <section className={tw("dashboard-panel dashboard-recent")}>
                <div className={tw("dashboard-panel-heading")}>
                  <div>
                    <p className={tw("dashboard-section-kicker")}>FRESH FROM THE BAR</p>
                    <h2 className={tw("dashboard-panel-title")}>Recent orders</h2>
                  </div>
                  <Link className={tw("dashboard-recent-link")} to="/account/orders">View order history <span aria-hidden="true">→</span></Link>
                </div>
                <div className={tw("dashboard-empty-order")}>
                  <span className={tw("dashboard-empty-icon")} aria-hidden="true">☕</span>
                  <div className={tw("dashboard-empty-copy")}>
                    <strong className={tw("dashboard-empty-order-title")}>Your next favorite is waiting.</strong>
                    <p className={tw("dashboard-empty-order-description")}>Once online ordering is available, your recent orders will show up here.</p>
                  </div>
                  <Link className={tw("dashboard-empty-order-link")} to="/#menu">Explore the menu</Link>
                </div>
              </section>
            </>
          )}

          {location.pathname === "/account/orders" && (
            <section className={tw("dashboard-panel dashboard-page-panel")}>
              <div className={tw("dashboard-empty-state")}>
                <span className={tw("dashboard-empty-icon")} aria-hidden="true">☕</span>
                <h2 className={tw("dashboard-empty-title")}>No orders just yet</h2>
                <p className={tw("dashboard-empty-description")}>Your order history will appear here when online ordering is connected.</p>
                <Link className={tw("dashboard-order-button")} to="/#menu">Explore the menu <span aria-hidden="true">→</span></Link>
              </div>
            </section>
          )}

          {location.pathname === "/account/rewards" && (
            <section className={tw("dashboard-panel dashboard-page-panel")}>
              <div className={tw("dashboard-empty-state")}>
                <span className={tw("dashboard-empty-icon")} aria-hidden="true">✳</span>
                <h2 className={tw("dashboard-empty-title")}>Your rewards are brewing</h2>
                <p className={tw("dashboard-empty-description")}>The Amore rewards program is not connected yet. Your balance will appear here once it is available.</p>
                <Link className={tw("dashboard-order-button")} to="/#menu">Browse the menu <span aria-hidden="true">→</span></Link>
              </div>
            </section>
          )}

          {location.pathname === "/account/profile" && (
            <section className={tw("dashboard-panel dashboard-profile-panel")}>
              <p className={tw("dashboard-section-kicker")}>YOUR DETAILS</p>
              <h2 className={tw("dashboard-profile-heading")}>Account information</h2>
              <dl className={tw("dashboard-profile-details")}>
                <div className={tw("dashboard-profile-row")}><dt className={tw("dashboard-profile-label")}>Full name</dt><dd className={tw("dashboard-profile-value")}>{user?.name}</dd></div>
                <div className={tw("dashboard-profile-row")}><dt className={tw("dashboard-profile-label")}>Email address</dt><dd className={tw("dashboard-profile-value")}>{user?.email}</dd></div>
                <div className={tw("dashboard-profile-row")}><dt className={tw("dashboard-profile-label")}>Account type</dt><dd className={tw("dashboard-profile-value")}>Customer</dd></div>
              </dl>
              <p className={tw("dashboard-profile-note")}>Profile editing will be available when account management is connected.</p>
            </section>
          )}

          <footer className={tw("dashboard-footer")}>Made with amore, for your everyday moments.</footer>
        </div>
      </main>
    </div>
  );
}
