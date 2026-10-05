import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { tw } from "../tw";
import { DashboardSidebar } from "./DashboardSidebar";
import type { DashboardNavItem } from "./DashboardSidebar";
import { AdminFeaturePanel } from "./AdminFeaturePanel";
import { adminApi, adminImageUrl } from "./adminApi";
import type { AdminReport, AdminWorkspace } from "./adminApi";

const navigation: DashboardNavItem[] = [
  { label: "Overview", to: "/admin", icon: "overview" },
  { label: "POS & sales", to: "/admin/sales", icon: "orders" },
  { label: "Menu & catalog", to: "/admin/menu", icon: "menu" },
  { label: "Tables", to: "/admin/tables", icon: "tables" },
  { label: "Payments", to: "/admin/payments", icon: "orders" },
  { label: "Customers", to: "/admin/customers", icon: "customers" },
  { label: "Team & access", to: "/admin/team", icon: "team" },
  { label: "Reports", to: "/admin/reports", icon: "reports" },
  { label: "Settings", to: "/admin/settings", icon: "settings" },
  { label: "Landing page", to: "/admin/landing", icon: "menu" },
];
const permissionForPath: Record<string, string> = {
  "/admin": "dashboard.view",
  "/admin/sales": "pos.use",
  "/admin/menu": "catalog.manage",
  "/admin/tables": "tables.manage",
  "/admin/payments": "payments.manage",
  "/admin/inventory": "inventory.manage",
  "/admin/customers": "customers.manage",
  "/admin/team": "admin.manage",
  "/admin/reports": "reports.view",
  "/admin/settings": "admin.manage",
  "/admin/landing": "admin.manage",
};

const details: Record<string, { eyebrow: string; title: string; description: string }> = {
  "/admin": { eyebrow: "ADMIN OVERVIEW", title: "Admin overview", description: "Your café operations and recorded business activity." },
  "/admin/sales": { eyebrow: "POINT OF SALE", title: "POS & sales", description: "Create orders, record payments, and manage the order workflow." },
  "/admin/menu": { eyebrow: "CATALOG", title: "Menu & catalog", description: "Manage products, pricing, categories, variations, and recipes." },
  "/admin/tables": { eyebrow: "DINE IN", title: "Tables", description: "Manage table capacity, seating areas, and availability." },
  "/admin/payments": { eyebrow: "CHECKOUT", title: "Payments", description: "Accept split payments and record payment refunds." },
  "/admin/inventory": { eyebrow: "STOCK CONTROL", title: "Inventory", description: "Maintain ingredient quantities and a traceable stock ledger." },
  "/admin/customers": { eyebrow: "GUESTS", title: "Customers", description: "Manage profiles, addresses, order history, and loyalty adjustments." },
  "/admin/team": { eyebrow: "STAFF ACCESS", title: "Team & access", description: "Provision staff accounts and review administrative activity." },
  "/admin/reports": { eyebrow: "BUSINESS INSIGHTS", title: "Reports", description: "Analyze recorded sales, payment methods, and best-selling items." },
  "/admin/settings": { eyebrow: "CONFIGURATION", title: "Settings", description: "Manage shop, tax, service-charge, receipt, and POS preferences." },
  "/admin/landing": { eyebrow: "WEBSITE", title: "Landing page", description: "Change the featured images visitors see on the café homepage." },
};

