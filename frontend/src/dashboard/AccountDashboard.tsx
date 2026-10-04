import { Suspense, lazy, useEffect, useRef, useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { DashboardNavItem } from "./DashboardSidebar";
import { DashboardSidebar } from "./DashboardSidebar";
import { tw } from "../tw";
import { customerApi, adminImageUrl } from "./adminApi";
import type { AdminRecord, CustomerCatalog, CustomerDeliveryTracking, PaymentMethod } from "./adminApi";

const DeliveryTrackingMap = lazy(() => import("./DeliveryTrackingMap").then((module) => ({ default: module.DeliveryTrackingMap })));

const navigation: DashboardNavItem[] = [
  { label: "Overview", to: "/account", icon: "overview" },
  { label: "Browse order", to: "/account/browse-order", icon: "browse" },
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
  "/account/browse-order": {
    eyebrow: "ORDER ONLINE",
    title: "Find your next favorite.",
    description: "Browse the café menu and add your picks to a delivery cart.",
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

type CartFlight = {
  id: number;
  name: string;
  image: string;
  startX: number;
  startY: number;
  deltaX: number;
  deltaY: number;
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
}

function productDisplayImage(product: AdminRecord): string {
  const imagePath = typeof product.image_path === "string" ? product.image_path : "";
  return imagePath ? adminImageUrl(imagePath) : "";
}

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

      <p className={tw("dashboard-chart-note")}>Illustrative sample only. This chart is not connected to your saved delivery orders.</p>

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
        <span>Customer activity is not connected yet</span>
      </div>
    </section>
  );
}

export function AccountDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CustomerCatalog["records"] | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[] | null>(null);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState<{ orderNumber: string; total: number; message: string; paymentLabel: string } | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [customerLocation, setCustomerLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locatingCustomer, setLocatingCustomer] = useState(false);
  const [customerLocationError, setCustomerLocationError] = useState<string | null>(null);
  const [customerDeliveries, setCustomerDeliveries] = useState<CustomerDeliveryTracking[]>([]);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [trackingRefreshKey, setTrackingRefreshKey] = useState(0);
  const [deliveryDetails, setDeliveryDetails] = useState({
    recipient_name: user?.name ?? "",
    phone: "",
    address_line: "",
    address_line_2: "",
    city: "",
    region: "",
    postal_code: "",
    delivery_notes: "",
  });
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSizes, setSelectedSizes] = useState<Record<number, number>>({});
  const [orderItems, setOrderItems] = useState<Record<string, number>>({});
  const [cartFlight, setCartFlight] = useState<CartFlight | null>(null);
  const cartButtonRef = useRef<HTMLButtonElement>(null);
  const cartFlightRef = useRef<HTMLDivElement>(null);
  const cartFlightId = useRef(0);
  const details = pageDetails[location.pathname] ?? pageDetails["/account"];

  useEffect(() => {
    let active = true;

    async function loadWorkspace() {
      try {
        const nextCatalog = await customerApi.catalog();
        if (active) setCatalog(nextCatalog.records);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load menu items.");
      } finally {
        if (active) setLoadingProducts(false);
      }
    }

    void loadWorkspace();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!checkoutOpen && !checkoutSuccess) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || checkoutBusy) return;
      setCheckoutOpen(false);
      setCheckoutSuccess(null);
      setCheckoutError(null);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [checkoutBusy, checkoutOpen, checkoutSuccess]);

  useEffect(() => {
    if (location.pathname !== "/account/orders") return;

    let active = true;
    const loadDeliveries = async () => {
      try {
        const response = await customerApi.deliveries();
        if (active) {
          setCustomerDeliveries(response.deliveries);
          setTrackingError(null);
        }
      } catch (cause) {
        if (active) setTrackingError(cause instanceof Error ? cause.message : "Unable to load delivery tracking.");
      }
    };
    void loadDeliveries();
    const interval = window.setInterval(() => void loadDeliveries(), 5000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [location.pathname, trackingRefreshKey]);

  useEffect(() => {
    if (!cartFlight) return;

    const flightElement = cartFlightRef.current;
    const cartButton = cartButtonRef.current;
    if (!flightElement || !cartButton) {
      setCartFlight(null);
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCartFlight(null);
      return;
    }

    const flightAnimation = flightElement.animate(
      [
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
        { offset: 0.68, transform: `translate(${cartFlight.deltaX * 0.72}px, ${cartFlight.deltaY * 0.72 - 44}px) scale(0.8)`, opacity: 1 },
        { transform: `translate(${cartFlight.deltaX}px, ${cartFlight.deltaY}px) scale(0.2)`, opacity: 0.15 },
      ],
      { duration: 620, easing: "cubic-bezier(.22,.72,.25,1)", fill: "forwards" },
    );
    const cartAnimation = cartButton.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.13)" },
        { transform: "scale(1)" },
      ],
      { duration: 360, easing: "ease-out" },
    );

    flightAnimation.onfinish = () => {
      setCartFlight((current) => current?.id === cartFlight.id ? null : current);
    };

    return () => {
      flightAnimation.cancel();
      cartAnimation.cancel();
    };
  }, [cartFlight]);

  const productRecords = catalog?.products ?? [];
  const orderableProducts = productRecords.filter((product) => Number(product.is_available) === 1);
  const categories = catalog?.categories ?? [];
  const visibleCategories = categories.filter((category) =>
    productRecords.some((product) => Number(product.category_id) === Number(category.id)),
  );
  const productCards = productRecords.map((product) => {
    const productId = Number(product.id);
    const sizes = (catalog?.variations ?? []).filter((size) => Number(size.product_id) === productId && size.is_available);
    const selectedSizeId = selectedSizes[productId] ?? (sizes.length > 0 ? Number(sizes[0].id) : null);
    const selectedSize = sizes.find((size) => Number(size.id) === selectedSizeId);
    const itemKey = `${productId}:${selectedSize ? Number(selectedSize.id) : "base"}`;

    return {
      id: productId,
      categoryId: Number(product.category_id),
      key: itemKey,
      name: String(product.name),
      isAvailable: Number(product.is_available) === 1,
      note: typeof product.description === "string" ? product.description : "",
      price: Number(selectedSize?.price ?? product.base_price ?? 0),
      tag: String(categories.find((category) => Number(category.id) === Number(product.category_id))?.name ?? "MENU ITEM").toUpperCase(),
      image: productDisplayImage(product),
      imageAlt: `${String(product.name)} preview`,
      sizes,
      selectedSizeId,
      sizeName: typeof selectedSize?.name === "string" ? selectedSize.name : "",
      quantity: orderItems[itemKey] ?? 0,
    };
  });
  const visibleProductCards = selectedCategory === "all"
    ? productCards
    : productCards.filter((product) => String(product.categoryId) === selectedCategory);
  const menuItems = orderableProducts.flatMap((product) => {
    const productId = Number(product.id);
    const sizes = (catalog?.variations ?? []).filter((size) => Number(size.product_id) === productId && size.is_available);
    const orderableSizes: Array<AdminRecord | null> = sizes.length > 0 ? sizes : [null];

    return orderableSizes.map((size) => {
      const key = `${productId}:${size ? Number(size.id) : "base"}`;
      return {
        id: productId,
        key,
        variationId: size ? Number(size.id) : null,
        name: String(product.name),
        sizeName: typeof size?.name === "string" ? size.name : "",
        price: Number(size?.price ?? product.base_price ?? 0),
        quantity: orderItems[key] ?? 0,
      };
    });
  });
  const cartItems = menuItems.filter((item) => item.quantity > 0);
  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);
  const cartSubtotal = cartItems.reduce((total, item) => total + item.quantity * item.price, 0);

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

  function addItem(itemKey: string, name: string, image: string, source: HTMLButtonElement) {
    setOrderItems((current) => ({ ...current, [itemKey]: (current[itemKey] ?? 0) + 1 }));
    setError(null);
    setCheckoutSuccess(null);

    const cartButton = cartButtonRef.current;
    if (!cartButton) return;

    const sourceBounds = source.getBoundingClientRect();
    const cartBounds = cartButton.getBoundingClientRect();
    const sourceCenterX = sourceBounds.left + sourceBounds.width / 2;
    const sourceCenterY = sourceBounds.top + sourceBounds.height / 2;
    const cartCenterX = cartBounds.left + cartBounds.width / 2;
    const cartCenterY = cartBounds.top + cartBounds.height / 2;

    setCartFlight({
      id: ++cartFlightId.current,
      name,
      image,
      startX: sourceCenterX - 22,
      startY: sourceCenterY - 22,
      deltaX: cartCenterX - sourceCenterX,
      deltaY: cartCenterY - sourceCenterY,
    });
  }

  function updateQuantity(itemKey: string, nextQuantity: number) {
    setOrderItems((current) => {
      const updated = { ...current };
      if (nextQuantity <= 0) delete updated[itemKey];
      else updated[itemKey] = nextQuantity;
      return updated;
    });
  }

  async function openCheckout() {
    setCheckoutOpen(true);
    setCheckoutError(null);
    if (paymentMethods !== null) return;
    setLoadingPaymentMethods(true);
    try {
      const response = await customerApi.paymentMethods();
      setPaymentMethods(response.methods);
      setSelectedPaymentMethod(response.methods[0]?.code ?? "");
    } catch (cause) {
      setCheckoutError(cause instanceof Error ? cause.message : "Unable to load payment methods.");
    } finally {
      setLoadingPaymentMethods(false);
    }
  }

  async function submitCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCheckoutError(null);
    setCheckoutBusy(true);
    try {
      const result = await customerApi.checkout({
        payment_method: selectedPaymentMethod,
        items: cartItems.map((item) => ({
          product_id: item.id,
          variation_id: item.variationId,
          quantity: item.quantity,
        })),
        ...deliveryDetails,
        ...(customerLocation ?? {}),
      });
      setOrderItems({});
      setCheckoutOpen(false);
      setCartOpen(false);
      setTrackingRefreshKey((current) => current + 1);
      setCheckoutSuccess({
        orderNumber: String(result.record.order_number),
        total: Number(result.record.total),
        message: result.message,
        paymentLabel: paymentMethods?.find((method) => method.code === selectedPaymentMethod)?.label ?? selectedPaymentMethod,
      });
    } catch (cause) {
      setCheckoutError(cause instanceof Error ? cause.message : "Unable to complete the sandbox checkout.");
    } finally {
      setCheckoutBusy(false);
    }
  }

  function useCurrentLocation() {
    setCustomerLocationError(null);
    if (!navigator.geolocation) {
      setCustomerLocationError("This browser does not support location services.");
      return;
    }
    if (!window.isSecureContext) {
      setCustomerLocationError("Your browser requires a secure HTTPS connection to share location.");
      return;
    }
    setLocatingCustomer(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setCustomerLocation({ latitude: coords.latitude, longitude: coords.longitude });
        setLocatingCustomer(false);
      },
      (cause) => {
        setCustomerLocationError(cause.code === 1
          ? "Location permission was denied. You can continue without showing your pin on the tracking map."
          : "Unable to get your current location. You can continue without it.");
        setLocatingCustomer(false);
      },
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 20000 },
    );
  }

  return (
    <div className={tw("customer-dashboard")}>
      <DashboardSidebar items={navigation} onSignOut={() => void handleSignOut()} showSidebarUser={false} user={user!} />

      <main className={tw("dashboard-main")}>
        <header className={tw("dashboard-topbar admin-header-brown")}>
          <div className={tw("dashboard-breadcrumb admin-header-breadcrumb")}><span className={tw("dashboard-breadcrumb-muted admin-header-breadcrumb-muted")}>MY ACCOUNT</span><i className={tw("dashboard-breadcrumb-slash admin-header-breadcrumb-slash")} aria-hidden="true">/</i>{details.eyebrow}</div>
          <div className={tw("customer-header-actions")}>
            <div className={tw("customer-cart-menu")}>
              <button
                aria-expanded={cartOpen}
                aria-haspopup="dialog"
                aria-label={`Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}
                className={tw("customer-cart-button")}
                onClick={() => setCartOpen((open) => !open)}
                ref={cartButtonRef}
                type="button"
              >
                <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
                  <path d="M3 4h2l2.2 10.2a2 2 0 002 1.6h7.7a2 2 0 001.9-1.4L21 8H6M10 20a1 1 0 100-2 1 1 0 000 2zM18 20a1 1 0 100-2 1 1 0 000 2z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
                </svg>
                <span>Cart</span>
                <span className={tw("customer-cart-count")}>{cartCount}</span>
              </button>
              {cartOpen && (
                <section aria-label="Shopping cart" className={tw("customer-cart-popover")} role="dialog">
                  <div className={tw("customer-cart-heading")}>
                    <div>
                      <p className={tw("dashboard-section-kicker")}>BASKET</p>
                      <h2>Your cart</h2>
                    </div>
                    <button aria-label="Close cart" className={tw("customer-cart-close")} onClick={() => setCartOpen(false)} type="button">×</button>
                  </div>
                  {cartItems.length === 0 ? (
                    <p className={tw("customer-cart-empty")}>Your cart is empty. Browse the menu and add something you love.</p>
                  ) : (
                    <div className={tw("customer-cart-items")}>
                      {cartItems.map((item) => (
                        <div className={tw("customer-cart-item")} key={item.key}>
                          <div className={tw("customer-cart-item-details")}>
                            <strong>{item.name}</strong>
                            <span>{item.sizeName ? `${item.sizeName} · ` : ""}{formatMoney(item.price)}</span>
                          </div>
                          <div className={tw("customer-cart-quantity")}>
                            <button aria-label={`Remove one ${item.name}`} onClick={() => updateQuantity(item.key, item.quantity - 1)} type="button">−</button>
                            <span>{item.quantity}</span>
                            <button aria-label={`Add one ${item.name}`} onClick={() => updateQuantity(item.key, item.quantity + 1)} type="button">+</button>
                          </div>
                          <strong className={tw("customer-cart-line-total")}>{formatMoney(item.quantity * item.price)}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className={tw("customer-cart-subtotal")}><span>Subtotal</span><strong>{formatMoney(cartSubtotal)}</strong></div>
                  <p className={tw("customer-cart-note")}>Sandbox checkout only. No real payment will be collected.</p>
                  {cartItems.length > 0 && !checkoutOpen && (
                    <button className={tw("customer-cart-checkout")} onClick={() => void openCheckout()} type="button">Continue to checkout</button>
                  )}
                  {location.pathname !== "/account/browse-order" && (
                    <Link className={tw("customer-cart-browse")} onClick={() => setCartOpen(false)} to="/account/browse-order">Browse order <span aria-hidden="true">→</span></Link>
                  )}
                </section>
              )}
            </div>
            <div className={tw("admin-account-menu")}>
              <button aria-expanded={accountMenuOpen} aria-haspopup="menu" className={tw("admin-account-trigger")} onClick={() => setAccountMenuOpen((open) => !open)} type="button">
                <span className={tw("admin-header-avatar")} aria-hidden="true">{user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "KA"}</span>
                <span className={tw("admin-header-account-copy")}><strong>{user.name}</strong><small>Customer account</small></span>
                <svg className={tw(`admin-account-chevron ${accountMenuOpen ? "admin-account-chevron-open" : ""}`)} aria-hidden="true" fill="none" viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" /></svg>
              </button>
              {accountMenuOpen && <div className={tw("admin-account-dropdown")} role="menu">
                <div className={tw("admin-account-dropdown-user")}><strong>{user.name}</strong><span>{user.email}</span></div>
                <Link className={tw("admin-account-dropdown-signout")} onClick={() => setAccountMenuOpen(false)} role="menuitem" to="/account/profile">My account</Link>
                <button className={tw("admin-account-dropdown-signout")} onClick={() => void handleSignOut()} role="menuitem" type="button">
                  <svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" /></svg>
                  Sign out
                </button>
              </div>}
            </div>
          </div>
        </header>

        {(checkoutOpen || checkoutSuccess) && (
          <div className={tw("customer-checkout-backdrop")}>
            <section
              aria-labelledby="customer-checkout-title"
              aria-modal="true"
              className={tw(`customer-checkout-modal ${checkoutSuccess ? "customer-checkout-modal-confirmation" : ""}`)}
              role="dialog"
            >
              {checkoutSuccess ? (
                <div className={tw("customer-order-confirmation")}>
                  <button
                    aria-label="Close order confirmation"
                    className={tw("customer-checkout-close")}
                    onClick={() => setCheckoutSuccess(null)}
                    type="button"
                  >×</button>
                  <span aria-hidden="true" className={tw("customer-confirmation-icon")}>
                    <svg fill="none" viewBox="0 0 32 32"><path d="m8 16 5 5L24 10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" /></svg>
                  </span>
                  <p className={tw("dashboard-section-kicker")}>ORDER CONFIRMED</p>
                  <h2 id="customer-checkout-title">Thank you for your order.</h2>
                  <p className={tw("customer-confirmation-copy")}>Your delivery order has been saved. Here is your confirmation for reference.</p>
                  <div className={tw("customer-confirmation-receipt")}>
                    <div><span>Order number</span><strong>{checkoutSuccess.orderNumber}</strong></div>
                    <div><span>Payment method</span><strong>{checkoutSuccess.paymentLabel}</strong></div>
                    <div><span>Order total</span><strong>{formatMoney(checkoutSuccess.total)}</strong></div>
                  </div>
                  <div className={tw("customer-sandbox-notice")} role="status">
                    <strong>Sandbox payment · No charge made</strong>
                    <span>{checkoutSuccess.message}</span>
                  </div>
                  <div className={tw("customer-confirmation-actions")}>
                    <button className={tw("customer-confirmation-button")} onClick={() => { setCheckoutSuccess(null); navigate("/account/orders"); }} type="button">Track your delivery</button>
                    <button className={tw("customer-confirmation-secondary")} onClick={() => setCheckoutSuccess(null)} type="button">Continue browsing</button>
                  </div>
                </div>
              ) : (
                <form className={tw("customer-checkout-dialog-form")} onSubmit={(event) => void submitCheckout(event)}>
                  <div className={tw("customer-checkout-modal-header")}>
                    <div>
                      <p className={tw("dashboard-section-kicker")}>DELIVERY ORDER</p>
                      <h2 id="customer-checkout-title">Checkout</h2>
                      <p>Almost there. Confirm where to deliver your order.</p>
                    </div>
                    <button
                      aria-label="Close checkout"
                      className={tw("customer-checkout-close")}
                      disabled={checkoutBusy}
                      onClick={() => { setCheckoutOpen(false); setCheckoutError(null); }}
                      type="button"
                    >×</button>
                  </div>
                  <div className={tw("customer-checkout-steps")} aria-label="Checkout progress">
                    <span className={tw("customer-checkout-step-complete")}><i>1</i> Cart</span>
                    <span className={tw("customer-checkout-step-active")}><i>2</i> Delivery & payment</span>
                    <span><i>3</i> Confirmation</span>
                  </div>
                  <div className={tw("customer-checkout-modal-body")}>
                    <div className={tw("customer-checkout-details")}>
                      <section className={tw("customer-checkout-section")}>
                        <div className={tw("customer-checkout-section-heading")}>
                          <span>01</span>
                          <div><h3>Contact & delivery</h3><p>We’ll use these details for this delivery.</p></div>
                        </div>
                        <div className={tw("customer-checkout-form-grid")}>
                          <label className={tw("customer-checkout-field")}><span>Recipient name</span><input autoComplete="name" onChange={(event) => setDeliveryDetails((current) => ({ ...current, recipient_name: event.target.value }))} required value={deliveryDetails.recipient_name} /></label>
                          <label className={tw("customer-checkout-field")}><span>Phone number</span><input autoComplete="tel" onChange={(event) => setDeliveryDetails((current) => ({ ...current, phone: event.target.value }))} required value={deliveryDetails.phone} /></label>
                          <label className={tw("customer-checkout-field-wide customer-checkout-field")}><span>Street address</span><input autoComplete="street-address" onChange={(event) => setDeliveryDetails((current) => ({ ...current, address_line: event.target.value }))} required value={deliveryDetails.address_line} /></label>
                          <label className={tw("customer-checkout-field-wide customer-checkout-field")}><span>Apartment, unit, etc. <small>Optional</small></span><input onChange={(event) => setDeliveryDetails((current) => ({ ...current, address_line_2: event.target.value }))} value={deliveryDetails.address_line_2} /></label>
                          <label className={tw("customer-checkout-field")}><span>City</span><input autoComplete="address-level2" onChange={(event) => setDeliveryDetails((current) => ({ ...current, city: event.target.value }))} required value={deliveryDetails.city} /></label>
                          <label className={tw("customer-checkout-field")}><span>Region <small>Optional</small></span><input autoComplete="address-level1" onChange={(event) => setDeliveryDetails((current) => ({ ...current, region: event.target.value }))} value={deliveryDetails.region} /></label>
                          <label className={tw("customer-checkout-field-wide customer-checkout-field")}><span>Postal code <small>Optional</small></span><input autoComplete="postal-code" onChange={(event) => setDeliveryDetails((current) => ({ ...current, postal_code: event.target.value }))} value={deliveryDetails.postal_code} /></label>
                          <label className={tw("customer-checkout-field-wide customer-checkout-field")}><span>Delivery instructions <small>Optional</small></span><textarea onChange={(event) => setDeliveryDetails((current) => ({ ...current, delivery_notes: event.target.value }))} value={deliveryDetails.delivery_notes} /></label>
                        </div>
                        <div className={tw("customer-location-consent")}>
                          <div>
                            <strong>Show my location on the delivery map</strong>
                            <span>{customerLocation ? "Your approximate pin is saved with this delivery and used for tracking." : "Optional. Add a pin to see your location alongside the driver."}</span>
                          </div>
                          {customerLocation ? (
                            <button onClick={() => setCustomerLocation(null)} type="button">Remove pin</button>
                          ) : (
                            <button disabled={locatingCustomer} onClick={useCurrentLocation} type="button">{locatingCustomer ? "Finding location…" : "Use my location"}</button>
                          )}
                          {customerLocationError && <p role="alert">{customerLocationError}</p>}
                        </div>
                      </section>
                      <section className={tw("customer-checkout-section")}>
                        <div className={tw("customer-checkout-section-heading")}>
                          <span>02</span>
                          <div><h3>Payment method</h3><p>Choose a simulated test method.</p></div>
                        </div>
                        {loadingPaymentMethods ? (
                          <p className={tw("customer-payment-loading")} role="status">Loading available methods…</p>
                        ) : paymentMethods?.length ? (
                          <div className={tw("customer-payment-options")}>
                            {paymentMethods.map((method) => (
                              <label className={tw(`customer-payment-option ${selectedPaymentMethod === method.code ? "customer-payment-option-selected" : ""}`)} key={method.code}>
                                <input
                                  checked={selectedPaymentMethod === method.code}
                                  name="payment_method"
                                  onChange={() => setSelectedPaymentMethod(method.code)}
                                  required
                                  type="radio"
                                  value={method.code}
                                />
                                <span className={tw("customer-payment-radio")} aria-hidden="true" />
                                <span className={tw("customer-payment-option-copy")}><strong>{method.label}</strong><small>Sandbox test · no real charge</small></span>
                                <span aria-hidden="true" className={tw("customer-payment-test-tag")}>TEST</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <p className={tw("customer-payment-loading")} role="alert">
                            {checkoutError ?? "No payment methods are enabled. Please contact the café."}
                          </p>
                        )}
                      </section>
                    </div>
                    <aside className={tw("customer-checkout-summary")}>
                      <p className={tw("dashboard-section-kicker")}>YOUR ORDER</p>
                      <h3>Order summary <span>{cartCount} item{cartCount === 1 ? "" : "s"}</span></h3>
                      <div className={tw("customer-checkout-summary-items")}>
                        {cartItems.map((item) => (
                          <div className={tw("customer-checkout-summary-item")} key={item.key}>
                            <span className={tw("customer-checkout-summary-quantity")}>{item.quantity}</span>
                            <span className={tw("customer-checkout-summary-name")}>
                              <strong>{item.name}</strong>
                              <small>{item.sizeName || "Standard"}</small>
                            </span>
                            <strong>{formatMoney(item.quantity * item.price)}</strong>
                          </div>
                        ))}
                      </div>
                      <div className={tw("customer-checkout-summary-total")}><span>Items subtotal</span><strong>{formatMoney(cartSubtotal)}</strong></div>
                      <p className={tw("customer-checkout-summary-note")}>Delivery fee and applicable taxes are calculated securely when you place the order.</p>
                      <div className={tw("customer-sandbox-notice")}>
                        <strong>Sandbox mode</strong>
                        <span>This is a simulated checkout. No real payment will be taken.</span>
                      </div>
                      {checkoutError && <p className={tw("customer-checkout-error")} role="alert">{checkoutError}</p>}
                      <button
                        className={tw("customer-confirmation-button")}
                        disabled={checkoutBusy || loadingPaymentMethods || !selectedPaymentMethod || !paymentMethods?.length}
                        type="submit"
                      >{checkoutBusy ? "Placing your order…" : "Place test order"} <span aria-hidden="true">→</span></button>
                      <p className={tw("customer-checkout-secure-note")}>Prices and availability are verified by the café when submitted.</p>
                    </aside>
                  </div>
                </form>
              )}
            </section>
          </div>
        )}

        {cartFlight && (
          <div
            aria-hidden="true"
            className={tw("customer-cart-flight")}
            ref={cartFlightRef}
            style={{ left: cartFlight.startX, top: cartFlight.startY }}
            title={`Adding ${cartFlight.name} to cart`}
          >
            {cartFlight.image ? (
              <img alt="" src={cartFlight.image} />
            ) : (
              <span>☕</span>
            )}
          </div>
        )}

        <div className={tw("dashboard-content")}>
          <section className={tw("dashboard-welcome")}>
            <div>
              <p className={tw("dashboard-eyebrow")}>{details.eyebrow}</p>
              <h1 className={tw("dashboard-welcome-title")}>{details.title}</h1>
              <p className={tw("dashboard-welcome-description")}>{details.description}{location.pathname === "/account" && user?.name ? ` Welcome, ${user.name.split(/\s+/)[0]}.` : ""}</p>
            </div>
            <Link className={tw("dashboard-order-button")} to="/account/browse-order">Order something lovely <span aria-hidden="true">→</span></Link>
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
                    <p className={tw("dashboard-empty-order-description")}>Your recent orders will appear here once order history is connected to your account.</p>
                  </div>
                  <Link className={tw("dashboard-empty-order-link")} to="/account/browse-order">Browse the menu</Link>
                </div>
              </section>
            </>
          )}

          {location.pathname === "/account/orders" && (
            <section className={tw("dashboard-panel dashboard-page-panel")}>
              {trackingError && <p className={tw("dashboard-error")} role="alert">{trackingError}</p>}
              {customerDeliveries.length > 0 ? (
                <div className={tw("customer-delivery-tracking-list")}>
                  <div className={tw("customer-tracking-intro")}>
                    <p className={tw("dashboard-section-kicker")}>ON THE WAY</p>
                    <h2 className={tw("dashboard-panel-title")}>Your active delivery</h2>
                    <p>Driver location refreshes automatically while they are sharing it.</p>
                  </div>
                  {customerDeliveries.map((delivery) => (
                    <Suspense fallback={<div className={tw("delivery-map-loading")} role="status">Loading delivery map…</div>} key={delivery.id}>
                      <DeliveryTrackingMap delivery={delivery} />
                    </Suspense>
                  ))}
                </div>
              ) : (
              <div className={tw("dashboard-empty-state")}>
                <span className={tw("dashboard-empty-icon")} aria-hidden="true">☕</span>
                <h2 className={tw("dashboard-empty-title")}>No active deliveries</h2>
                <p className={tw("dashboard-empty-description")}>When your order is out for delivery, you’ll see the driver’s live location and an approximate arrival estimate here.</p>
                <Link className={tw("dashboard-order-button")} to="/account/browse-order">Browse the menu <span aria-hidden="true">→</span></Link>
              </div>
              )}
            </section>
          )}

          {location.pathname === "/account/browse-order" && (
            <section className={tw("dashboard-panel dashboard-page-panel")}>
              <div style={{ display: "grid", gap: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                  <div>
                    <p className={tw("dashboard-section-kicker")}>DELIVERY</p>
                    <h2 className={tw("dashboard-panel-title")}>New delivery order</h2>
                  </div>
                  <span className={tw("dashboard-preview-tag")}>{cartCount} item{cartCount === 1 ? "" : "s"} selected</span>
                </div>

                {loadingProducts && <p style={{ fontSize: "12px", color: "#62615f" }}>Loading menu items from the café database…</p>}

                {!loadingProducts && menuItems.length === 0 && (
                  <p style={{ fontSize: "12px", color: "#62615f" }}>No available menu items were found in the database yet.</p>
                )}

                {!loadingProducts && menuItems.length > 0 && (
                  <div className={tw("customer-order-layout")}>
                    <nav className="customer-category-tabs-layout" aria-label="Product categories">
                      <button
                        aria-pressed={selectedCategory === "all"}
                        className={`customer-category-tab-control ${selectedCategory === "all" ? "is-selected" : ""}`}
                        onClick={() => setSelectedCategory("all")}
                        type="button"
                      >
                        All <span>{productCards.length}</span>
                      </button>
                      {visibleCategories.map((category) => {
                        const categoryId = String(category.id);
                        const categoryCount = productCards.filter((product) => product.categoryId === Number(category.id)).length;
                        const selected = selectedCategory === categoryId;

                        return (
                          <button
                            aria-pressed={selected}
                            className={`customer-category-tab-control ${selected ? "is-selected" : ""}`}
                            key={category.id}
                            onClick={() => setSelectedCategory(categoryId)}
                            type="button"
                          >
                            {String(category.name)} <span>{categoryCount}</span>
                          </button>
                        );
                      })}
                    </nav>
                    <div className="customer-product-grid-layout">
                      {visibleProductCards.map((product) => (
                      <article className={`${tw("customer-product-card")} customer-product-card-responsive`} key={product.id}>
                        <div className={tw("customer-product-image")}>
                        {product.image ? (
                          <img className={tw("customer-product-image-content")} src={product.image} alt={product.imageAlt} />
                        ) : (
                          <div className={tw("customer-product-image-placeholder")} role="img" aria-label={`${product.name}: no product image available`}>Image not available</div>
                        )}
                          <span className={tw("customer-product-image-badge")}>{product.tag}</span>
                        </div>
                        <div className={tw("customer-product-copy")}>
                          <div className={tw("customer-product-heading")}>
                            <h3 className={tw("customer-product-title")}>{product.name}</h3>
                            <span className={tw(`customer-product-status ${product.isAvailable ? "customer-product-status-available" : "customer-product-status-unavailable"}`)}>
                              {product.isAvailable ? "Available" : "Unavailable"}
                            </span>
                          </div>
                          <p className={tw("customer-product-description")} title={product.note}>{product.note}</p>
                          <div className={tw("customer-product-size-slot")}>
                          {product.sizes.length > 0 ? (
                            <label className={tw("customer-product-size")}>
                              <span className={tw("customer-product-size-label")}>Size</span>
                              <select
                                disabled={!product.isAvailable}
                                value={product.selectedSizeId ?? ""}
                                onChange={(event) => setSelectedSizes((current) => ({ ...current, [product.id]: Number(event.target.value) }))}
                              >
                                {product.sizes.map((size) => (
                                  <option key={size.id} value={size.id}>{String(size.name)} — {formatMoney(Number(size.price))}</option>
                                ))}
                              </select>
                            </label>
                          ) : (
                            <div className={tw("customer-product-size customer-product-size-standard")}>
                              <span className={tw("customer-product-size-label")}>Size</span>
                              <span>Standard</span>
                            </div>
                          )}
                          </div>
                          <div className={tw("customer-product-footer")}>
                            <strong className={tw("customer-product-price")}>{formatMoney(product.price)}</strong>
                            {!product.isAvailable ? (
                              <button type="button" className={tw("customer-product-unavailable")} disabled>Unavailable</button>
                            ) : product.quantity > 0 ? (
                              <div className={tw("customer-product-quantity")}>
                                <button type="button" onClick={() => updateQuantity(product.key, product.quantity - 1)} aria-label={`Decrease ${product.name} quantity`}>−</button>
                                <span>{product.quantity}</span>
                                <button type="button" onClick={() => updateQuantity(product.key, product.quantity + 1)} aria-label={`Increase ${product.name} quantity`}>+</button>
                              </div>
                            ) : (
                              <button type="button" className={tw("customer-product-add")} onClick={(event: MouseEvent<HTMLButtonElement>) => addItem(product.key, product.name, product.image, event.currentTarget)}>Add to cart <span aria-hidden="true">+</span></button>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                    </div>
                  </div>
                )}

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
