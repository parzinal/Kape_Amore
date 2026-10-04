import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { tw } from "../tw";
import { adminApi, adminImageUrl, paymentMethodChoices, paymentMethodsFromSettings } from "./adminApi";
import type { AdminRecord, AdminWorkspace, PaymentMethod } from "./adminApi";

type SelectOption = { value: string; label: string };
type ProductSizeDraft = { id?: number; name: string; sku: string; price: string; is_available: boolean };
type Field = {
  name: string;
  label: string;
  type?: "text" | "email" | "number" | "textarea" | "checkbox" | "select" | "password" | "date" | "image";
  required?: boolean;
  min?: string;
  options?: (workspace: AdminWorkspace) => SelectOption[];
};
type ResourceConfig = {
  title: string;
  resource: string;
  fields: Field[];
  columns: string[];
  readOnly?: boolean;
  createOnly?: boolean;
};

function money(value: number): string {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
}

function productImageUrl(path: string): string {
  return adminImageUrl(path);
}

const optionsFrom = (key: string, label: (record: AdminRecord) => string) =>
  (workspace: AdminWorkspace): SelectOption[] =>
    (workspace.records[key] ?? []).map((record) => ({ value: String(record.id), label: label(record) }));

const resourceConfigs: Record<string, ResourceConfig[]> = {
  menu: [
    { title: "Categories", resource: "categories", fields: [{ name: "name", label: "Category name", required: true }, { name: "slug", label: "URL slug" }, { name: "description", label: "Description", type: "textarea" }, { name: "sort_order", label: "Sort order", type: "number", min: "0" }, { name: "is_active", label: "Active", type: "checkbox" }], columns: ["name", "slug", "is_active"] },
    { title: "Products", resource: "products", fields: [{ name: "category_id", label: "Category", type: "select", required: true, options: optionsFrom("categories", (record) => String(record.name)) }, { name: "name", label: "Product name", required: true }, { name: "sku", label: "SKU" }, { name: "description", label: "Description", type: "textarea" }, { name: "image", label: "Product image", type: "image" }, { name: "is_available", label: "Available", type: "checkbox" }, { name: "sort_order", label: "Sort order", type: "number", min: "0" }], columns: ["name", "category_id", "sku", "base_price", "image_path", "is_available"] },
  ],
  tables: [
    { title: "Dining tables", resource: "tables", fields: [{ name: "name", label: "Table name", required: true }, { name: "capacity", label: "Seats", type: "number", min: "1", required: true }, { name: "status", label: "Status", type: "select", options: () => [{ value: "available", label: "Available" }, { value: "occupied", label: "Occupied" }, { value: "reserved", label: "Reserved" }] }, { name: "area", label: "Area" }, { name: "is_active", label: "Active", type: "checkbox" }], columns: ["name", "capacity", "status", "area", "is_active"] },
  ],
  customers: [
    { title: "Customer profiles", resource: "customers", fields: [{ name: "name", label: "Full name", required: true }, { name: "phone", label: "Phone" }, { name: "email", label: "Email", type: "email" }, { name: "notes", label: "Notes", type: "textarea" }], columns: ["name", "phone", "email", "loyalty_points"] },
    { title: "Customer addresses", resource: "addresses", fields: [{ name: "customer_id", label: "Customer", type: "select", required: true, options: optionsFrom("customers", (record) => String(record.name)) }, { name: "label", label: "Label" }, { name: "recipient_name", label: "Recipient name", required: true }, { name: "phone", label: "Phone", required: true }, { name: "address_line", label: "Address", required: true }, { name: "address_line_2", label: "Address line 2" }, { name: "city", label: "City", required: true }, { name: "region", label: "Region" }, { name: "postal_code", label: "Postal code" }, { name: "delivery_notes", label: "Delivery notes", type: "textarea" }, { name: "is_default", label: "Default address", type: "checkbox" }], columns: ["customer_id", "label", "recipient_name", "phone", "city", "is_default"] },
    { title: "Loyalty points adjustments", resource: "loyalty", fields: [{ name: "customer_id", label: "Customer", type: "select", required: true, options: optionsFrom("customers", (record) => String(record.name)) }, { name: "points_change", label: "Points (use a negative value to redeem)", type: "number", required: true }, { name: "type", label: "Transaction type", type: "select", required: true, options: () => ["earned", "redeemed", "adjustment", "expired"].map((value) => ({ value, label: value })) }, { name: "notes", label: "Notes", type: "textarea" }], columns: ["customer_id", "points_change", "type", "notes"], createOnly: true },
    { title: "Customer discounts", resource: "discounts", fields: [{ name: "name", label: "Discount name", required: true }, { name: "code", label: "Discount code" }, { name: "type", label: "Discount type", type: "select", required: true, options: () => [{ value: "fixed", label: "Fixed amount" }, { value: "percentage", label: "Percentage" }] }, { name: "value", label: "Value (₱ or percent)", type: "number", min: "0", required: true }, { name: "starts_at", label: "Starts at", type: "date" }, { name: "ends_at", label: "Ends at", type: "date" }, { name: "is_active", label: "Active", type: "checkbox" }], columns: ["name", "code", "type", "value", "starts_at", "ends_at", "is_active"] },
    { title: "Customer order history", resource: "orders", fields: [], columns: ["customer_id", "order_number", "order_type", "status", "total", "created_at"], readOnly: true },
  ],
  delivery: [],
  inventory: [
    { title: "Ingredients & stock levels", resource: "ingredients", fields: [{ name: "name", label: "Ingredient", required: true }, { name: "sku", label: "SKU" }, { name: "unit", label: "Base unit", type: "select", required: true, options: () => ["g", "kg", "ml", "l", "each"].map((value) => ({ value, label: value })) }, { name: "low_stock_threshold", label: "Low-stock threshold", type: "number", min: "0" }, { name: "cost_per_unit", label: "Cost per unit (₱)", type: "number", min: "0" }, { name: "is_active", label: "Active", type: "checkbox" }], columns: ["name", "sku", "unit", "quantity_on_hand", "low_stock_threshold", "cost_per_unit"] },
    { title: "Stock ledger", resource: "inventory-transactions", fields: [{ name: "ingredient_id", label: "Ingredient", type: "select", required: true, options: optionsFrom("ingredients", (record) => `${record.name} (${record.quantity_on_hand} ${record.unit})`) }, { name: "type", label: "Movement", type: "select", required: true, options: () => [{ value: "stock_in", label: "Stock in" }, { value: "adjustment", label: "Set balance" }, { value: "waste", label: "Waste" }, { value: "return", label: "Return" }] }, { name: "quantity", label: "Quantity", type: "number", min: "0.001", required: true }, { name: "reference", label: "Reference" }, { name: "notes", label: "Notes" }], columns: ["ingredient_id", "type", "quantity_change", "quantity_after", "reference", "created_at"], createOnly: true },
  ],
  team: [
    { title: "Staff accounts", resource: "staff", fields: [{ name: "name", label: "Full name", required: true }, { name: "email", label: "Email", type: "email", required: true }, { name: "password", label: "Initial password (minimum 12 characters)", type: "password", required: true }, { name: "role", label: "Role", type: "select", required: true, options: () => ["admin", "manager", "cashier", "staff"].map((value) => ({ value, label: value })) }], columns: ["name", "email", "role", "is_active", "created_at"] },
    { title: "Permission definitions", resource: "permissions", fields: [{ name: "name", label: "Permission key", required: true }, { name: "display_name", label: "Display name", required: true }], columns: ["name", "display_name"] },
    { title: "Activity log", resource: "activity", fields: [], columns: ["user_id", "action", "subject_type", "subject_id", "ip_address", "created_at"], readOnly: true },
  ],
  settings: [
    { title: "Shop & POS settings", resource: "settings", fields: [{ name: "key", label: "Setting key", required: true }, { name: "group", label: "Group", required: true }, { name: "value", label: "Value (JSON or plain text)", type: "textarea", required: true }], columns: ["key", "group", "value", "updated_at"] },
  ],
};

const catalogTabs = [
  { id: "categories", label: "Categories", resource: "categories" },
  { id: "products", label: "Products", resource: "products" },
] as const;