function money(value: number): string {
  return `₱${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function shortDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en", { weekday: "short" });
}

function chartDays(current: AdminWorkspace["summary"]["weekly_sales"], previous: AdminWorkspace["summary"]["previous_weekly_sales"]) {
  const currentByDay = new Map(current.map((row) => [row.day, row]));
  const previousByDay = new Map(previous.map((row) => [row.day, row]));
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const priorDate = new Date(date);
    priorDate.setDate(date.getDate() - 7);
    const priorKey = `${priorDate.getFullYear()}-${String(priorDate.getMonth() + 1).padStart(2, "0")}-${String(priorDate.getDate()).padStart(2, "0")}`;
    return {
      day: key,
      sales: Number(currentByDay.get(key)?.sales ?? 0),
      orders: Number(currentByDay.get(key)?.orders ?? 0),
      previousSales: Number(previousByDay.get(priorKey)?.sales ?? 0),
    };
  });
}

function smoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return "";
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const middleX = (previous.x + point.x) / 2;
    return `${path} C ${middleX},${previous.y} ${middleX},${point.y} ${point.x},${point.y}`;
  }, `M ${points[0].x},${points[0].y}`);
}

function SalesChart({ rows, previousRows }: {
  rows: AdminWorkspace["summary"]["weekly_sales"];
  previousRows: AdminWorkspace["summary"]["previous_weekly_sales"];
}) {
  const days = chartDays(rows, previousRows);
  const [selectedIndex, setSelectedIndex] = useState(days.length - 1);
  const width = 560;
  const height = 176;
  const maxSales = Math.max(1, ...days.flatMap((day) => [day.sales, day.previousSales]));
  const plot = { left: 38, right: width - 12, top: 22, bottom: height - 24 };
  const pointFor = (value: number, index: number) => ({
    x: plot.left + index * (plot.right - plot.left) / (days.length - 1),
    y: plot.bottom - value / maxSales * (plot.bottom - plot.top),
  });
  const salesPoints = days.map((day, index) => pointFor(day.sales, index));
  const previousPoints = days.map((day, index) => pointFor(day.previousSales, index));
  const selected = days[selectedIndex] ?? days[days.length - 1];

  return (
    <div className={tw("admin-chart-wrap")}>
      <div className={tw("admin-chart-tooltip")} aria-live="polite">
        <span>{shortDate(selected.day)}</span>
        <strong><i />{money(selected.sales)}</strong>
        <strong><i />{money(selected.previousSales)}</strong>
      </div>
      <svg aria-label="Completed sales this week compared with last week" className={tw("admin-chart")} role="img" viewBox={`0 0 ${width} ${height}`}>
        {[0, 1, 2, 3].map((line) => {
          const y = plot.top + line * (plot.bottom - plot.top) / 3;
          const value = maxSales * (1 - line / 3);
          return <g key={line}><line x1={plot.left} x2={plot.right} y1={y} y2={y} stroke="#edf0f5" strokeDasharray="3 5" /><text className={tw("admin-chart-axis-label")} textAnchor="end" x={plot.left - 7} y={y + 3}>{`₱${Math.round(value)}`}</text></g>;
        })}
        <path d={smoothPath(previousPoints)} fill="none" stroke="#c8d0df" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        <path d={smoothPath(salesPoints)} fill="none" stroke="#6a59e8" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
        {days.map((day, index) => {
          const point = salesPoints[index];
          return <g key={day.day} onFocus={() => setSelectedIndex(index)} onMouseEnter={() => setSelectedIndex(index)}>
            <circle cx={point.x} cy={point.y} r={selectedIndex === index ? 4 : 2.5} fill="#6a59e8"><title>{`${day.day}: ${money(day.sales)} this week, ${money(day.previousSales)} last week`}</title></circle>
            <text className={tw("admin-chart-day-label")} textAnchor="middle" x={point.x} y={height - 4}>{shortDate(day.day)}</text>
          </g>;
        })}
        {previousPoints.map((point, index) => <circle key={`previous-${days[index].day}`} cx={point.x} cy={point.y} r={selectedIndex === index ? 3.5 : 2} fill="#c8d0df" />)}
      </svg>
      <div className={tw("admin-chart-legend")}><span><i />This week</span><span><i />Last week</span></div>
    </div>
  );
}

function OrdersChart({ rows, previousRows }: {
  rows: AdminWorkspace["summary"]["weekly_sales"];
  previousRows: AdminWorkspace["summary"]["previous_weekly_sales"];
}) {
  const days = chartDays(rows, previousRows);
  const width = 560;
  const height = 176;
  const maxSales = Math.max(1, ...days.map((day) => day.sales));
  const plot = { left: 38, right: width - 12, top: 20, bottom: height - 24 };
  const columnWidth = 22;
  return (
    <div className={tw("admin-chart-wrap")}>
      <svg aria-label="Daily completed sales over the last seven days" className={tw("admin-chart")} role="img" viewBox={`0 0 ${width} ${height}`}>
        {[0, 1, 2, 3].map((line) => {
          const y = plot.top + line * (plot.bottom - plot.top) / 3;
          const value = maxSales * (1 - line / 3);
          return <g key={line}><line x1={plot.left} x2={plot.right} y1={y} y2={y} stroke="#edf0f5" strokeDasharray="3 5" /><text className={tw("admin-chart-axis-label")} textAnchor="end" x={plot.left - 7} y={y + 3}>{`₱${Math.round(value)}`}</text></g>;
        })}
        {days.map((day, index) => {
          const x = plot.left + index * (plot.right - plot.left) / (days.length - 1);
          const barHeight = day.sales ? Math.max(4, day.sales / maxSales * (plot.bottom - plot.top)) : 0;
          return <g key={day.day}>
            <rect className={tw("admin-chart-bar")} height={barHeight} rx="7" width={columnWidth} x={x - columnWidth / 2} y={plot.bottom - barHeight}><title>{`${day.day}: ${money(day.sales)} · ${day.orders} orders`}</title></rect>
            <text className={tw("admin-chart-day-label")} textAnchor="middle" x={x} y={height - 4}>{shortDate(day.day)}</text>
          </g>;
        })}
      </svg>
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
  const topProducts = summary.top_products ?? [];
  const [featuredIndex, setFeaturedIndex] = useState(0);
  useEffect(() => {
    if (topProducts.length < 2) return;
    const timer = window.setInterval(() => setFeaturedIndex((current) => (current + 1) % topProducts.length), 4500);
    return () => window.clearInterval(timer);
  }, [topProducts.length]);
  const featuredProduct = topProducts[featuredIndex] ?? topProducts[0];

  return (
    <div className={tw("admin-overview-page")}>
      <section className={tw("admin-overview-heading")}>
        <div><p className={tw("dashboard-eyebrow")}>KAPE AMORE · OPERATIONS</p><h1>Order</h1></div>
        <Link className={tw("admin-create-order")} to="/admin/sales">Create Order <span aria-hidden="true">+</span></Link>
      </section>
      <section className={tw("admin-kpis")} aria-label="Business overview">
        {[
          { label: "Gross Revenue", value: money(Number(summary.today_sales)), note: "Revenue earned today", icon: "M12 2v20m5-15H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" },
          { label: "Avg Order Value", value: money(averageOrder), note: `${orderCount} completed orders today`, icon: "M4 5h16M4 12h16M4 19h10" },
          { label: "Total Orders", value: String(summary.today_orders), note: `${summary.open_orders} currently open`, icon: "M7 3h10l4 4v14H3V3h4zm0 0v5h10V3M7 13h10M7 17h7" },
          { label: "Lifetime Value", value: money(Number(summary.lifetime_sales)), note: "All completed sales", icon: "M3 12l5-5 4 4 8-8m-6 0h6v6" },
        ].map((stat) => (
          <article className={tw("admin-kpi")} key={stat.label}>
            <div className={tw("admin-kpi-top")}>
              <p>{stat.label}</p>
              <span className={tw("admin-kpi-icon")} aria-hidden="true">
                <svg fill="none" viewBox="0 0 24 24"><path d={stat.icon} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" /></svg>
              </span>
            </div>
            <strong>{stat.value}</strong>
            <span className={tw("admin-kpi-note")}><i aria-hidden="true" />{stat.note}</span>
          </article>
        ))}
      </section>
      <div className={tw("admin-analytics-grid")}>
        <section className={tw("admin-analytics-card")}>
          <div className={tw("admin-card-heading")}><div><h2>Order Analistic</h2><p>Completed sales · this week vs last week</p></div><span>This Week⌄</span></div>
          <SalesChart previousRows={summary.previous_weekly_sales ?? []} rows={summary.weekly_sales ?? []} />
        </section>
        <section className={tw("admin-analytics-card")}>
          <div className={tw("admin-card-heading")}><div><h2>Performance</h2><p>Completed sales · last 7 days</p></div><span>This Week⌄</span></div>
          <OrdersChart previousRows={summary.previous_weekly_sales ?? []} rows={summary.weekly_sales ?? []} />
        </section>
      </div>
      <div className={tw("admin-overview-insights")}>
      <section className={tw("admin-top-products")} aria-label="Top three best-selling products">
        <div className={tw("admin-card-heading")}><div><h2>Top 3 best products</h2><p>Most ordered products · images switch automatically</p></div><span>BEST SELLERS</span></div>
        {featuredProduct ? (
          <div className={tw("admin-top-product-feature")}>
            {featuredProduct.image_path ? <img alt="" src={adminImageUrl(featuredProduct.image_path)} /> : <div className={tw("admin-top-product-placeholder")}>☕</div>}
            <div><p className={tw("dashboard-eyebrow")}>NO. {featuredIndex + 1} MOST ORDERED</p><h3>{featuredProduct.product_name}</h3><strong>{Number(featuredProduct.quantity)} orders</strong><span>{money(Number(featuredProduct.sales))} in sales</span></div>
          </div>
        ) : <p className={tw("admin-empty-copy")}>Complete an order to see your best products here.</p>}
        <div className={tw("admin-top-product-dots")} aria-label="Best product slides">{topProducts.map((product, index) => <button aria-label={`Show ${product.product_name}`} aria-pressed={index === featuredIndex} className={tw(index === featuredIndex ? "is-active" : "")} key={`${product.product_id}-${product.product_name}`} onClick={() => setFeaturedIndex(index)} type="button" />)}</div>
      </section>
      <section className={tw("admin-order-type-card")} aria-label="Orders by type">
        <div className={tw("admin-card-heading")}><div><h2>Order mix</h2><p>Dine in vs takeout</p></div><span>THIS PERIOD</span></div>
        {(() => {
          const mix = (summary.orders_by_type ?? []).filter((row) => ["dine_in", "takeout"].includes(String(row.order_type)));
          const total = mix.reduce((sum, row) => sum + Number(row.count), 0);
          let offset = 0;
          const colors = ["#a94d34", "#d5a477"];
          const segments = mix.map((row, index) => {
            const value = total ? Number(row.count) / total * 100 : 0;
            const segment = `${colors[index % colors.length]} ${offset}% ${offset + value}%`;
            offset += value;
            return { ...row, value, segment };
          });
          return <>
            <div className={tw("admin-pie-wrap")}><div className={tw("admin-pie-chart")} style={{ background: total ? `conic-gradient(${segments.map((segment) => segment.segment).join(", ")})` : "#eadfd2" }}><div>{total}<small>orders</small></div></div></div>
            <div className={tw("admin-pie-legend")}>{segments.map((segment, index) => <div key={String(segment.order_type)}><i style={{ background: colors[index % colors.length] }} /><span>{String(segment.order_type).replace("_", " ")}</span><strong>{Number(segment.count)}</strong></div>)}</div>
          </>;
        })()}
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
          <section className={tw("admin-report-hero")} aria-label="Report overview">
            <div><p className={tw("dashboard-section-kicker")}>PERFORMANCE SNAPSHOT</p><h2>What your numbers are saying</h2><p>Insights from completed orders between {from} and {to}.</p></div>
            <span className={tw("admin-report-hero-mark")}>✦</span>
          </section>
          <section className={tw("admin-report-insight-grid")} aria-label="Sales report totals">
            <article className={tw("admin-report-insight-card admin-report-insight-revenue")}><span>Revenue captured</span><strong>{money(Number(report.sales))}</strong><small>Across {report.orders} completed orders</small><i>↗</i></article>
            <article className={tw("admin-report-insight-card")}><span>Average order value</span><strong>{money(report.orders ? Number(report.sales) / report.orders : 0)}</strong><small>Typical spend per order</small><i>₱</i></article>
            <article className={tw("admin-report-insight-card")}><span>Top service</span><strong>{report.by_type[0]?.order_type?.replace(/_/g, " ") ?? "—"}</strong><small>{report.by_type[0] ? `${report.by_type[0].orders} orders · ${money(Number(report.by_type[0].sales))}` : "No service data yet"}</small><i>⌂</i></article>
          </section>
          <section className={tw("admin-report-visual-grid")}>
            <ReportBarChart title="Sales by service" subtitle="Where orders are being placed" rows={report.by_type.map((row) => ({ label: row.order_type.replace(/_/g, " "), value: Number(row.sales), note: `${row.orders} orders` }))} format={money} />
            <ReportBarChart title="Payment mix" subtitle="How customers are paying" rows={report.by_payment_method.map((row) => ({ label: row.method.replace(/_/g, " "), value: Number(row.total), note: `${row.payments} payments` }))} format={money} />
            <ReportBarChart title="Best-selling products" subtitle="Products driving the most sales" rows={report.best_sellers.map((row) => ({ label: row.product_name, value: Number(row.sales), note: `${row.quantity} sold` }))} format={money} />
            <ReportBarChart title="Category performance" subtitle="Revenue contribution by category" rows={report.by_category.map((row) => ({ label: row.category, value: Number(row.sales), note: `${row.quantity} items` }))} format={money} />
          </section>
        </>
      )}
    </div>
  );
}

function ReportBarChart({ title, subtitle, rows, format }: { title: string; subtitle: string; rows: Array<{ label: string; value: number; note: string }>; format: (value: number) => string }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return <section className={tw("admin-report-chart-card")}><div className={tw("admin-report-chart-heading")}><div><h2>{title}</h2><p>{subtitle}</p></div><span>INSIGHTS</span></div>
    <div className={tw("admin-report-bars")}>{rows.slice(0, 5).map((row) => <div className={tw("admin-report-bar-row")} key={row.label}><div className={tw("admin-report-bar-meta")}><strong>{row.label}</strong><span>{row.note} · {format(row.value)}</span></div><div className={tw("admin-report-bar-track")}><i style={{ width: `${Math.max(5, (row.value / max) * 100)}%` }} /></div></div>)}</div>
    {rows.length === 0 && <p className={tw("admin-empty-copy")}>No data for this period yet.</p>}
  </section>;
}

export function AdminDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [workspace, setWorkspace] = useState<AdminWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
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
    <div className={tw("customer-dashboard")}>
      <DashboardSidebar
        items={allowedNavigation}
        onSignOut={() => void handleSignOut()}
        sectionLabel="ADMIN WORKSPACE"
        showMenuCallout={false}
        showSidebarUser={false}
        user={user}
        userSubtitle={user.roles.includes("admin") ? "Administrator" : user.roles.join(", ")}
      />

      <main className={tw("dashboard-main")}>
        <header className={tw("dashboard-topbar admin-header-brown")}>
          <div className={tw("dashboard-breadcrumb admin-header-breadcrumb")}><span className={tw("dashboard-breadcrumb-muted admin-header-breadcrumb-muted")}>KAPE AMORE</span><i className={tw("dashboard-breadcrumb-slash admin-header-breadcrumb-slash")} aria-hidden="true">/</i>{detail.eyebrow}</div>
          <div className={tw("admin-account-menu")}>
            <button aria-expanded={accountMenuOpen} aria-haspopup="menu" className={tw("admin-account-trigger")} onClick={() => setAccountMenuOpen((open) => !open)} type="button">
              <span className={tw("admin-header-avatar")} aria-hidden="true">{user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "KA"}</span>
              <span className={tw("admin-header-account-copy")}><strong>{user.name}</strong><small>{user.roles.includes("admin") ? "Administrator" : user.roles.join(", ")}</small></span>
              <svg className={tw(`admin-account-chevron ${accountMenuOpen ? "admin-account-chevron-open" : ""}`)} aria-hidden="true" fill="none" viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" /></svg>
            </button>
            {accountMenuOpen && <div className={tw("admin-account-dropdown")} role="menu">
              <div className={tw("admin-account-dropdown-user")}><strong>{user.name}</strong><span>{user.email}</span></div>
              <button className={tw("admin-account-dropdown-signout")} onClick={() => void handleSignOut()} role="menuitem" type="button">
                <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" /></svg>
                Sign out
              </button>
            </div>}
          </div>
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
          {!loading && workspace && section !== "overview" && section !== "reports" && <AdminFeaturePanel currentUserId={user.id} onRefresh={loadWorkspace} section={section} workspace={workspace} />}
        </div>
      </main>
    </div>
  );
}
