import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { tw } from "../tw";
import { DashboardSidebar } from "./DashboardSidebar";
import type { DashboardNavItem } from "./DashboardSidebar";
import { AdminFeaturePanel } from "./AdminFeaturePanel";
import { adminApi } from "./adminApi";
import type { AdminReport, AdminWorkspace } from "./adminApi";

const navigation: DashboardNavItem[] = [
  { label: "Overview", to: "/admin", icon: "overview" },
  { label: "POS & sales", to: "/admin/sales", icon: "orders" },
  { label: "Menu & catalog", to: "/admin/menu", icon: "menu" },
  { label: "Tables", to: "/admin/tables", icon: "tables" },
  { label: "Payments", to: "/admin/payments", icon: "orders" },
  { label: "Inventory", to: "/admin/inventory", icon: "inventory" },
  { label: "Delivery", to: "/admin/delivery", icon: "delivery" },
  { label: "Customers", to: "/admin/customers", icon: "customers" },
  { label: "Team & access", to: "/admin/team", icon: "team" },
  { label: "Reports", to: "/admin/reports", icon: "reports" },
  { label: "Settings", to: "/admin/settings", icon: "settings" },
];
const permissionForPath: Record<string, string> = {
  "/admin": "dashboard.view",
  "/admin/sales": "pos.use",
  "/admin/menu": "catalog.manage",
  "/admin/tables": "tables.manage",
  "/admin/payments": "payments.manage",
  "/admin/inventory": "inventory.manage",
  "/admin/delivery": "delivery.manage",
  "/admin/customers": "customers.manage",
  "/admin/team": "admin.manage",
  "/admin/reports": "reports.view",
  "/admin/settings": "admin.manage",
};

const details: Record<string, { eyebrow: string; title: string; description: string }> = {
  "/admin": { eyebrow: "ADMIN OVERVIEW", title: "Admin overview", description: "Your café operations and recorded business activity." },
  "/admin/sales": { eyebrow: "POINT OF SALE", title: "POS & sales", description: "Create orders, record payments, and manage the order workflow." },
  "/admin/menu": { eyebrow: "CATALOG", title: "Menu & catalog", description: "Manage products, pricing, categories, variations, and recipes." },
  "/admin/tables": { eyebrow: "DINE IN", title: "Tables", description: "Manage table capacity, seating areas, and availability." },
  "/admin/payments": { eyebrow: "CHECKOUT", title: "Payments", description: "Accept split payments and record payment refunds." },
  "/admin/inventory": { eyebrow: "STOCK CONTROL", title: "Inventory", description: "Maintain ingredient quantities and a traceable stock ledger." },
  "/admin/delivery": { eyebrow: "FULFILMENT", title: "Delivery", description: "Manage customer addresses, delivery assignments, and statuses." },
  "/admin/customers": { eyebrow: "GUESTS", title: "Customers", description: "Manage profiles, addresses, order history, and loyalty adjustments." },
  "/admin/team": { eyebrow: "STAFF ACCESS", title: "Team & access", description: "Provision staff accounts and review administrative activity." },
  "/admin/reports": { eyebrow: "BUSINESS INSIGHTS", title: "Reports", description: "Analyze recorded sales, payment methods, and best-selling items." },
  "/admin/settings": { eyebrow: "CONFIGURATION", title: "Settings", description: "Manage shop, tax, service-charge, receipt, and POS preferences." },
};

function money(value: number): string {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
}

function shortDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en", { weekday: "short" });
}