function MenuCatalog({ workspace, onRefresh }: { workspace: AdminWorkspace; onRefresh: () => Promise<void> }) {
  const [activeTab, setActiveTab] = useState<string>("products");
  const activeResource = catalogTabs.find((tab) => tab.id === activeTab)?.resource ?? "products";
  const config = resourceConfigs.menu.find((item) => item.resource === activeResource);

  return (
    <div className={tw("admin-sections")}>
      <section className={tw("admin-catalog-navigation")} aria-label="Menu catalog sections">
        <div className={tw("admin-catalog-tabs")} role="tablist" aria-label="Catalog sections">
          {catalogTabs.map((tab) => {
            const selected = tab.id === activeTab;
            return <button
              aria-controls="admin-catalog-panel"
              aria-selected={selected}
              className={tw(`admin-catalog-tab ${selected ? "admin-catalog-tab-active" : ""}`)}
              id={`catalog-tab-${tab.id}`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              type="button"
            >
              {tab.label}<span>{(workspace.records[tab.resource] ?? []).length}</span>
            </button>;
          })}
        </div>
      </section>
      {config && <div aria-labelledby={`catalog-tab-${activeTab}`} className={tw("admin-catalog-panel")} id="admin-catalog-panel" role="tabpanel">
        <ResourcePanel config={config} onRefresh={onRefresh} workspace={workspace} />
      </div>}
    </div>
  );
}

const labels: Record<string, string> = {
  category_id: "category_id", product_id: "product_id", product_variation_id: "product_variation_id",
  modifier_group_id: "modifier_group_id", customer_id: "customer_id", recipe_id: "recipe_id",
  ingredient_id: "ingredient_id", order_id: "order_id", customer_address_id: "customer_address_id",
};

function relationLabel(key: string, id: unknown, workspace: AdminWorkspace): string {
  const target = labels[key];
  if (!target || id === null || id === undefined) return String(id ?? "—");
  const keyByTable: Record<string, string> = {
    category_id: "categories", product_id: "products", product_variation_id: "variations",
    modifier_group_id: "modifier-groups", customer_id: "customers", recipe_id: "recipes",
    ingredient_id: "ingredients", order_id: "orders", customer_address_id: "addresses",
  };
  const record = workspace.records[keyByTable[target]]?.find((item) => item.id === Number(id));
  return String(record?.name ?? record?.order_number ?? record?.address_line ?? id);
}

function displayValue(key: string, value: unknown, workspace: AdminWorkspace): string {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "is_active" || key === "is_available" || key === "is_required" || key === "is_default") return value ? "Yes" : "No";
  if (["category_id", "product_id", "product_variation_id", "modifier_group_id", "customer_id", "recipe_id", "ingredient_id", "order_id", "customer_address_id"].includes(key)) {
    return relationLabel(key, value, workspace);
  }
  if (key === "value" && typeof value === "string") {
    try { return JSON.stringify(JSON.parse(value)); } catch { return value; }
  }
  return String(value);
}

function defaultForm(fields: Field[], record?: AdminRecord): Record<string, string | boolean> {
  return Object.fromEntries(fields.map((field) => {
    const value = record?.[field.name];
    if (field.type === "checkbox") return [field.name, value === undefined ? ["is_active", "is_available"].includes(field.name) : Boolean(value)];
    if (field.name === "value" && typeof value === "string") {
      try { return [field.name, JSON.stringify(JSON.parse(value))]; } catch { return [field.name, value]; }
    }
    if (field.type === "date" && typeof value === "string") return [field.name, value.slice(0, 10)];
    return [field.name, value === null || value === undefined ? "" : String(value)];
  }));
}

