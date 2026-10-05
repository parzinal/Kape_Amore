export type AdminRecord = Record<string, unknown> & { id: number };

export type AdminWorkspace = {
  summary: {
    today_sales: number;
    today_orders: number;
    today_completed_orders: number;
    lifetime_sales: number;
    open_orders: number;
    low_stock: number;
    orders_by_type: Array<{ order_type: string; count: number }>;
    weekly_sales: Array<{ day: string; sales: number; orders: number }>;
    previous_weekly_sales: Array<{ day: string; sales: number; orders: number }>;
    recent_sales: AdminRecord[];
  };
  records: Record<string, AdminRecord[]>;
};

export type CustomerCatalog = {
  records: {
    products: AdminRecord[];
    categories: AdminRecord[];
    variations: AdminRecord[];
  };
};

export type PaymentMethod = {
  code: string;
  label: string;
  enabled: boolean;
  account_number?: string;
  image_url?: string;
};

export type CustomerCheckoutInput = {
  order_type: "dine_in" | "takeout";
  payment_method: string;
  items: Array<{ product_id: number; variation_id: number | null; quantity: number }>;
  recipient_name: string;
  phone: string;
  address_line: string;
  address_line_2?: string;
  city: string;
  region?: string;
  postal_code?: string;
  delivery_notes?: string;
  notes?: string;
  customer_latitude?: number;
  customer_longitude?: number;
};

export type CustomerDeliveryTracking = {
  id: number;
  order_id: number;
  order_number: string;
  status: string;
  total: number;
  rider_id: number | null;
  rider_name: string | null;
  rider_latitude: number | null;
  rider_longitude: number | null;
  rider_location_updated_at: string | null;
  customer_latitude: number | null;
  customer_longitude: number | null;
};

export type CustomerDeliveriesResponse = {
  deliveries: CustomerDeliveryTracking[];
};

export type CustomerCheckoutResult = {
  record: AdminRecord;
  message: string;
};

export const paymentMethodChoices: PaymentMethod[] = [
  { code: "cash", label: "Cash on delivery", enabled: true },
  { code: "card", label: "Card (sandbox)", enabled: true },
  { code: "e_wallet", label: "E-wallet (sandbox)", enabled: true },
  { code: "bank_transfer", label: "Bank transfer (sandbox)", enabled: true },
  { code: "other", label: "Other (sandbox)", enabled: true },
];

export function paymentMethodsFromSettings(settings: AdminRecord[]): PaymentMethod[] {
  const setting = settings.find((record) => record.key === "payment_methods");
  if (!setting) return paymentMethodChoices.map((method) => ({ ...method }));

  let configured: unknown = setting.value;
  if (typeof configured === "string") {
    try {
      configured = JSON.parse(configured);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(configured)) return [];

  return paymentMethodChoices.map((defaultMethod) => {
    const method = configured.find((candidate: unknown) => {
      return candidate !== null
        && typeof candidate === "object"
        && "code" in candidate
        && candidate.code === defaultMethod.code;
    });
    if (!method || typeof method !== "object" || !("label" in method) || !("enabled" in method)) {
      return { ...defaultMethod, enabled: false };
    }
    return {
      code: defaultMethod.code,
      label: typeof method.label === "string" && method.label.trim() ? method.label.trim() : defaultMethod.label,
      enabled: method.enabled === true,
      account_number: typeof method.account_number === "string" ? method.account_number.trim() : "",
      image_url: typeof method.image_url === "string" ? method.image_url.trim() : "",
    };
  });
}

export type AdminReport = {
  period: { from: string; to: string };
  sales: number;
  orders: number;
  by_type: Array<{ order_type: string; orders: number; sales: number }>;
  by_payment_method: Array<{ method: string; payments: number; total: number }>;
  by_category: Array<{ category: string; quantity: number; sales: number }>;
  by_employee: Array<{ name: string; orders: number; sales: number }>;
  best_sellers: Array<{ product_name: string; quantity: number; sales: number }>;
};

const apiOrigin = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "")
  ?? "http://127.0.0.1:8000";