function SalesChart({ rows }: { rows: AdminWorkspace["summary"]["weekly_sales"] }) {
  const width = 560;
  const height = 170;
  const maxSales = Math.max(1, ...rows.map((row) => Number(row.sales)));
  const points = rows.map((row, index) => {
    const x = rows.length < 2 ? width / 2 : 36 + index * (width - 60) / (rows.length - 1);
    const y = height - 24 - Number(row.sales) / maxSales * (height - 48);
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className={tw("admin-chart-wrap")}>
      <svg aria-label="Completed sales over the last seven days" className={tw("admin-chart")} role="img" viewBox={`0 0 ${width} ${height}`}>
        {[0, 1, 2, 3].map((line) => {
          const y = 18 + line * 39;
          return <line key={line} x1="34" x2={width - 12} y1={y} y2={y} stroke="#edf0f5" strokeDasharray="3 5" />;
        })}
        <polyline fill="none" points={points} stroke="#557ce5" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        {rows.map((row, index) => {
          const x = rows.length < 2 ? width / 2 : 36 + index * (width - 60) / (rows.length - 1);
          const y = height - 24 - Number(row.sales) / maxSales * (height - 48);
          return <g key={row.day}><circle cx={x} cy={y} r="4" fill="#557ce5"><title>{`${shortDate(row.day)}: ${money(Number(row.sales))}`}</title></circle><text fill="#828996" fontSize="10" textAnchor="middle" x={x} y={height - 4}>{shortDate(row.day)}</text></g>;
        })}
      </svg>
      {rows.length === 0 && <p className={tw("admin-chart-empty")}>Sales activity will appear here.</p>}
    </div>
  );
}

function OrdersChart({ rows }: { rows: AdminWorkspace["summary"]["weekly_sales"] }) {
  const maxOrders = Math.max(1, ...rows.map((row) => Number(row.orders)));
  return (
    <div className={tw("admin-bars")} role="img" aria-label="Completed orders over the last seven days">
      {rows.map((row) => {
        const height = Math.max(8, Number(row.orders) / maxOrders * 112);
        return <div className={tw("admin-bar-column")} key={row.day}>
          <strong>{row.orders}</strong>
          <div className={tw("admin-bar-track")}><span className={tw("admin-bar-fill")} style={{ height }}><title>{`${shortDate(row.day)}: ${row.orders} completed orders`}</title></span></div>
          <span>{shortDate(row.day)}</span>
        </div>;
      })}
      {rows.length === 0 && <p className={tw("admin-chart-empty")}>Order activity will appear here.</p>}
    </div>
  );
}

function Overview({ workspace }: { workspace: AdminWorkspace }) {
  const summary = workspace.summary;
  const orders = workspace.records.orders ?? summary.recent_sales;
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 8;
  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return orders;
    return orders.filter((order) => [order.order_number, order.order_type, order.status, order.created_by]
      .some((value) => String(value ?? "").toLowerCase().includes(query)));
  }, [orders, search]);
  const visibleOrders = filteredOrders.slice(page * pageSize, (page + 1) * pageSize);
  const orderCount = Number(summary.today_completed_orders ?? 0);
  const averageOrder = orderCount ? Number(summary.today_sales) / orderCount : 0;
  const statusClasses: Record<string, string> = {
    completed: "bg-[#e9f8ef] text-[#23945c]",
    ready: "bg-[#e9f0ff] text-[#426bd1]",
    preparing: "bg-[#fff5df] text-[#a9791c]",
    cancelled: "bg-[#fff0ee] text-[#c76155]",
    held: "bg-[#fff5df] text-[#a9791c]",
    draft: "bg-[#f0f1f4] text-[#717887]",
  };
  const lowStock = (workspace.records.ingredients ?? []).filter(
    (ingredient) => Number(ingredient.quantity_on_hand) <= Number(ingredient.low_stock_threshold),
  );

  return (
    <div className={tw("admin-overview-page")}>
      <section className={tw("admin-overview-heading")}>
        <div><p className={tw("dashboard-eyebrow")}>KAPE AMORE · OPERATIONS</p><h1>Order</h1></div>
        <Link className={tw("admin-create-order")} to="/admin/sales">Create Order <span aria-hidden="true">+</span></Link>
      </section>
      <section className={tw("admin-kpis")} aria-label="Business overview">
        {[
          { label: "Gross Revenue", value: money(Number(summary.today_sales)), note: "Today" },
          { label: "Avg Order Value", value: money(averageOrder), note: `${orderCount} completed orders today` },
          { label: "Total Orders", value: String(summary.today_orders), note: `${summary.open_orders} currently open` },
          { label: "Lifetime Value", value: money(Number(summary.lifetime_sales)), note: "All completed sales" },
        ].map((stat) => (
          <article className={tw("admin-kpi")} key={stat.label}>
            <p>{stat.label}</p>
            <strong>{stat.value}</strong>
            <span><i aria-hidden="true">↗</i> {stat.note}</span>
          </article>
        ))}
      </section>
      <div className={tw("admin-analytics-grid")}>
        <section className={tw("admin-analytics-card")}>
          <div className={tw("admin-card-heading")}><div><h2>Order Analytic</h2><p>Completed revenue · last 7 days</p></div><span>This Week⌄</span></div>
          <SalesChart rows={summary.weekly_sales ?? []} />
        </section>
        <section className={tw("admin-analytics-card")}>
          <div className={tw("admin-card-heading")}><div><h2>Performance</h2><p>Completed orders · last 7 days</p></div><span>7 Days⌄</span></div>
          <OrdersChart rows={summary.weekly_sales ?? []} />
        </section>
      </div>
      <section className={tw("admin-order-list")}>
        <div className={tw("admin-order-heading")}><div><h2>Order List</h2><p>Recent café orders and their current status</p></div>
          <label className={tw("admin-order-search")}><span aria-hidden="true">⌕</span><input aria-label="Search orders" onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder="Search orders..." value={search} /></label>
        </div>
        <div className={tw("admin-table-wrap")}><table className={tw("admin-table admin-order-table")}><thead><tr><th>Order ID</th><th>Order Date</th><th>Order Type</th><th>Created By</th><th>Amount</th><th>Status</th></tr></thead><tbody>
          {visibleOrders.map((order) => {
            const status = String(order.status ?? "draft").toLowerCase();
            return <tr key={order.id}><td><strong>#{String(order.order_number ?? order.id)}</strong></td><td>{order.created_at ? new Date(String(order.created_at)).toLocaleDateString() : "—"}</td><td>{String(order.order_type ?? "").replace(/_/g, " ")}</td><td>ID: {String(order.created_by ?? "—")}</td><td>{money(Number(order.total))}</td><td><span className={tw(`admin-status-pill ${statusClasses[status] ?? "bg-[#f0f1f4] text-[#717887]"}`)}>{status.replace(/_/g, " ")}</span></td></tr>;
          })}
          {visibleOrders.length === 0 && <tr><td className={tw("admin-table-empty")} colSpan={6}>{search ? "No orders match your search." : "No orders have been entered yet."}</td></tr>}
        </tbody></table></div>
        <div className={tw("admin-order-pagination")}><span>{filteredOrders.length ? `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, filteredOrders.length)} of ${filteredOrders.length} orders` : "0 orders"}</span>
          <div><button aria-label="Previous page" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} type="button">‹</button><button aria-label="Next page" disabled={(page + 1) * pageSize >= filteredOrders.length} onClick={() => setPage((value) => value + 1)} type="button">›</button></div>
        </div>
      </section>
      {workspace.records.ingredients && lowStock.length > 0 && <Link className={tw("admin-stock-alert")} to="/admin/inventory">{lowStock.length} ingredients are at or below the low-stock threshold. Review inventory →</Link>}
    </div>
  );
}