function ResourcePanel({
  config,
  workspace,
  onRefresh,
  children,
}: {
  config: ResourceConfig;
  workspace: AdminWorkspace;
  onRefresh: () => Promise<void>;
  children?: ReactNode;
}) {
  const [editing, setEditing] = useState<AdminRecord | null>(null);
  const [form, setForm] = useState<Record<string, string | boolean>>(() => defaultForm(config.fields));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [productImage, setProductImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [priceMode, setPriceMode] = useState<"single" | "size">("single");
  const [productSizes, setProductSizes] = useState<ProductSizeDraft[]>([]);
  const records = workspace.records[config.resource] ?? [];

  useEffect(() => {
    if (!productImage) {
      setImagePreview(null);
      return;
    }
    const preview = URL.createObjectURL(productImage);
    setImagePreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [productImage]);

  useEffect(() => {
    if (!success) return;
    const timeout = window.setTimeout(() => setSuccess(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [success]);

  function beginEdit(record: AdminRecord) {
    setEditing(record);
    setForm({ ...defaultForm(config.fields, record), ...(config.resource === "products" ? { base_price: String(record.base_price ?? "") } : {}) });
    if (config.resource === "products") {
      const sizes = (workspace.records.variations ?? []).filter((size) => size.product_id === record.id);
      setProductSizes(sizes.map((size) => ({
        id: size.id,
        name: String(size.name ?? ""),
        sku: String(size.sku ?? ""),
        price: String(size.price ?? ""),
        is_available: Boolean(size.is_available),
      })));
      setPriceMode(sizes.some((size) => size.is_available) ? "size" : "single");
    }
    setProductImage(null);
    setError(null);
  }

  function cancelEdit() {
    setEditing(null);
    setForm(defaultForm(config.fields));
    setProductImage(null);
    setPriceMode("single");
    setProductSizes([]);
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (config.resource === "products" && priceMode === "size" && !productSizes.some((size) => size.is_available && size.name.trim() && size.price !== "")) {
      setError("Add at least one available size and enter its price.");
      return;
    }
    setBusy(true);
    const addingProduct = config.resource === "products" && editing === null;
    const payload: Record<string, unknown> = {};
    for (const field of config.fields) {
      if (field.type === "image") continue;
      const value = form[field.name];
      if (field.type === "checkbox") {
        payload[field.name] = Boolean(value);
      } else if (typeof value === "string" && value !== "") {
        if (field.type === "number" || field.type === "select") payload[field.name] = Number(value);
        else if (field.name === "value") {
          try { payload[field.name] = JSON.parse(value); } catch { payload[field.name] = value; }
        } else payload[field.name] = value;
      } else if (field.required) {
        payload[field.name] = value;
      }
    }
    if (config.resource === "products") {
      const activeSizes = productSizes.filter((size) => size.is_available);
      payload.pricing_mode = priceMode;
      payload.sizes = priceMode === "size" ? productSizes : [];
      payload.base_price = priceMode === "size"
        ? Math.min(...activeSizes.map((size) => Number(size.price)))
        : Number(form.base_price);
    }

    try {
      if (config.resource === "inventory-transactions") {
        const ingredientId = Number(payload.ingredient_id);
        delete payload.ingredient_id;
        await adminApi.inventoryMovement(ingredientId, payload);
      } else if (config.resource === "products") {
        const body = new FormData();
        for (const [key, value] of Object.entries(payload)) {
          body.append(key, Array.isArray(value) ? JSON.stringify(value) : typeof value === "boolean" ? (value ? "1" : "0") : String(value));
        }
        if (productImage) body.append("image", productImage);
        if (editing && !config.createOnly) body.append("_method", "PATCH");
        if (editing && !config.createOnly) await adminApi.update(config.resource, editing.id, body);
        else await adminApi.create(config.resource, body);
      } else if (editing && !config.createOnly) {
        await adminApi.update(config.resource, editing.id, payload);
      } else {
        await adminApi.create(config.resource, payload);
      }
      await onRefresh();
      cancelEdit();
      if (addingProduct) setSuccess("Product added successfully.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save this record.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(record: AdminRecord) {
    if (!window.confirm(`Delete this ${config.title.toLowerCase()} record?`)) return;
    setError(null);
    try {
      await adminApi.remove(config.resource, record.id);
      await onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to delete this record.");
    }
  }

  return (
    <section className={tw("dashboard-panel admin-resource-panel")} aria-label={config.title}>
      {success && <div className={tw("admin-success-toast")} role="status">
        <span aria-hidden="true">✓</span>
        <strong>{success}</strong>
        <button aria-label="Dismiss success message" onClick={() => setSuccess(null)} type="button">×</button>
      </div>}
      <div className={tw("dashboard-panel-heading")}>
        <div>
          <p className={tw("dashboard-section-kicker")}>MANAGE RECORDS</p>
          <h2 className={tw("dashboard-panel-title")}>{config.title}</h2>
        </div>
        <span className={tw("admin-count")}>{records.length} records</span>
      </div>

      {!config.readOnly && config.fields.length > 0 && (
        <form className={tw("admin-record-form")} onSubmit={(event) => void submit(event)}>
          {config.fields.map((field) => (
            <label className={tw(field.type === "checkbox" ? "admin-field-checkbox" : `admin-field ${field.type === "textarea" ? "admin-field-wide" : ""}`)} key={field.name}>
              {field.type === "checkbox" ? (
                <><input checked={Boolean(form[field.name])} name={field.name} onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.checked }))} type="checkbox" /><span>{field.label}</span></>
              ) : (
                <>
                  <span>{field.label}</span>
                  {field.type === "textarea" ? (
                    <textarea name={field.name} onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))} required={field.required} value={String(form[field.name] ?? "")} />
                  ) : field.type === "image" ? (
                    <div className={tw("admin-product-image-picker")}>
                      {(imagePreview || (Boolean(editing?.image_path) && !productImage)) && <img alt="Product preview" src={imagePreview ?? productImageUrl(String(editing?.image_path ?? ""))} />}
                      <span>{productImage?.name ?? (editing?.image_path ? "Current product image" : "No image selected")}</span>
                      <input accept="image/jpeg,image/png,image/webp" aria-label="Choose product image" onChange={(event) => setProductImage(event.target.files?.[0] ?? null)} type="file" />
                      <small>JPG, PNG, or WebP · up to 5 MB</small>
                    </div>
                  ) : field.type === "select" ? (
                    <select name={field.name} onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))} required={field.required} value={String(form[field.name] ?? "")}>
                      <option value="">Select…</option>
                      {(field.options?.(workspace) ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  ) : (
                    <input
                      autoComplete={field.type === "password" ? "new-password" : undefined}
                      min={field.min}
                      name={field.name}
                      onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}
                      required={field.required && !(editing && field.type === "password")}
                      type={field.type ?? "text"}
                      value={String(form[field.name] ?? "")}
                    />
                  )}
                </>
              )}
            </label>
          ))}
          {config.resource === "products" && (
            <div className={tw("admin-product-pricing")}>
              <label className={tw("admin-field")}>
                <span>Pricing</span>
                <select onChange={(event) => setPriceMode(event.target.value as "single" | "size")} value={priceMode}>
                  <option value="single">Single price · food or no size</option>
                  <option value="size">Different price per size · drinks</option>
                </select>
              </label>
              {priceMode === "single" ? (
                <label className={tw("admin-field")}>
                  <span>Price (₱)</span>
                  <input min="0" name="base_price" onChange={(event) => setForm((current) => ({ ...current, base_price: event.target.value }))} required type="number" value={String(form.base_price ?? "")} />
                </label>
              ) : (
                <div className={tw("admin-product-size-editor")}>
                  <div><strong>Size prices</strong><span>Each size gets its own price.</span></div>
                  {productSizes.map((size, index) => (
                    <div className={tw("admin-product-size-row")} key={size.id ?? `new-${index}`}>
                      <label><span>Size name</span><select onChange={(event) => setProductSizes((current) => current.map((item, row) => row === index ? { ...item, name: event.target.value } : item))} required value={size.name}>
                        <option value="">Select size</option>
                        {!["Small", "Medium", "Large"].includes(size.name) && size.name && <option value={size.name}>{size.name}</option>}
                        <option value="Small">Small</option>
                        <option value="Medium">Medium</option>
                        <option value="Large">Large</option>
                      </select></label>
                      <label><span>Price (₱)</span><input min="0" onChange={(event) => setProductSizes((current) => current.map((item, row) => row === index ? { ...item, price: event.target.value } : item))} required type="number" value={size.price} /></label>
                      <label className={tw("admin-field-checkbox")}><input checked={size.is_available} onChange={(event) => setProductSizes((current) => current.map((item, row) => row === index ? { ...item, is_available: event.target.checked } : item))} type="checkbox" /><span>Available</span></label>
                      <button aria-label={`Remove ${size.name || "size"}`} className={tw("admin-text-button admin-delete-button")} onClick={() => setProductSizes((current) => current.filter((_, row) => row !== index))} type="button">Remove</button>
                    </div>
                  ))}
                  <button className={tw("admin-secondary-button")} onClick={() => setProductSizes((current) => [...current, { name: "", sku: "", price: "", is_available: true }])} type="button">Add size</button>
                </div>
              )}
            </div>
          )}
          {error && <p className={tw("admin-form-error")} role="alert">{error}</p>}
          <div className={tw("admin-form-actions")}>
            <button className={tw("admin-primary-button")} disabled={busy} type="submit">{busy ? "Saving…" : editing && !config.createOnly ? "Save changes" : "Add record"}</button>
            {editing && !config.createOnly && <button className={tw("admin-secondary-button")} onClick={cancelEdit} type="button">Cancel</button>}
          </div>
        </form>
      )}

      {config.resource === "inventory-transactions" && (
        <p className={tw("admin-form-help")}>Stock in, waste, and returns use a positive quantity. “Set balance” sets the new on-hand quantity.</p>
      )}

      {children}
      {error && (config.readOnly || config.fields.length === 0) && <p className={tw("admin-form-error")} role="alert">{error}</p>}
      <div className={tw("admin-table-wrap")}>
        <table className={tw("admin-table")}>
          <thead><tr>{config.columns.map((column) => <th key={column}>{config.resource === "products" && column === "base_price" ? "price" : column.replace(/_/g, " ")}</th>)}{!config.readOnly && <th>Actions</th>}</tr></thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                {config.columns.map((column) => <td key={column}>{displayValue(column, record[column], workspace)}</td>)}
                {!config.readOnly && <td><div className={tw("admin-row-actions")}>
                  {!config.createOnly && <button className={tw("admin-text-button")} onClick={() => beginEdit(record)} type="button">Edit</button>}
                  <button className={tw("admin-text-button admin-delete-button")} onClick={() => void remove(record)} type="button">Delete</button>
                </div></td>}
              </tr>
            ))}
            {records.length === 0 && <tr><td className={tw("admin-table-empty")} colSpan={config.columns.length + (config.readOnly ? 0 : 1)}>No records yet. Add one above to get started.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RolePermissionPanel({ workspace, onRefresh }: { workspace: AdminWorkspace; onRefresh: () => Promise<void> }) {
  const [roleId, setRoleId] = useState("");
  const [permissionIds, setPermissionIds] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const roles = workspace.records.roles ?? [];
  const permissions = workspace.records.permissions ?? [];
  const assignments = workspace.records["role-permissions"] ?? [];

  useEffect(() => {
    setPermissionIds(assignments.filter((item) => item.role_id === Number(roleId)).map((item) => Number(item.permission_id)));
  }, [roleId, workspace]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminApi.assignPermissions(Number(roleId), permissionIds);
      await onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save role permissions.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={tw("dashboard-panel admin-resource-panel")} aria-label="Role permissions">
      <div className={tw("dashboard-panel-heading")}><div><p className={tw("dashboard-section-kicker")}>ACCESS CONTROL</p><h2 className={tw("dashboard-panel-title")}>Permissions by role</h2></div></div>
      <form className={tw("admin-assignment-form")} onSubmit={(event) => void save(event)}>
        <label className={tw("admin-field")}><span>Role</span><select className={tw("admin-input")} onChange={(event) => setRoleId(event.target.value)} required value={roleId}><option value="">Select role…</option>{roles.map((role) => <option key={role.id} value={role.id}>{String(role.display_name)}</option>)}</select></label>
        <div className={tw("admin-checkbox-list")}>{permissions.map((permission) => <label className={tw("admin-assignment-checkbox")} key={permission.id}><input checked={permissionIds.includes(permission.id)} onChange={(event) => setPermissionIds((current) => event.target.checked ? [...current, permission.id] : current.filter((id) => id !== permission.id))} type="checkbox" /><span>{String(permission.display_name)}</span></label>)}{permissions.length === 0 && <p className={tw("admin-empty-copy")}>Add permission definitions above to assign access.</p>}</div>
        {error && <p className={tw("admin-form-error")} role="alert">{error}</p>}
        <button className={tw("admin-primary-button")} disabled={busy || !roleId} type="submit">{busy ? "Saving…" : "Save role permissions"}</button>
      </form>
    </section>
  );
}

function OrderManagement({ workspace, onRefresh, showOrderCreator, showOrders }: {
  workspace: AdminWorkspace;
  onRefresh: () => Promise<void>;
  showOrderCreator: boolean;
  showOrders: boolean;
}) {
  const emptyLine = () => ({ product_id: "", variation_id: "", quantity: "1", modifier_option_ids: [] as number[] });
  const [lines, setLines] = useState([emptyLine()]);
  const [orderType, setOrderType] = useState("dine_in");
  const [customerId, setCustomerId] = useState("");
  const [addressId, setAddressId] = useState("");
  const [tableIds, setTableIds] = useState<number[]>([]);
  const [notes, setNotes] = useState("");
  const [orderTables, setOrderTables] = useState<Record<number, string[]>>({});
  const [itemQuantities, setItemQuantities] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [tendered, setTendered] = useState("");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [discountId, setDiscountId] = useState("");
  const [pendingCheckoutOrder, setPendingCheckoutOrder] = useState<AdminRecord | null>(null);

  const products = workspace.records.products ?? [];
  const variations = workspace.records.variations ?? [];
  const orders = workspace.records.orders ?? [];
  const customers = workspace.records.customers ?? [];
  const addresses = workspace.records.addresses ?? [];
  const discounts = workspace.records.discounts ?? [];
  const modifierOptions = workspace.records["modifier-options"] ?? [];
  const modifierGroups = workspace.records["modifier-groups"] ?? [];
  const modifierAssignments = workspace.records["modifier-assignments"] ?? [];
  const tables = workspace.records.tables ?? [];
  const tableAssignments = workspace.records["table-assignments"] ?? [];
  const orderItems = workspace.records["order-items"] ?? [];
  const itemModifiers = workspace.records["order-item-modifiers"] ?? [];
  const categories = workspace.records.categories ?? [];
  const availablePaymentMethods = paymentMethodsFromSettings(workspace.records.settings ?? []).filter((method) => method.enabled);
  const selectedPaymentMethod = availablePaymentMethods.some((method) => method.code === paymentMethod)
    ? paymentMethod
    : availablePaymentMethods[0]?.code ?? "";
  const availableProducts = products.filter((product) => product.is_available);
  const filteredProducts = availableProducts.filter((product) =>
    (!categoryId || String(product.category_id) === categoryId)
      && String(product.name).toLowerCase().includes(search.trim().toLowerCase()),
  );
  const linePrice = (line: (typeof lines)[number]) => {
    const product = products.find((record) => record.id === Number(line.product_id));
    const variation = variations.find((record) => record.id === Number(line.variation_id));
    const modifierPrice = line.modifier_option_ids.reduce((total, id) => {
      const option = modifierOptions.find((record) => record.id === id);
      return total + Number(option?.price_adjustment ?? 0);
    }, 0);
    return Number(variation?.price ?? product?.base_price ?? 0) + modifierPrice;
  };
  const subtotal = lines.reduce((total, line) => total + linePrice(line) * Number(line.quantity || 0), 0);
  const settingNumber = (key: string) => {
    const raw = workspace.records.settings?.find((setting) => setting.key === key)?.value;
    if (raw === undefined) return 0;
    try {
      const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
      const value = Number(parsed);
      return Number.isFinite(value) ? value : 0;
    } catch {
      return 0;
    }
  };
  const selectedDiscount = discounts.find((discount) => discount.id === Number(discountId) && discount.is_active);
  const discountTotal = selectedDiscount
    ? selectedDiscount.type === "percentage"
      ? Math.round(subtotal * Math.min(Number(selectedDiscount.value), 100)) / 100
      : Math.min(Number(selectedDiscount.value), subtotal)
    : 0;
  const taxEstimate = subtotal * settingNumber("tax_rate") / 100;
  const serviceEstimate = subtotal * settingNumber("service_charge_rate") / 100;
  const deliveryEstimate = orderType === "delivery" ? settingNumber("delivery_fee") : 0;
  const totalEstimate = Math.max(0, subtotal - discountTotal + taxEstimate + serviceEstimate + deliveryEstimate);

  function addProduct(product: AdminRecord) {
    const defaultSize = variations
      .filter((variation) => variation.product_id === product.id && variation.is_available)
      .sort((left, right) => Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0))[0];
    const variationId = defaultSize ? String(defaultSize.id) : "";
    setLines((current) => {
      const existingIndex = current.findIndex((line) => Number(line.product_id) === product.id && line.variation_id === variationId && line.modifier_option_ids.length === 0);
      if (existingIndex < 0) return [...current.filter((line) => line.product_id), { product_id: String(product.id), variation_id: variationId, quantity: "1", modifier_option_ids: [] }];
      return current.map((line, index) => index === existingIndex ? { ...line, quantity: String(Number(line.quantity) + 1) } : line);
    });
  }

  function resetCart() {
    setLines([]);
    setNotes("");
    setTableIds([]);
    setDiscountId("");
    setTendered("");
    setCustomerId("");
    setAddressId("");
  }

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lines.every((line) => !line.product_id)) {
      setError("Add at least one product to the order.");
      return;
    }
    const canTakePayment = workspace.records.payments !== undefined;
    if (canTakePayment && selectedPaymentMethod === "cash" && Number(tendered) < totalEstimate) {
      setError(`Cash received must be at least ${money(totalEstimate)}.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let order = pendingCheckoutOrder;
      if (!order) {
        const result = await adminApi.create("orders", {
          order_type: orderType,
          customer_id: customerId ? Number(customerId) : null,
          address_id: orderType === "delivery" ? Number(addressId) : undefined,
          status: canTakePayment ? "confirmed" : "draft",
          notes: notes || null,
          discount_id: discountId ? Number(discountId) : null,
          table_ids: orderType === "dine_in" ? tableIds : [],
          items: lines.filter((line) => line.product_id).map((line) => ({
            product_id: Number(line.product_id),
            variation_id: line.variation_id ? Number(line.variation_id) : null,
            quantity: Number(line.quantity),
            modifier_option_ids: line.modifier_option_ids,
          })),
        });
        order = result.record;
        setPendingCheckoutOrder(order);
      }
      if (canTakePayment) {
        await adminApi.pay(order.id, {
          method: selectedPaymentMethod,
          amount: Number(order.total),
          tendered_amount: selectedPaymentMethod === "cash" ? Number(tendered) : undefined,
        });
      }
      setPendingCheckoutOrder(null);
      resetCart();
      await onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create the order.");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(order: AdminRecord, next: string) {
    setBusy(true);
    setError(null);
    try {
      await adminApi.update("orders", order.id, { status: next });
      await onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update order status.");
    } finally {
      setBusy(false);
    }
  }

  async function changeTables(order: AdminRecord) {
    setBusy(true);
    setError(null);
    try {
      await adminApi.assignTables(order.id, (orderTables[order.id] ?? []).map(Number));
      await onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update table assignment.");
    } finally {
      setBusy(false);
    }
  }

  async function changeItemQuantity(itemId: number) {
    setBusy(true);
    setError(null);
    try {
      await adminApi.update("order-items", itemId, { quantity: Number(itemQuantities[itemId]) });
      await onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update order quantity.");
    } finally {
      setBusy(false);
    }
  }

  function printReceipt(order: AdminRecord) {
    const popup = window.open("", "_blank", "width=420,height=680");
    if (!popup) {
      setError("Allow pop-ups for this page to print receipts.");
      return;
    }
    const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[character] ?? character);
    const orderLines = orderItems.filter((item) => item.order_id === order.id);
    const rows = orderLines.map((item) => {
      const modifiers = itemModifiers.filter((modifier) => modifier.order_item_id === item.id).map((modifier) => `${escape(modifier.option_name)} (${money(Number(modifier.price_adjustment))})`).join(", ");
      return `<tr><td>${escape(item.quantity)} × ${escape(item.product_name)}${item.variation_name ? ` · ${escape(item.variation_name)}` : ""}${modifiers ? `<small>${modifiers}</small>` : ""}</td><td>${money(Number(item.line_total))}</td></tr>`;
    }).join("");
    popup.document.write(`<!doctype html><html><head><title>${escape(order.order_number)} receipt</title><style>body{font:14px Arial,sans-serif;color:#211f1e;max-width:360px;margin:24px auto}h1,p{text-align:center}h1{font-size:20px}table{width:100%;border-collapse:collapse}td{border-bottom:1px dashed #aaa;padding:8px 0}td:last-child{text-align:right;white-space:nowrap}small{display:block;color:#666}.total{font-weight:bold;font-size:17px}</style></head><body><h1>Kape Amore</h1><p>Order ${escape(order.order_number)}<br>${escape(order.order_type)} · ${escape(order.created_at)}</p><table>${rows}<tr><td>Subtotal</td><td>${money(Number(order.subtotal))}</td></tr><tr><td>Discount</td><td>-${money(Number(order.discount_total))}</td></tr><tr><td>Tax & service</td><td>${money(Number(order.tax_total) + Number(order.service_charge_total))}</td></tr><tr><td>Delivery</td><td>${money(Number(order.delivery_fee))}</td></tr><tr class="total"><td>Total</td><td>${money(Number(order.total))}</td></tr></table><p>Thank you for visiting!</p><script>window.onload=()=>window.print()</script></body></html>`);
    popup.document.close();
  }

  const nextStatuses: Record<string, string> = { draft: "confirmed", held: "confirmed", confirmed: "preparing", preparing: "ready", ready: "served", served: "completed" };

  return (
    <>
      {showOrderCreator && <form className={tw("admin-pos-layout")} onSubmit={(event) => void createOrder(event)}>
        <section className={tw("admin-pos-products")} aria-label="Available products">
          <div className={tw("admin-pos-products-heading")}><div><h2>Product</h2><p>Choose items to add to this order</p></div>
            <label className={tw("admin-pos-search")}><span aria-hidden="true">⌕</span><input aria-label="Search products" onChange={(event) => setSearch(event.target.value)} placeholder="Search products..." value={search} /></label>
          </div>
          <div className={tw("admin-category-list")} aria-label="Product categories">
            <button className={tw(`admin-category-chip ${categoryId ? "" : "admin-category-chip-active"}`)} onClick={() => setCategoryId("")} type="button">Show all</button>
            {categories.filter((category) => category.is_active).map((category) => <button className={tw(`admin-category-chip ${categoryId === String(category.id) ? "admin-category-chip-active" : ""}`)} key={category.id} onClick={() => setCategoryId(String(category.id))} type="button">{String(category.name)}</button>)}
          </div>
          <div className={tw("admin-pos-product-grid")}>
            {filteredProducts.map((product) => {
              const category = categories.find((item) => item.id === product.category_id);
              const hasModifier = modifierAssignments.some((assignment) => assignment.product_id === product.id);
              const productSizes = variations.filter((variation) => variation.product_id === product.id && variation.is_available);
              const imagePath = String(product.image_path ?? "");
              const imageUrl = imagePath ? productImageUrl(imagePath) : "";
              const addThisProduct = () => {
                if (!busy && !pendingCheckoutOrder) addProduct(product);
              };
              return <article
                aria-disabled={busy || Boolean(pendingCheckoutOrder)}
                aria-label={`Add ${String(product.name)} to order${productSizes.length ? `. Sizes available: ${productSizes.map((size) => String(size.name)).join(", ")}` : ""}`}
                className={tw("admin-pos-product-card")}
                key={product.id}
                onClick={addThisProduct}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    addThisProduct();
                  }
                }}
                role="button"
                tabIndex={busy || pendingCheckoutOrder ? -1 : 0}
              >
                <div className={tw("admin-pos-product-image")}>
                  {imageUrl ? <img alt="" loading="lazy" src={imageUrl} /> : <span aria-hidden="true">☕</span>}
                  <span className={tw("admin-pos-availability")}>{product.is_available ? "Available" : "Unavailable"}</span>
                </div>
                <div className={tw("admin-pos-product-info")}><strong>{String(product.name)}</strong><span>{String(category?.name ?? "Kape Amore")}{hasModifier ? " · Customizable" : ""}</span>
                  <span className={tw("admin-pos-product-sizes")}>{productSizes.length ? `Sizes: ${productSizes.map((size) => String(size.name)).join(", ")}` : "No size"}</span>
                </div>
                <div className={tw("admin-pos-product-actions")}><b>{money(Number(product.base_price))}{productSizes.length ? "+" : ""}</b><span>{productSizes.length ? "Starting price" : "Price"}</span></div>
              </article>;
            })}
            {filteredProducts.length === 0 && <p className={tw("admin-pos-empty")}>{products.length ? "No products match your search." : "Add available products in Menu & Catalog to begin taking orders."}</p>}
          </div>
        </section>

        <aside className={tw("admin-pos-order")} aria-label="Order details">
          <div className={tw("admin-pos-order-heading")}><div><h2>Order Detail</h2><span>{lines.filter((line) => line.product_id).reduce((sum, line) => sum + Number(line.quantity), 0)} items selected</span></div><button aria-label="Clear order" className={tw("admin-pos-clear")} disabled={!lines.some((line) => line.product_id) || Boolean(pendingCheckoutOrder)} onClick={resetCart} type="button">Clear all</button></div>
          <section className={tw("admin-pos-customer")}><h3>Customer Information</h3>
            <label className={tw("admin-pos-customer-field")}><span>Customer name</span><select disabled={Boolean(pendingCheckoutOrder)} onChange={(event) => { setCustomerId(event.target.value); setAddressId(""); }} value={customerId}><option value="">Walk-in customer</option>{customers.map((item) => <option key={item.id} value={item.id}>{String(item.name)}</option>)}</select></label>
            <div className={tw("admin-pos-select-row")}>
              <label className={tw("admin-pos-customer-field")}><span>Order type</span><select disabled={Boolean(pendingCheckoutOrder)} onChange={(event) => { setOrderType(event.target.value); setTableIds([]); }} value={orderType}>{[["dine_in", "Dine in"], ["takeout", "Takeout"], ["delivery", "Delivery"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              {orderType === "dine_in" && <label className={tw("admin-pos-customer-field")}><span>Select table</span><select disabled={Boolean(pendingCheckoutOrder)} onChange={(event) => setTableIds(event.target.value ? [Number(event.target.value)] : [])} value={tableIds[0] ?? ""}><option value="">Choose table</option>{tables.filter((table) => (table.status === "available" || tableIds.includes(table.id)) && table.is_active).map((table) => <option key={table.id} value={table.id}>{String(table.name)} · {String(table.capacity)} seats</option>)}</select></label>}
              {orderType === "delivery" && <label className={tw("admin-pos-customer-field")}><span>Delivery address</span><select disabled={Boolean(pendingCheckoutOrder)} onChange={(event) => setAddressId(event.target.value)} required value={addressId}><option value="">Choose address</option>{addresses.filter((item) => !customerId || item.customer_id === Number(customerId)).map((item) => <option key={item.id} value={item.id}>{String(item.address_line)}, {String(item.city)}</option>)}</select></label>}
            </div>
          </section>

          <div className={tw("admin-pos-cart")}>
            {lines.filter((line) => line.product_id).map((line, index) => {
              const product = products.find((item) => item.id === Number(line.product_id));
              if (!product) return null;
              const productGroups = modifierGroups.filter((group) => modifierAssignments.some((assignment) => assignment.product_id === product.id && assignment.modifier_group_id === group.id));
              const productVariations = variations.filter((variation) => variation.product_id === product.id && variation.is_available);
              return <article className={tw("admin-pos-cart-item")} key={`${line.product_id}-${index}`}>
                <div className={tw("admin-pos-cart-thumb")} aria-hidden="true">{product.image_path ? <img alt="" src={productImageUrl(String(product.image_path))} /> : "☕"}</div>
                <div className={tw("admin-pos-cart-copy")}><strong>{String(product.name)}</strong><span>{line.variation_id ? String(variations.find((item) => item.id === Number(line.variation_id))?.name ?? "") : "Single price"}</span>
                  {productVariations.length > 0 && <label className={tw("admin-pos-variation")}><span>Size</span><select aria-label={`Size for ${String(product.name)}`} disabled={Boolean(pendingCheckoutOrder)} onChange={(event) => setLines((current) => current.map((item, lineIndex) => lineIndex === index ? { ...item, variation_id: event.target.value } : item))} value={line.variation_id}>{productVariations.map((variation) => <option key={variation.id} value={variation.id}>{String(variation.name)} · {money(Number(variation.price))}</option>)}</select></label>}
                  {productGroups.length > 0 && <details className={tw("admin-pos-customize")}><summary>Customize</summary>
                    {productGroups.map((group) => <label key={group.id}><span>{String(group.name)}{group.is_required ? " · required" : ""}</span><select aria-label={`${String(group.name)} for ${String(product.name)}`} disabled={Boolean(pendingCheckoutOrder)} multiple onChange={(event) => {
                      const selectedForGroup = Array.from(event.target.selectedOptions, (option) => Number(option.value));
                      const otherSelections = line.modifier_option_ids.filter((id) => modifierOptions.find((option) => option.id === id)?.modifier_group_id !== group.id);
                      setLines((current) => current.map((item, lineIndex) => lineIndex === index ? { ...item, modifier_option_ids: [...otherSelections, ...selectedForGroup] } : item));
                    }} value={line.modifier_option_ids.filter((id) => modifierOptions.find((option) => option.id === id)?.modifier_group_id === group.id).map(String)}>
                      {modifierOptions.filter((option) => option.modifier_group_id === group.id && option.is_available).map((option) => <option key={option.id} value={option.id}>{String(option.name)}{Number(option.price_adjustment) ? ` + ${money(Number(option.price_adjustment))}` : ""}</option>)}
                    </select></label>)}
                  </details>}
                  <div className={tw("admin-pos-quantity")}><button aria-label={`Decrease ${String(product.name)} quantity`} disabled={Boolean(pendingCheckoutOrder)} onClick={() => setLines((current) => current.flatMap((item, lineIndex) => {
                    if (lineIndex !== index) return [item];
                    const next = Number(item.quantity) - 1;
                    return next > 0 ? [{ ...item, quantity: String(next) }] : [];
                  }))} type="button">−</button><span>{line.quantity}</span><button aria-label={`Increase ${String(product.name)} quantity`} disabled={Boolean(pendingCheckoutOrder)} onClick={() => setLines((current) => current.map((item, lineIndex) => lineIndex === index ? { ...item, quantity: String(Number(item.quantity) + 1) } : item))} type="button">+</button></div>
                </div>
                <div className={tw("admin-pos-line-total")}><button aria-label={`Remove ${String(product.name)}`} disabled={Boolean(pendingCheckoutOrder)} onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))} type="button">×</button><strong>{money(linePrice(line) * Number(line.quantity))}</strong></div>
              </article>;
            })}
            {!lines.some((line) => line.product_id) && <p className={tw("admin-pos-cart-empty")}>Your order is empty. Add a product to get started.</p>}
          </div>

          <div className={tw("admin-pos-promo")}><label><span aria-hidden="true">✦</span><select aria-label="Apply promotion" disabled={Boolean(pendingCheckoutOrder)} onChange={(event) => setDiscountId(event.target.value)} value={discountId}><option value="">Apply a promotion</option>{discounts.filter((discount) => discount.is_active).map((discount) => <option key={discount.id} value={discount.id}>{String(discount.name)} · {discount.type === "percentage" ? `${discount.value}%` : money(Number(discount.value))}</option>)}</select></label>{discountId && <button onClick={() => setDiscountId("")} type="button">Remove</button>}</div>
          <label className={tw("admin-pos-notes")}><span>Order notes</span><input disabled={Boolean(pendingCheckoutOrder)} onChange={(event) => setNotes(event.target.value)} placeholder="Optional notes for this order" value={notes} /></label>
          <div className={tw("admin-pos-totals")}><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>{selectedDiscount && <div><span>Discount · {String(selectedDiscount.name)}</span><strong>−{money(discountTotal)}</strong></div>}
            {workspace.records.settings && <><div><span>Tax ({settingNumber("tax_rate")}%)</span><strong>{money(taxEstimate)}</strong></div>{serviceEstimate > 0 && <div><span>Service charge</span><strong>{money(serviceEstimate)}</strong></div>}</>}
            {orderType === "delivery" && <div><span>Delivery fee (estimate)</span><strong>{money(deliveryEstimate)}</strong></div>}
            <div className={tw("admin-pos-grand-total")}><span>{pendingCheckoutOrder ? `Order total · ${String(pendingCheckoutOrder.order_number)}` : "Total"}</span><strong>{money(Number(pendingCheckoutOrder?.total ?? totalEstimate))}</strong></div>
          </div>
          {workspace.records.payments !== undefined && <div className={tw("admin-pos-tender")}><label><span>Payment method</span><select disabled={Boolean(pendingCheckoutOrder) || availablePaymentMethods.length === 0} onChange={(event) => setPaymentMethod(event.target.value)} value={selectedPaymentMethod}>{availablePaymentMethods.map((method) => <option key={method.code} value={method.code}>{method.label}</option>)}</select></label>
            {selectedPaymentMethod === "cash" && <label><span>Cash received</span><input min="0" onChange={(event) => setTendered(event.target.value)} placeholder={money(Number(pendingCheckoutOrder?.total ?? totalEstimate))} step="0.01" type="number" value={tendered} /></label>}
          </div>}
          {workspace.records.payments !== undefined && availablePaymentMethods.length === 0 && <p className={tw("admin-form-help")}>Enable at least one payment method in Settings before taking payment.</p>}
          {pendingCheckoutOrder && <p className={tw("admin-pos-pending-note")} role="status">Order created but payment is not confirmed yet. Correct the payment details and retry; this will not create a duplicate order.</p>}
          {error && <p className={tw("admin-form-error")} role="alert">{error}</p>}
          <button className={tw("admin-pos-checkout")} disabled={busy || !lines.some((line) => line.product_id) || (workspace.records.payments !== undefined && !selectedPaymentMethod)} type="submit"><span>▣</span>{busy ? "Processing…" : pendingCheckoutOrder ? "Retry Payment" : workspace.records.payments !== undefined ? "Process Transaction" : "Create Order"}</button>
        </aside>
      </form>}

      {error && <p className={tw("admin-form-error")} role="alert">{error}</p>}
      {showOrders && <section className={tw("dashboard-panel admin-resource-panel")} aria-label="Orders">
        <div className={tw("dashboard-panel-heading")}><div><p className={tw("dashboard-section-kicker")}>ORDER HISTORY</p><h2 className={tw("dashboard-panel-title")}>Orders</h2></div><span className={tw("admin-count")}>{orders.length}</span></div>
        <div className={tw("admin-table-wrap")}><table className={tw("admin-table")}><thead><tr>{["order_number", "order_type", "status", "subtotal", "discount_total", "total", "created_at"].map((column) => <th key={column}>{column.replace(/_/g, " ")}</th>)}<th>Items</th>{showOrderCreator && <><th>Tables</th><th>Workflow</th></>}</tr></thead>
          <tbody>{orders.map((order) => <tr key={order.id}>
            <td>{String(order.order_number)}</td><td>{String(order.order_type).replace(/_/g, " ")}</td><td>{String(order.status)}</td><td>₱{Number(order.subtotal).toFixed(2)}</td><td>₱{Number(order.discount_total).toFixed(2)}</td><td>₱{Number(order.total).toFixed(2)}</td><td>{String(order.created_at).slice(0, 16)}</td>
            <td><details><summary>{orderItems.filter((item) => item.order_id === order.id).length} items</summary>{orderItems.filter((item) => item.order_id === order.id).map((item) => <div className={tw("admin-order-item-edit")} key={item.id}><span>{String(item.product_name)}</span>{showOrderCreator && <><input aria-label={`Quantity for ${String(item.product_name)}`} className={tw("admin-input")} min="0.001" onChange={(event) => setItemQuantities((current) => ({ ...current, [item.id]: event.target.value }))} step="0.001" type="number" value={itemQuantities[item.id] ?? String(item.quantity)} /><button className={tw("admin-text-button")} disabled={busy || !["draft", "held"].includes(String(order.status))} onClick={() => void changeItemQuantity(item.id)} type="button">Save</button></>}</div>)}</details></td>
            {showOrderCreator && <><td>{order.order_type === "dine_in" && !["completed", "cancelled"].includes(String(order.status)) ? <div className={tw("admin-table-assignment")}><select aria-label={`Tables for ${String(order.order_number)}`} className={tw("admin-input")} multiple onChange={(event) => setOrderTables((current) => ({ ...current, [order.id]: Array.from(event.target.selectedOptions, (option) => option.value) }))} value={orderTables[order.id] ?? tableAssignments.filter((assignment) => assignment.order_id === order.id && !assignment.released_at).map((assignment) => String(assignment.dining_table_id))}>{tables.filter((table) => table.status === "available" || tableAssignments.some((assignment) => assignment.order_id === order.id && assignment.dining_table_id === table.id && !assignment.released_at)).map((table) => <option key={table.id} value={table.id}>{String(table.name)}</option>)}</select><button className={tw("admin-text-button")} disabled={busy} onClick={() => void changeTables(order)} type="button">Save tables</button></div> : "—"}</td>
              <td><button className={tw("admin-text-button")} onClick={() => printReceipt(order)} type="button">Receipt</button>{order.status === "draft" && <button className={tw("admin-text-button")} disabled={busy} onClick={() => void changeStatus(order, "held")} type="button">Hold</button>}{order.status === "held" && <button className={tw("admin-text-button")} disabled={busy} onClick={() => void changeStatus(order, "draft")} type="button">Resume</button>}{nextStatuses[String(order.status)] && <button className={tw("admin-text-button")} disabled={busy} onClick={() => void changeStatus(order, nextStatuses[String(order.status)])} type="button">Mark {nextStatuses[String(order.status)]}</button>}{order.status !== "completed" && order.status !== "cancelled" && <button className={tw("admin-text-button admin-delete-button")} disabled={busy} onClick={() => void changeStatus(order, "cancelled")} type="button">Cancel</button>}</td></>}
          </tr>)}{orders.length === 0 && <tr><td className={tw("admin-table-empty")} colSpan={showOrderCreator ? 10 : 8}>No orders yet. Create one above to start a sale.</td></tr>}</tbody></table></div>
      </section>}

      <ResourcePanel config={{ title: "Payments", resource: "payments", fields: [], columns: ["order_id", "method", "status", "amount", "tendered_amount", "change_amount", "reference_number", "paid_at"], readOnly: true }} onRefresh={onRefresh} workspace={workspace} />
      <RefundPanel workspace={workspace} onRefresh={onRefresh} />
    </>
  );
}