export function adminImageUrl(path: string): string {
  if (/^(https?:)?\/\//.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path : `/storage/${path}`;
  return `${apiOrigin}${normalizedPath}`;
}

function csrfToken(): string | null {
  const cookie = document.cookie.split("; ").find((item) => item.startsWith("XSRF-TOKEN="));
  return cookie ? decodeURIComponent(cookie.slice("XSRF-TOKEN=".length)) : null;
}

async function messageFor(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  if (body && typeof body === "object" && "errors" in body) {
    const errors = (body as { errors?: Record<string, string[]> }).errors;
    const first = errors ? Object.values(errors).flat()[0] : undefined;
    if (first) return first;
  }
  if (body && typeof body === "object" && "message" in body && typeof body.message === "string") {
    return body.message;
  }
  return response.status === 401
    ? "Your session has expired. Sign in again."
    : "The server could not complete this request.";
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isFormData = init.body instanceof FormData;
  const response = await fetch(`${apiOrigin}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init.body && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...(csrfToken() ? { "X-XSRF-TOKEN": csrfToken()! } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error(await messageFor(response));
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function mutate<T>(path: string, method: string, body: unknown): Promise<T> {
  const csrf = await fetch(`${apiOrigin}/sanctum/csrf-cookie`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!csrf.ok) throw new Error("Unable to start a secure session. Check that the Laravel server is running.");
  if (body instanceof FormData) {
    if (!body.has("_method")) body.append("_method", method);
    return request<T>(path, { method: "POST", body });
  }
  return request<T>(path, { method, body: JSON.stringify(body) });
}

export const adminApi = {
  workspace: () => request<AdminWorkspace>("/api/admin/workspace"),
  report: (from: string, to: string) => request<AdminReport>(`/api/admin/reports?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  create: (resource: string, body: unknown) => mutate<{ record: AdminRecord }>(`/api/admin/records/${resource}`, "POST", body),
  update: (resource: string, id: number, body: unknown) => mutate<{ record: AdminRecord }>(`/api/admin/records/${resource}/${id}`, "PATCH", body),
  remove: (resource: string, id: number) => mutate<{ message: string }>(`/api/admin/records/${resource}/${id}`, "DELETE", {}),
  pay: (orderId: number, body: unknown) => mutate<{ record: AdminRecord }>(`/api/admin/orders/${orderId}/payments`, "POST", body),
  refund: (paymentId: number, body: unknown) => mutate<{ record: AdminRecord }>(`/api/admin/records/payments/${paymentId}`, "PATCH", body),
  assignModifiers: (productId: number, groupIds: number[]) => mutate<{ group_ids: number[] }>(`/api/admin/products/${productId}/modifier-groups`, "POST", { group_ids: groupIds }),
  assignTables: (orderId: number, tableIds: number[]) => mutate<{ table_ids: number[] }>(`/api/admin/orders/${orderId}/tables`, "POST", { table_ids: tableIds }),
  assignPermissions: (roleId: number, permissionIds: number[]) => mutate<{ permission_ids: number[] }>(`/api/admin/roles/${roleId}/permissions`, "POST", { permission_ids: permissionIds }),
  inventoryMovement: (ingredientId: number, body: unknown) => mutate<{ record: AdminRecord }>(`/api/admin/records/ingredients/${ingredientId}`, "PATCH", body),
  shareDeliveryLocation: (deliveryId: number, body: { latitude: number; longitude: number; accuracy?: number }) =>
    mutate<{ updated_at: string }>(`/api/driver/deliveries/${deliveryId}/location`, "POST", body),
};

export const customerApi = {
  landingImages: () => request<{ images: Record<string, string> }>("/api/landing-images"),
  catalog: () => request<CustomerCatalog>("/api/customer/catalog"),
  paymentMethods: () => request<{ methods: PaymentMethod[] }>("/api/customer/payment-methods"),
  checkout: (body: CustomerCheckoutInput) => mutate<CustomerCheckoutResult>("/api/customer/checkout", "POST", body),
  deliveries: () => request<CustomerDeliveriesResponse>("/api/customer/deliveries"),
};