function Reports({ onError }: { onError: (message: string | null) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = `${today.slice(0, 8)}01`;
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [report, setReport] = useState<AdminReport | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    onError(null);
    try {
      setReport(await adminApi.report(from, to));
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to load the report.");
    } finally {
      setBusy(false);
    }
  }, [from, to, onError]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className={tw("admin-sections")}>
      <section className={tw("dashboard-panel admin-resource-panel")} aria-label="Sales report filters">
        <div className={tw("dashboard-panel-heading")}><div><p className={tw("dashboard-section-kicker")}>SALES SUMMARY</p><h2 className={tw("dashboard-panel-title")}>Choose a reporting period</h2></div></div>
        <form className={tw("admin-report-filter")} onSubmit={(event) => { event.preventDefault(); void load(); }}>
          <label className={tw("admin-field")}><span>From</span><input onChange={(event) => setFrom(event.target.value)} required type="date" value={from} /></label>
          <label className={tw("admin-field")}><span>To</span><input onChange={(event) => setTo(event.target.value)} required type="date" value={to} /></label>
          <button className={tw("admin-primary-button")} disabled={busy} type="submit">{busy ? "Loading…" : "Run report"}</button>
        </form>
      </section>
      {report && (
        <>
          <section className={tw("dashboard-stat-grid")} aria-label="Sales report totals">
            <article className={tw("dashboard-stat-card admin-overview-stat")}><p className={tw("dashboard-stat-label")}>Completed sales</p><strong className={tw("dashboard-stat-value")}>{money(Number(report.sales))}</strong></article>
            <article className={tw("dashboard-stat-card admin-overview-stat")}><p className={tw("dashboard-stat-label")}>Orders opened</p><strong className={tw("dashboard-stat-value")}>{report.orders}</strong></article>
            <article className={tw("dashboard-stat-card admin-overview-stat")}><p className={tw("dashboard-stat-label")}>Average order value</p><strong className={tw("dashboard-stat-value")}>{money(report.orders ? Number(report.sales) / report.orders : 0)}</strong></article>
          </section>
          <ReportTable title="Sales by service type" rows={report.by_type.map((row) => ({ label: row.order_type.replace(/_/g, " "), first: `${row.orders} orders`, second: money(Number(row.sales)) }))} />
          <ReportTable title="Sales by payment method" rows={report.by_payment_method.map((row) => ({ label: row.method.replace(/_/g, " "), first: `${row.payments} payments`, second: money(Number(row.total)) }))} />
          <ReportTable title="Sales by category" rows={report.by_category.map((row) => ({ label: row.category, first: `${row.quantity} items`, second: money(Number(row.sales)) }))} />
          <ReportTable title="Employee sales" rows={report.by_employee.map((row) => ({ label: row.name, first: `${row.orders} orders`, second: money(Number(row.sales)) }))} />
          <ReportTable title="Best-selling products" rows={report.best_sellers.map((row) => ({ label: row.product_name, first: `${row.quantity} sold`, second: money(Number(row.sales)) }))} />
        </>
      )}
    </div>
  );
}