function RefundPanel({ workspace, onRefresh }: { workspace: AdminWorkspace; onRefresh: () => Promise<void> }) {
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const payments = workspace.records.payments ?? [];
  const refunds = workspace.records.refunds ?? [];

  async function refund(event: FormEvent<HTMLFormElement>, payment: AdminRecord) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminApi.refund(payment.id, { amount: Number(amounts[payment.id] || payment.amount), reason: reasons[payment.id] });
      await onRefresh();
      setAmounts((current) => ({ ...current, [payment.id]: "" }));
      setReasons((current) => ({ ...current, [payment.id]: "" }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to refund this payment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ResourcePanel config={{ title: "Refunds", resource: "refunds", fields: [], columns: ["payment_id", "amount", "reason", "status", "refunded_at"], readOnly: true }} onRefresh={onRefresh} workspace={workspace}>
      {payments.filter((payment) => ["completed", "partially_refunded"].includes(String(payment.status))).length > 0 && (
        <div className={tw("admin-refund-list")}>
          {error && <p className={tw("admin-form-error")} role="alert">{error}</p>}
          {payments.filter((payment) => ["completed", "partially_refunded"].includes(String(payment.status))).map((payment) => {
            const refunded = refunds.filter((refundRecord) => refundRecord.payment_id === payment.id).reduce((sum, refundRecord) => sum + Number(refundRecord.amount), 0);
            const remaining = Math.max(0, Number(payment.amount) - refunded);
            return <form className={tw("admin-refund-form")} key={payment.id} onSubmit={(event) => void refund(event, payment)}>
              <strong>Payment #{payment.id} · remaining ₱{remaining.toFixed(2)}</strong>
              <input aria-label="Refund amount" min="0.01" max={remaining} onChange={(event) => setAmounts((current) => ({ ...current, [payment.id]: event.target.value }))} placeholder={`Up to ₱${remaining.toFixed(2)}`} step="0.01" type="number" value={amounts[payment.id] ?? ""} />
              <input aria-label="Refund reason" onChange={(event) => setReasons((current) => ({ ...current, [payment.id]: event.target.value }))} placeholder="Reason for refund" required value={reasons[payment.id] ?? ""} />
              <button className={tw("admin-secondary-button")} disabled={busy || remaining <= 0} type="submit">Refund</button>
            </form>;
          })}
        </div>
      )}
    </ResourcePanel>
  );
}

function PaymentMethodPanel({ workspace, onRefresh }: { workspace: AdminWorkspace; onRefresh: () => Promise<void> }) {
  const setting = workspace.records.settings?.find((record) => record.key === "payment_methods");
  const readMethods = () => {
    const configured = paymentMethodsFromSettings(workspace.records.settings ?? []);
    return configured.length > 0 ? configured : paymentMethodChoices.map((method) => ({ ...method }));
  };
  const [methods, setMethods] = useState<PaymentMethod[]>(readMethods);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setMethods(readMethods());
  }, [setting?.id, setting?.updated_at, setting?.value]);

  function updateMethod(code: string, changes: Partial<PaymentMethod>) {
    setMethods((current) => current.map((method) => method.code === code ? { ...method, ...changes } : method));
  }

  async function saveMethods() {
    setError(null);
    setSuccess(null);
    if (!methods.some((method) => method.enabled)) {
      setError("Keep at least one payment method enabled.");
      return;
    }
    if (methods.some((method) => !method.label.trim() || method.label.length > 80)) {
      setError("Each enabled or disabled method needs a label of 1 to 80 characters.");
      return;
    }
    setBusy(true);
    try {
      const payload = { key: "payment_methods", group: "payments", value: methods };
      if (setting) await adminApi.update("settings", setting.id, payload);
      else await adminApi.create("settings", payload);
      await onRefresh();
      setSuccess("Sandbox payment methods saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save payment methods.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Sandbox payment methods" className={tw("dashboard-panel admin-resource-panel")}>
      <div className={tw("dashboard-panel-heading")}>
        <div>
          <p className={tw("dashboard-section-kicker")}>SANDBOX CHECKOUT</p>
          <h2 className={tw("dashboard-panel-title")}>Payment methods</h2>
        </div>
      </div>
      <p className={tw("admin-form-help")}>Manage the options shown at customer checkout and the POS. These are simulations only; no real payments are collected.</p>
      {setting && paymentMethodsFromSettings([setting]).length === 0 && <p className={tw("admin-form-error")} role="alert">The saved payment-method setting is invalid. Review these options and save to replace it with a valid configuration.</p>}
      <div className={tw("admin-payment-method-list")}>
        {paymentMethodChoices.map((choice) => {
          const method = methods.find((entry) => entry.code === choice.code) ?? choice;
          return (
            <div className={tw("admin-payment-method-row")} key={choice.code}>
              <label className={tw("admin-field")}>
                <span>{choice.label}</span>
                <input
                  maxLength={80}
                  onChange={(event) => updateMethod(choice.code, { label: event.target.value })}
                  value={method.label}
                />
              </label>
              <label className={tw("admin-field-checkbox")}>
                <input
                  checked={method.enabled}
                  onChange={(event) => updateMethod(choice.code, { enabled: event.target.checked })}
                  type="checkbox"
                />
                <span>Enabled</span>
              </label>
            </div>
          );
        })}
      </div>
      {error && <p className={tw("admin-form-error")} role="alert">{error}</p>}
      {success && <p className={tw("admin-form-help")} role="status">{success}</p>}
      <button className={tw("admin-primary-button")} disabled={busy} onClick={() => void saveMethods()} type="button">
        {busy ? "Saving…" : "Save payment methods"}
      </button>
    </section>
  );
}

export function AdminFeaturePanel({
  section,
  workspace,
  onRefresh,
  currentUserId,
}: {
  section: string;
  workspace: AdminWorkspace;
  onRefresh: () => Promise<void>;
  currentUserId?: number;
}) {
  if (section === "sales") return <OrderManagement onRefresh={onRefresh} showOrderCreator showOrders={false} workspace={workspace} />;
  if (section === "payments") return <OrderManagement onRefresh={onRefresh} showOrderCreator={false} showOrders workspace={workspace} />;
  if (section === "menu") return <MenuCatalog onRefresh={onRefresh} workspace={workspace} />;
  if (section === "delivery") return (
    <div className={tw("admin-sections")}>
      <DeliveryManagementPanel onRefresh={onRefresh} workspace={workspace} />
      {currentUserId !== undefined && <RiderLocationPanel currentUserId={currentUserId} workspace={workspace} />}
    </div>
  );
  const configs = resourceConfigs[section] ?? [];
  if (configs.length === 0) return null;
  return (
    <div className={tw("admin-sections")}>
      {configs.map((config) => <ResourcePanel config={config} key={config.resource} onRefresh={onRefresh} workspace={workspace} />)}
      {section === "settings" && <PaymentMethodPanel onRefresh={onRefresh} workspace={workspace} />}
      {section === "team" && <RolePermissionPanel onRefresh={onRefresh} workspace={workspace} />}
    </div>
  );
}

const deliveryStatusChoices: Record<string, string[]> = {
  pending: ["pending", "preparing", "cancelled"],
  preparing: ["preparing", "ready", "cancelled"],
  ready: ["ready", "assigned", "cancelled"],
  assigned: ["assigned", "out_for_delivery", "cancelled"],
  out_for_delivery: ["out_for_delivery", "delivered", "cancelled"],
  delivered: ["delivered"],
  cancelled: ["cancelled"],
};

function DeliveryManagementPanel({ workspace, onRefresh }: { workspace: AdminWorkspace; onRefresh: () => Promise<void> }) {
  const deliveries = workspace.records.deliveries ?? [];
  const orders = workspace.records.orders ?? [];
  const [changes, setChanges] = useState<Record<number, { status: string; rider_id: string }>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<number | null>(null);

  function defaultSelection(delivery: AdminRecord) {
    return {
      status: String(delivery.status),
      rider_id: delivery.rider_id === null || delivery.rider_id === undefined ? "" : String(delivery.rider_id),
    };
  }

  function selectionFor(delivery: AdminRecord) {
    return changes[delivery.id] ?? defaultSelection(delivery);
  }

  async function saveDelivery(delivery: AdminRecord) {
    const selected = selectionFor(delivery);
    if (selected.status === "assigned" && !selected.rider_id) {
      setError("Choose a driver before assigning this delivery.");
      return;
    }

    setBusyId(delivery.id);
    setError(null);
    setSuccessId(null);
    try {
      await adminApi.update("deliveries", delivery.id, {
        status: selected.status,
        rider_id: selected.rider_id ? Number(selected.rider_id) : null,
      });
      await onRefresh();
      setChanges((current) => {
        const updated = { ...current };
        delete updated[delivery.id];
        return updated;
      });
      setSuccessId(delivery.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update this delivery.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section aria-label="Delivery orders" className={tw("dashboard-panel admin-resource-panel")}>
      <div className={tw("dashboard-panel-heading")}>
        <div>
          <p className={tw("dashboard-section-kicker")}>DELIVERY QUEUE</p>
          <h2 className={tw("dashboard-panel-title")}>Manage deliveries</h2>
        </div>
        <span className={tw("admin-count")}>{deliveries.length} order{deliveries.length === 1 ? "" : "s"}</span>
      </div>
      <p className={tw("admin-form-help")}>Delivery orders appear here automatically after customer checkout. Update the status and assign a driver; customer addresses are managed under Customers.</p>
      {error && <p className={tw("admin-form-error")} role="alert">{error}</p>}
      <div className={tw("admin-delivery-list")}>
        {deliveries.map((delivery) => {
          const selected = selectionFor(delivery);
          const order = orders.find((record) => record.id === Number(delivery.order_id));
          const currentStatus = String(delivery.status);
          const options = deliveryStatusChoices[currentStatus] ?? [currentStatus];
          const hasChanges = selected.status !== currentStatus
            || selected.rider_id !== (delivery.rider_id === null || delivery.rider_id === undefined ? "" : String(delivery.rider_id));
          const rider = (workspace.records["delivery-riders"] ?? []).find((record) => record.id === Number(delivery.rider_id));
          return (
            <article className={tw("admin-delivery-card")} key={delivery.id}>
              <div className={tw("admin-delivery-card-heading")}>
                <div>
                  <p className={tw("dashboard-section-kicker")}>{String(order?.order_number ?? `Order #${delivery.order_id}`)}</p>
                  <h3>{String(delivery.recipient_name)}</h3>
                </div>
                <span className={tw("admin-delivery-card-total")}>{money(Number(order?.total ?? 0))}</span>
              </div>
              <div className={tw("admin-delivery-address")}>
                <strong>Deliver to</strong>
                <span>{String(delivery.address_snapshot)}</span>
                {delivery.delivery_notes && <small>Note: {String(delivery.delivery_notes)}</small>}
                <a href={`tel:${String(delivery.recipient_phone)}`}>{String(delivery.recipient_phone)}</a>
              </div>
              <div className={tw("admin-delivery-controls")}>
                <label className={tw("admin-field")}>
                  <span>Status</span>
                  <select
                    onChange={(event) => setChanges((current) => ({ ...current, [delivery.id]: { ...(current[delivery.id] ?? defaultSelection(delivery)), status: event.target.value } }))}
                    value={selected.status}
                  >
                    {options.map((status) => <option key={status} value={status}>{status.replace(/_/g, " ")}</option>)}
                  </select>
                </label>
                <label className={tw("admin-field")}>
                  <span>Driver</span>
                  <select
                    onChange={(event) => setChanges((current) => ({ ...current, [delivery.id]: { ...(current[delivery.id] ?? defaultSelection(delivery)), rider_id: event.target.value } }))}
                    value={selected.rider_id}
                  >
                    <option value="">Unassigned</option>
                    {(workspace.records["delivery-riders"] ?? []).map((staff) => <option key={staff.id} value={staff.id}>{String(staff.name)}</option>)}
                  </select>
                </label>
                <button
                  className={tw("admin-primary-button admin-delivery-save")}
                  disabled={busyId !== null || !hasChanges}
                  onClick={() => void saveDelivery(delivery)}
                  type="button"
                >{busyId === delivery.id ? "Saving…" : successId === delivery.id ? "Saved" : "Save"}</button>
              </div>
              {rider && <p className={tw("admin-delivery-current-driver")}>Currently assigned to {String(rider.name)}</p>}
            </article>
          );
        })}
        {deliveries.length === 0 && <p className={tw("admin-delivery-empty")}>No delivery orders yet. Customer delivery checkouts will appear here.</p>}
      </div>
    </section>
  );
}

function RiderLocationPanel({ workspace, currentUserId }: { workspace: AdminWorkspace; currentUserId: number }) {
  const [sharingDeliveryId, setSharingDeliveryId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);
  const sendingLocation = useRef(false);
  const lastSentAt = useRef(0);
  const assignedDeliveries = (workspace.records.deliveries ?? []).filter((delivery) =>
    Number(delivery.rider_id) === currentUserId
      && delivery.status === "out_for_delivery",
  );

  function stopSharing() {
    if (watchId.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    sendingLocation.current = false;
    setSharingDeliveryId(null);
    setMessage("Location sharing stopped. Your last location remains visible with its update time.");
  }

  useEffect(() => () => {
    if (watchId.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId.current);
  }, []);

  function startSharing(deliveryId: number) {
    setError(null);
    setMessage(null);
    if (!navigator.geolocation) {
      setError("This browser does not support location sharing.");
      return;
    }
    if (!window.isSecureContext) {
      setError("Your browser requires a secure HTTPS connection to share location.");
      return;
    }

    setSharingDeliveryId(deliveryId);
    setLastUpdate(null);
    lastSentAt.current = 0;
    watchId.current = navigator.geolocation.watchPosition(
      async (position) => {
        if (sendingLocation.current || Date.now() - lastSentAt.current < 5000) return;
        sendingLocation.current = true;
        try {
          await adminApi.shareDeliveryLocation(deliveryId, {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
          lastSentAt.current = Date.now();
          setLastUpdate(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" }));
          setMessage("Your live location is being shared with this delivery’s customer.");
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "Unable to update your location.");
          if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
          watchId.current = null;
          setSharingDeliveryId(null);
        } finally {
          sendingLocation.current = false;
        }
      },
      (cause) => {
        const messageByCode: Record<number, string> = {
          1: "Location permission was denied. Allow location access in your browser to share your route.",
          2: "Your current location could not be determined. Check your device’s location settings.",
          3: "Location request timed out. Try sharing again.",
        };
        setError(messageByCode[cause.code] ?? "Unable to read your current location.");
        if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
        setSharingDeliveryId(null);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
  }

  return (
    <section aria-label="Driver location sharing" className={tw("dashboard-panel admin-resource-panel rider-location-panel")}>
      <div className={tw("dashboard-panel-heading")}>
        <div>
          <p className={tw("dashboard-section-kicker")}>DRIVER TOOLS</p>
          <h2 className={tw("dashboard-panel-title")}>Share your live location</h2>
        </div>
        <span className={tw("admin-count")}>{assignedDeliveries.length} active route{assignedDeliveries.length === 1 ? "" : "s"}</span>
      </div>
      <p className={tw("admin-form-help")}>Location is sent only while you choose to share it. Keep this page open while delivering; customers see updates on their order tracking page.</p>
      {assignedDeliveries.length === 0 ? (
        <p className={tw("admin-empty-copy")}>You have no deliveries assigned to you that are currently out for delivery.</p>
      ) : assignedDeliveries.map((delivery) => (
        <div className={tw("rider-location-row")} key={delivery.id}>
          <div>
            <strong>Order {String((workspace.records.orders ?? []).find((order) => order.id === delivery.order_id)?.order_number ?? delivery.order_id)}</strong>
            <span>{String(delivery.recipient_name)} · {String(delivery.address_snapshot)}</span>
          </div>
          {sharingDeliveryId === delivery.id ? (
            <button className={tw("admin-secondary-button rider-location-stop")} onClick={stopSharing} type="button">Stop sharing</button>
          ) : (
            <button className={tw("admin-primary-button rider-location-start")} disabled={sharingDeliveryId !== null} onClick={() => startSharing(delivery.id)} type="button">Start location sharing</button>
          )}
        </div>
      ))}
      {lastUpdate && <p className={tw("rider-location-state")} role="status">Last sent at {lastUpdate}.</p>}
      {message && <p className={tw("rider-location-state")} role="status">{message}</p>}
      {error && <p className={tw("admin-form-error")} role="alert">{error}</p>}
    </section>
  );
}