function ReportTable({ title, rows }: { title: string; rows: Array<{ label: string; first: string; second: string }> }) {
  return <section className={tw("dashboard-panel admin-resource-panel")}><div className={tw("dashboard-panel-heading")}><h2 className={tw("dashboard-panel-title")}>{title}</h2></div><div className={tw("admin-report-list")}>
    {rows.map((row) => <div className={tw("admin-report-row")} key={row.label}><strong>{row.label}</strong><span>{row.first}</span><b>{row.second}</b></div>)}
    {rows.length === 0 && <p className={tw("admin-empty-copy")}>No data for this period yet.</p>}
  </div></section>;
}

export function AdminDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [workspace, setWorkspace] = useState<AdminWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const path = location.pathname.replace(/\/+$/, "") || "/admin";
  const section = path === "/admin" ? "overview" : path.slice("/admin/".length);
  const detail = details[path] ?? details["/admin/sales"];
  const allowedNavigation = navigation.filter((item) => user?.roles.includes("admin") || user?.permissions.includes(permissionForPath[item.to]));
  const allowedPaths = allowedNavigation.map((item) => item.to);

  const loadWorkspace = useCallback(async () => {
    setError(null);
    try {
      setWorkspace(await adminApi.workspace());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load the admin workspace.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadWorkspace(); }, [loadWorkspace]);

  const reportError = useCallback((message: string | null) => setError(message), []);

  if (!user) return <Navigate to="/login" replace />;
  if (!allowedPaths.includes(path)) return <Navigate to={allowedPaths[0] ?? "/account"} replace />;

  async function handleSignOut() {
    try {
      await signOut();
      navigate("/", { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign out.");
    }
  }

  return (
    <div className={tw("customer-dashboard admin-dashboard")}>
      <DashboardSidebar
        items={allowedNavigation}
        onSignOut={() => void handleSignOut()}
        sectionLabel="ADMIN WORKSPACE"
        showMenuCallout={false}
        user={user}
        userSubtitle={user.roles.includes("admin") ? "Administrator" : user.roles.join(", ")}
      />

      <main className={tw("dashboard-main")}>
        <header className={tw("dashboard-topbar")}>
          <div className={tw("dashboard-breadcrumb")}><span className={tw("dashboard-breadcrumb-muted")}>KAPE AMORE</span><i className={tw("dashboard-breadcrumb-slash")} aria-hidden="true">/</i>{detail.eyebrow}</div>
          <Link className={tw("dashboard-topbar-link")} to="/">Visit Kape Amore <span aria-hidden="true">↗</span></Link>
        </header>

        <div className={tw("dashboard-content")}>
          {section !== "overview" && <section className={tw("dashboard-welcome")}>
            <div>
              <p className={tw("dashboard-eyebrow")}>{detail.eyebrow}</p>
              <h1 className={tw("dashboard-welcome-title")}>{detail.title}</h1>
              <p className={tw("dashboard-welcome-description")}>{detail.description}</p>
            </div>
          </section>}

          {error && <div className={tw("admin-service-error")} role="alert"><span>{error}</span><button className={tw("admin-text-button")} onClick={() => void loadWorkspace()} type="button">Try again</button></div>}
          {loading && <p className={tw("admin-loading")} role="status">Loading admin data…</p>}
          {!loading && workspace && section === "overview" && <Overview workspace={workspace} />}
          {!loading && workspace && section === "reports" && <Reports onError={reportError} />}
          {!loading && workspace && section !== "overview" && section !== "reports" && <AdminFeaturePanel onRefresh={loadWorkspace} section={section} workspace={workspace} />}
        </div>
      </main>
    </div>
  );
}
