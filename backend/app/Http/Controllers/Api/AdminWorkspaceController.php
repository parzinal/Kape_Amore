<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AdminWorkspaceController extends Controller
{
    private const RESOURCES = [
        'categories' => [
            'table' => 'categories',
            'fields' => ['name', 'slug', 'description', 'sort_order', 'is_active'],
            'rules' => ['name' => 'required|string|max:120', 'slug' => 'nullable|string|max:140', 'description' => 'nullable|string', 'sort_order' => 'nullable|integer|min:0|max:65535', 'is_active' => 'sometimes|boolean'],
            'soft_delete' => true,
        ],
        'products' => [
            'table' => 'products',
            'fields' => ['category_id', 'name', 'sku', 'description', 'image_path', 'base_price', 'is_available', 'sort_order'],
            'rules' => ['category_id' => 'required|integer|exists:categories,id', 'name' => 'required|string|max:160', 'sku' => 'nullable|string|max:80', 'description' => 'nullable|string', 'image_path' => 'nullable|string|max:500', 'base_price' => 'required|numeric|min:0', 'is_available' => 'sometimes|boolean', 'sort_order' => 'nullable|integer|min:0|max:65535'],
            'soft_delete' => true,
        ],
        'variations' => [
            'table' => 'product_variations',
            'fields' => ['product_id', 'name', 'sku', 'price', 'is_available', 'sort_order'],
            'rules' => ['product_id' => 'required|integer|exists:products,id', 'name' => 'required|string|max:100', 'sku' => 'nullable|string|max:80', 'price' => 'required|numeric|min:0', 'is_available' => 'sometimes|boolean', 'sort_order' => 'nullable|integer|min:0|max:65535'],
        ],
        'modifier-groups' => [
            'table' => 'modifier_groups',
            'fields' => ['name', 'min_select', 'max_select', 'is_required', 'is_active'],
            'rules' => ['name' => 'required|string|max:120', 'min_select' => 'nullable|integer|min:0|max:255', 'max_select' => 'nullable|integer|min:1|max:255', 'is_required' => 'sometimes|boolean', 'is_active' => 'sometimes|boolean'],
        ],
        'modifier-options' => [
            'table' => 'modifier_options',
            'fields' => ['modifier_group_id', 'name', 'price_adjustment', 'is_available', 'sort_order'],
            'rules' => ['modifier_group_id' => 'required|integer|exists:modifier_groups,id', 'name' => 'required|string|max:120', 'price_adjustment' => 'required|numeric|min:0', 'is_available' => 'sometimes|boolean', 'sort_order' => 'nullable|integer|min:0|max:65535'],
        ],
        'customers' => [
            'table' => 'customers',
            'fields' => ['name', 'phone', 'email', 'notes'],
            'rules' => ['name' => 'required|string|max:160', 'phone' => 'nullable|string|max:30', 'email' => 'nullable|email|max:255', 'notes' => 'nullable|string'],
            'soft_delete' => true,
        ],
        'addresses' => [
            'table' => 'customer_addresses',
            'fields' => ['customer_id', 'label', 'recipient_name', 'phone', 'address_line', 'address_line_2', 'city', 'region', 'postal_code', 'delivery_notes', 'is_default'],
            'rules' => ['customer_id' => 'required|integer|exists:customers,id', 'label' => 'nullable|string|max:80', 'recipient_name' => 'required|string|max:160', 'phone' => 'required|string|max:30', 'address_line' => 'required|string|max:255', 'address_line_2' => 'nullable|string|max:255', 'city' => 'required|string|max:120', 'region' => 'nullable|string|max:120', 'postal_code' => 'nullable|string|max:20', 'delivery_notes' => 'nullable|string', 'is_default' => 'sometimes|boolean'],
        ],
        'tables' => [
            'table' => 'dining_tables',
            'fields' => ['name', 'capacity', 'status', 'area', 'layout_x', 'layout_y', 'is_active'],
            'rules' => ['name' => 'required|string|max:80', 'capacity' => 'required|integer|min:1|max:255', 'status' => 'sometimes|in:available,occupied,reserved', 'area' => 'nullable|string|max:100', 'layout_x' => 'nullable|numeric', 'layout_y' => 'nullable|numeric', 'is_active' => 'sometimes|boolean'],
        ],
        'ingredients' => [
            'table' => 'ingredients',
            'fields' => ['name', 'sku', 'unit', 'low_stock_threshold', 'cost_per_unit', 'is_active'],
            'rules' => ['name' => 'required|string|max:160', 'sku' => 'nullable|string|max:80', 'unit' => 'required|in:g,kg,ml,l,each', 'low_stock_threshold' => 'nullable|numeric|min:0', 'cost_per_unit' => 'nullable|numeric|min:0', 'is_active' => 'sometimes|boolean'],
            'soft_delete' => true,
        ],
        'discounts' => [
            'table' => 'discounts',
            'fields' => ['name', 'code', 'type', 'value', 'starts_at', 'ends_at', 'is_active'],
            'rules' => ['name' => 'required|string|max:120', 'code' => 'nullable|string|max:60', 'type' => 'required|in:fixed,percentage', 'value' => 'required|numeric|min:0', 'starts_at' => 'nullable|date', 'ends_at' => 'nullable|date|after_or_equal:starts_at', 'is_active' => 'sometimes|boolean'],
        ],
        'deliveries' => [
            'table' => 'deliveries',
            'fields' => ['status', 'rider_id', 'delivery_fee', 'recipient_name', 'recipient_phone', 'address_snapshot', 'delivery_notes'],
            'rules' => ['status' => 'sometimes|in:pending,preparing,ready,assigned,out_for_delivery,delivered,cancelled', 'rider_id' => 'nullable|integer|exists:users,id', 'delivery_fee' => 'sometimes|numeric|min:0', 'recipient_name' => 'required|string|max:160', 'recipient_phone' => 'required|string|max:30', 'address_snapshot' => 'required|string', 'delivery_notes' => 'nullable|string'],
        ],
        'recipes' => [
            'table' => 'recipes',
            'fields' => ['product_id', 'product_variation_id', 'name'],
            'rules' => ['product_id' => 'required|integer|exists:products,id', 'product_variation_id' => 'nullable|integer|exists:product_variations,id', 'name' => 'nullable|string|max:120'],
        ],
        'permissions' => [
            'table' => 'permissions',
            'fields' => ['name', 'display_name'],
            'rules' => ['name' => 'required|string|max:120', 'display_name' => 'required|string|max:160'],
        ],
    ];

    public function index(Request $request): JsonResponse
    {
        $user = $this->authorizeAdmin($request, 'dashboard.view');

        $today = now()->toDateString();
        $orders = DB::table('orders');
        $weekStart = now()->subDays(6)->startOfDay();
        $weeklySales = DB::table('orders')
            ->selectRaw('DATE(created_at) as day, SUM(CASE WHEN status = ? THEN total ELSE 0 END) as sales, SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as orders', ['completed', 'completed'])
            ->whereBetween('created_at', [$weekStart, now()->endOfDay()])
            ->groupByRaw('DATE(created_at)')
            ->orderBy('day')
            ->get();
        $records = [
            'categories' => $this->rows('categories', true),
            'products' => $this->rows('products', true),
            'variations' => $this->rows('product_variations'),
            'modifier-groups' => $this->rows('modifier_groups'),
            'modifier-options' => $this->rows('modifier_options'),
            'modifier-assignments' => DB::table('product_modifier_group')->get(),
            'customers' => $this->rows('customers', true),
            'addresses' => $this->rows('customer_addresses'),
            'tables' => $this->rows('dining_tables'),
            'orders' => $this->rows('orders'),
            'order-items' => $this->rows('order_items'),
            'order-item-modifiers' => $this->rows('order_item_modifiers'),
            'payments' => $this->rows('payments'),
            'refunds' => $this->rows('refunds'),
            'ingredients' => $this->rows('ingredients', true),
            'inventory-transactions' => $this->rows('inventory_transactions'),
            'recipes' => $this->rows('recipes'),
            'recipe-items' => $this->rows('recipe_items'),
            'deliveries' => $this->rows('deliveries'),
            'discounts' => $this->rows('discounts'),
            'settings' => $this->rows('settings'),
            'staff' => $this->staffRows(),
            'roles' => DB::table('roles')->orderBy('name')->get(),
            'permissions' => $this->rows('permissions'),
            'role-permissions' => DB::table('permission_role')->get(),
            'activity' => $this->rows('activity_logs'),
            'loyalty' => $this->rows('loyalty_transactions'),
            'table-assignments' => $this->rows('order_table_assignments'),
        ];
        if (! $this->userHasRole($user, 'admin')) {
            $permissions = $user->roles()->with('permissions')->get()->flatMap(fn (Role $role) => $role->permissions->pluck('name'))->unique()->all();
            $can = fn (string ...$names): bool => count(array_intersect($names, $permissions)) > 0;
            if (! $can('catalog.manage', 'pos.use')) unset($records['categories'], $records['products'], $records['variations'], $records['modifier-groups'], $records['modifier-options'], $records['modifier-assignments']);
            if (! $can('customers.manage', 'pos.use', 'delivery.manage')) unset($records['customers'], $records['addresses']);
            if (! $can('tables.manage', 'pos.use')) unset($records['tables'], $records['table-assignments']);
            if (! $can('pos.use', 'payments.manage', 'reports.view')) unset($records['orders'], $records['order-items'], $records['order-item-modifiers']);
            if (! $can('payments.manage', 'reports.view')) unset($records['payments'], $records['refunds']);
            if (! $can('inventory.manage', 'reports.view')) unset($records['ingredients'], $records['inventory-transactions'], $records['recipes'], $records['recipe-items']);
            if (! $can('delivery.manage', 'reports.view')) unset($records['deliveries']);
            if (! $can('customers.manage', 'pos.use')) unset($records['discounts']);
            if (! $can('customers.manage')) unset($records['loyalty']);
            if (! $can('admin.manage')) unset($records['settings'], $records['staff'], $records['roles'], $records['permissions'], $records['role-permissions'], $records['activity']);
        }

        return response()->json([
            'summary' => [
                'today_sales' => (float) DB::table('orders')->whereDate('created_at', $today)->where('status', 'completed')->sum('total'),
                'today_orders' => DB::table('orders')->whereDate('created_at', $today)->count(),
                'today_completed_orders' => DB::table('orders')->whereDate('created_at', $today)->where('status', 'completed')->count(),
                'lifetime_sales' => (float) DB::table('orders')->where('status', 'completed')->sum('total'),
                'open_orders' => DB::table('orders')->whereIn('status', ['draft', 'held', 'confirmed', 'preparing', 'ready', 'served'])->count(),
                'low_stock' => DB::table('ingredients')->whereNull('deleted_at')->whereColumn('quantity_on_hand', '<=', 'low_stock_threshold')->count(),
                'orders_by_type' => DB::table('orders')->select('order_type', DB::raw('COUNT(*) as count'))->groupBy('order_type')->get(),
                'weekly_sales' => $weeklySales,
                'recent_sales' => $orders->whereDate('created_at', $today)->latest()->limit(10)->get(),
            ],
            'records' => $records,
        ]);
    }

    public function createRecord(Request $request, string $resource): JsonResponse
    {
        $user = $this->authorizeAdmin($request, $this->resourcePermission($resource));

        if ($resource === 'staff') {
            return $this->createStaff($request);
        }
        if ($resource === 'orders') {
            return $this->createOrder($request);
        }
        if ($resource === 'inventory-transactions') {
            return $this->createInventoryTransaction($request, $user->id);
        }
        if ($resource === 'recipe-items') {
            $values = $request->validate([
                'recipe_id' => 'required|integer|exists:recipes,id',
                'ingredient_id' => 'required|integer|exists:ingredients,id',
                'quantity' => 'required|numeric|gt:0',
            ]);
            $id = DB::table('recipe_items')->insertGetId([...$values, 'created_at' => now(), 'updated_at' => now()]);

            return response()->json(['record' => DB::table('recipe_items')->find($id)], 201);
        }
        if ($resource === 'loyalty') {
            $data = $request->validate([
                'customer_id' => 'required|integer|exists:customers,id',
                'points_change' => 'required|integer|not_in:0',
                'type' => 'required|in:earned,redeemed,adjustment,expired',
                'notes' => 'nullable|string|max:500',
            ]);
            $record = DB::transaction(function () use ($data, $user): object {
                $customer = DB::table('customers')->whereNull('deleted_at')->where('id', $data['customer_id'])->lockForUpdate()->first();
                abort_unless($customer, 404);
                $balance = (int) $customer->loyalty_points + (int) $data['points_change'];
                if ($balance < 0) {
                    throw ValidationException::withMessages(['points_change' => ['A customer loyalty balance cannot be negative.']]);
                }
                $now = now();
                DB::table('customers')->where('id', $customer->id)->update(['loyalty_points' => $balance, 'updated_at' => $now]);
                $id = DB::table('loyalty_transactions')->insertGetId([
                    ...$data,
                    'created_by' => $user->id,
                    'created_at' => $now,
                ]);

                return DB::table('loyalty_transactions')->find($id);
            });

            return response()->json(['record' => $record], 201);
        }
        if ($resource === 'settings') {
            $values = $request->validate([
                'key' => 'required|string|max:120',
                'group' => 'required|string|max:80',
                'value' => 'present',
            ]);
            $setting = DB::table('settings')->updateOrInsert(
                ['key' => $values['key']],
                ['group' => $values['group'], 'value' => json_encode($values['value'], JSON_THROW_ON_ERROR), 'updated_by' => $user->id, 'created_at' => now(), 'updated_at' => now()],
            );

            return response()->json(['record' => DB::table('settings')->where('key', $values['key'])->first()], $setting ? 201 : 200);
        }

        $config = $this->resource($resource);
        $sizeRows = $resource === 'products' ? $this->productSizeRows($request) : null;
        $values = $this->validatedRecord($request, $config);
        $uploadedImagePath = null;
        if ($resource === 'products' && $request->hasFile('image')) {
            $uploadedImagePath = $request->file('image')->store('products', 'public');
            $values['image_path'] = $uploadedImagePath;
        }
        if ($resource === 'categories' && empty($values['slug'])) {
            $values['slug'] = Str::slug($values['name']);
        }
        if ($resource === 'discounts') {
            $values['created_by'] = $user->id;
        }
        if ($resource === 'deliveries') {
            $values['order_id'] = $request->validate(['order_id' => 'required|integer|exists:orders,id'])['order_id'];
            $values['customer_address_id'] = $request->validate(['customer_address_id' => 'nullable|integer|exists:customer_addresses,id'])['customer_address_id'] ?? null;
        }
        if ($resource === 'tables' && ! isset($values['status'])) {
            $values['status'] = 'available';
        }
        $now = now();
        try {
            $id = DB::transaction(function () use ($config, $values, $now, $sizeRows): int {
                $id = DB::table($config['table'])->insertGetId([...$values, 'created_at' => $now, 'updated_at' => $now]);
                if ($sizeRows !== null) {
                    $this->syncProductSizes($id, $sizeRows);
                }

                return $id;
            });
        } catch (\Throwable $exception) {
            if ($uploadedImagePath !== null) {
                Storage::disk('public')->delete($uploadedImagePath);
            }
            throw $exception;
        }
        $this->log($user->id, "created:{$resource}", $config['table'], $id, $request);

        return response()->json(['record' => DB::table($config['table'])->find($id)], 201);
    }

    public function updateRecord(Request $request, string $resource, int $id): JsonResponse
    {
        $user = $this->authorizeAdmin($request, $this->resourcePermission($resource));
        if ($resource === 'staff') {
            return $this->updateStaff($request, $id);
        }
        if ($resource === 'orders') {
            return $this->updateOrderStatus($request, $id, $user->id);
        }
        if ($resource === 'order-items') {
            return $this->updateOrderItem($request, $id);
        }
        if ($resource === 'deliveries') {
            return $this->updateDelivery($request, $id);
        }
        if ($resource === 'payments') {
            return $this->refundPayment($request, $id, $user->id);
        }
        if ($resource === 'settings') {
            $values = $request->validate(['value' => 'present', 'group' => 'sometimes|string|max:80']);
            $updated = DB::table('settings')->where('id', $id)->update([
                'value' => json_encode($values['value'], JSON_THROW_ON_ERROR),
                'group' => $values['group'] ?? DB::table('settings')->where('id', $id)->value('group'),
                'updated_by' => $user->id,
                'updated_at' => now(),
            ]);
            abort_unless($updated, 404);

            return response()->json(['record' => DB::table('settings')->find($id)]);
        }
        if ($resource === 'ingredients' && in_array($request->input('action', $request->input('type')), ['stock_in', 'adjustment', 'waste', 'return'], true)) {
            return $this->createInventoryTransaction($request->merge(['ingredient_id' => $id]), $user->id);
        }

        $config = $this->resource($resource);
        $query = DB::table($config['table'])->where('id', $id);
        if (($config['soft_delete'] ?? false) && in_array('deleted_at', $this->columns($config['table']), true)) {
            $query->whereNull('deleted_at');
        }
        abort_unless($query->exists(), 404);
        $existingRecord = $query->first();
        $sizeRows = $resource === 'products' ? $this->productSizeRows($request) : null;
        $values = $this->validatedRecord($request, $config, $id);
        $uploadedImagePath = null;
        if ($resource === 'products' && $request->hasFile('image')) {
            $uploadedImagePath = $request->file('image')->store('products', 'public');
            $values['image_path'] = $uploadedImagePath;
        }
        if ($resource === 'categories' && empty($values['slug']) && isset($values['name'])) {
            $values['slug'] = Str::slug($values['name']);
        }
        $values['updated_at'] = now();
        try {
            DB::transaction(function () use ($query, $values, $id, $sizeRows): void {
                $query->update($values);
                if ($sizeRows !== null) {
                    $this->syncProductSizes($id, $sizeRows);
                }
            });
        } catch (\Throwable $exception) {
            if ($uploadedImagePath !== null) {
                Storage::disk('public')->delete($uploadedImagePath);
            }
            throw $exception;
        }
        if ($uploadedImagePath !== null && $existingRecord->image_path) {
            Storage::disk('public')->delete($existingRecord->image_path);
        }
        $this->log($user->id, "updated:{$resource}", $config['table'], $id, $request);

        return response()->json(['record' => DB::table($config['table'])->find($id)]);
    }

    public function deleteRecord(Request $request, string $resource, int $id): JsonResponse
    {
        $user = $this->authorizeAdmin($request, $this->resourcePermission($resource));
        if ($resource === 'staff') {
            abort_if($id === $user->id, 422, 'You cannot deactivate your own account.');
            $target = User::findOrFail($id);
            abort_if($target->roles()->where('name', 'admin')->exists() && User::where('is_active', true)->whereHas('roles', fn ($query) => $query->where('name', 'admin'))->count() <= 1, 422, 'The last active administrator cannot be deactivated.');
            $target->update(['is_active' => false]);

            return response()->json(['message' => 'Staff account deactivated.']);
        }
        if ($resource === 'settings' || $resource === 'payments' || $resource === 'refunds' || $resource === 'inventory-transactions' || $resource === 'activity') {
            abort(405, 'This record is part of an audit or financial ledger and cannot be deleted.');
        }

        $config = $this->resource($resource);
        $query = DB::table($config['table'])->where('id', $id);
        abort_unless($query->exists(), 404);
        if ($config['soft_delete'] ?? false) {
            $query->update(['deleted_at' => now(), 'updated_at' => now()]);
        } else {
            $query->delete();
        }
        $this->log($user->id, "deleted:{$resource}", $config['table'], $id, $request);

        return response()->json(['message' => 'Record deleted.']);
    }

    public function assignModifierGroups(Request $request, int $product): JsonResponse
    {
        $this->authorizeAdmin($request, 'catalog.manage');
        $values = $request->validate(['group_ids' => 'array', 'group_ids.*' => 'integer|exists:modifier_groups,id']);
        DB::table('products')->where('id', $product)->first() ?? abort(404);
        DB::transaction(function () use ($product, $values): void {
            DB::table('product_modifier_group')->where('product_id', $product)->delete();
            foreach ($values['group_ids'] ?? [] as $index => $groupId) {
                DB::table('product_modifier_group')->insert(['product_id' => $product, 'modifier_group_id' => $groupId, 'sort_order' => $index]);
            }
        });

        return response()->json(['group_ids' => array_map('intval', $values['group_ids'] ?? [])]);
    }

    public function assignOrderTables(Request $request, int $orderId): JsonResponse
    {
        $user = $this->authorizeAnyPermission($request, ['tables.manage', 'pos.use']);
        $data = $request->validate(['table_ids' => 'array', 'table_ids.*' => 'integer|exists:dining_tables,id']);
        DB::transaction(function () use ($orderId, $data, $user): void {
            $order = DB::table('orders')->where('id', $orderId)->lockForUpdate()->first();
            abort_unless($order, 404);
            if ($order->order_type !== 'dine_in' || in_array($order->status, ['completed', 'cancelled'], true)) {
                throw ValidationException::withMessages(['order' => ['Tables can only be assigned to an open dine-in order.']]);
            }
            $current = DB::table('order_table_assignments')->where('order_id', $orderId)->whereNull('released_at')->get();
            $currentIds = $current->pluck('dining_table_id')->map(fn ($id): int => (int) $id)->all();
            $desiredIds = array_values(array_unique(array_map('intval', $data['table_ids'] ?? [])));
            $removeIds = array_diff($currentIds, $desiredIds);
            $addIds = array_diff($desiredIds, $currentIds);
            $now = now();
            foreach ($current as $assignment) {
                if (in_array((int) $assignment->dining_table_id, $removeIds, true)) {
                    DB::table('order_table_assignments')->where('id', $assignment->id)->update(['released_at' => $now]);
                    DB::table('dining_tables')->where('id', $assignment->dining_table_id)->update(['status' => 'available', 'updated_at' => $now]);
                }
            }
            foreach ($addIds as $tableId) {
                $table = DB::table('dining_tables')->where('id', $tableId)->lockForUpdate()->first();
                if (! $table || $table->status !== 'available') {
                    throw ValidationException::withMessages(['table_ids' => ["Table {$tableId} is not available."]]);
                }
                DB::table('order_table_assignments')->insert(['order_id' => $orderId, 'dining_table_id' => $tableId, 'assigned_by' => $user->id, 'assigned_at' => $now]);
                DB::table('dining_tables')->where('id', $tableId)->update(['status' => 'occupied', 'updated_at' => $now]);
            }
            $this->log($user->id, 'updated:order-tables', 'orders', $orderId, $request);
        });

        return response()->json([
            'table_ids' => DB::table('order_table_assignments')->where('order_id', $orderId)->whereNull('released_at')->pluck('dining_table_id'),
        ]);
    }

    public function assignRolePermissions(Request $request, int $roleId): JsonResponse
    {
        $this->authorizeAdmin($request, 'admin.manage');
        $data = $request->validate(['permission_ids' => 'array', 'permission_ids.*' => 'integer|exists:permissions,id']);
        abort_unless(DB::table('roles')->where('id', $roleId)->exists(), 404);
        DB::transaction(function () use ($roleId, $data): void {
            DB::table('permission_role')->where('role_id', $roleId)->delete();
            foreach (array_unique($data['permission_ids'] ?? []) as $permissionId) {
                DB::table('permission_role')->insert(['role_id' => $roleId, 'permission_id' => $permissionId]);
            }
        });

        return response()->json(['permission_ids' => array_map('intval', $data['permission_ids'] ?? [])]);
    }

    public function report(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request, 'reports.view');
        $start = $request->query('from', now()->startOfMonth()->toDateString());
        $end = $request->query('to', now()->toDateString());
        validator(compact('start', 'end'), ['start' => 'required|date', 'end' => 'required|date|after_or_equal:start'])->validate();

        return response()->json([
            'period' => ['from' => $start, 'to' => $end],
            'sales' => DB::table('orders')->where('status', 'completed')->whereBetween('created_at', [$start.' 00:00:00', $end.' 23:59:59'])->sum('total'),
            'orders' => DB::table('orders')->whereBetween('created_at', [$start.' 00:00:00', $end.' 23:59:59'])->count(),
            'by_type' => DB::table('orders')->select('order_type', DB::raw('COUNT(*) as orders'), DB::raw('SUM(total) as sales'))->where('status', 'completed')->whereBetween('created_at', [$start.' 00:00:00', $end.' 23:59:59'])->groupBy('order_type')->get(),
            'by_payment_method' => DB::table('payments')->select('method', DB::raw('COUNT(*) as payments'), DB::raw('SUM(amount) as total'))->where('status', 'completed')->whereBetween('paid_at', [$start.' 00:00:00', $end.' 23:59:59'])->groupBy('method')->get(),
            'by_category' => DB::table('order_items')
                ->join('orders', 'orders.id', '=', 'order_items.order_id')
                ->leftJoin('products', 'products.id', '=', 'order_items.product_id')
                ->leftJoin('categories', 'categories.id', '=', 'products.category_id')
                ->selectRaw("COALESCE(categories.name, 'Deleted product') as category, SUM(order_items.quantity) as quantity, SUM(order_items.line_total) as sales")
                ->where('orders.status', 'completed')
                ->whereBetween('orders.created_at', [$start.' 00:00:00', $end.' 23:59:59'])
                ->groupBy('categories.name')
                ->orderByDesc('sales')
                ->get(),
            'by_employee' => DB::table('orders')
                ->join('users', 'users.id', '=', 'orders.created_by')
                ->select('users.name', DB::raw('COUNT(*) as orders'), DB::raw('SUM(orders.total) as sales'))
                ->where('orders.status', 'completed')
                ->whereBetween('orders.created_at', [$start.' 00:00:00', $end.' 23:59:59'])
                ->groupBy('users.id', 'users.name')
                ->orderByDesc('sales')
                ->get(),
            'best_sellers' => DB::table('order_items')->join('orders', 'orders.id', '=', 'order_items.order_id')->select('order_items.product_name', DB::raw('SUM(order_items.quantity) as quantity'), DB::raw('SUM(order_items.line_total) as sales'))->where('orders.status', 'completed')->whereBetween('orders.created_at', [$start.' 00:00:00', $end.' 23:59:59'])->groupBy('order_items.product_name')->orderByDesc('quantity')->limit(10)->get(),
        ]);
    }

    private function createOrder(Request $request): JsonResponse
    {
        $user = $this->authorizeAdmin($request, 'pos.use');
        $data = $request->validate([
            'order_type' => 'required|in:dine_in,takeout,delivery',
            'customer_id' => 'nullable|integer|exists:customers,id',
            'status' => 'sometimes|in:draft,held,confirmed',
            'notes' => 'nullable|string',
            'delivery_fee' => 'nullable|numeric|min:0',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|integer|exists:products,id',
            'items.*.variation_id' => 'nullable|integer|exists:product_variations,id',
            'items.*.quantity' => 'required|numeric|gt:0|max:1000',
            'items.*.notes' => 'nullable|string|max:500',
            'items.*.modifier_option_ids' => 'sometimes|array',
            'items.*.modifier_option_ids.*' => 'integer|distinct|exists:modifier_options,id',
            'table_ids' => 'sometimes|array',
            'table_ids.*' => 'integer|exists:dining_tables,id',
            'address_id' => 'required_if:order_type,delivery|nullable|integer|exists:customer_addresses,id',
            'discount_id' => 'nullable|integer|exists:discounts,id',
        ]);

        $order = DB::transaction(function () use ($data, $user, $request): object {
            $subtotal = 0.0;
            $taxRate = (float) $this->setting('tax_rate', 0);
            $items = [];
            foreach ($data['items'] as $item) {
                $product = DB::table('products')->whereNull('deleted_at')->where('is_available', true)->find($item['product_id']);
                if (! $product) {
                    throw ValidationException::withMessages(['items' => ['A selected product is unavailable.']]);
                }
                $variation = null;
                if (! empty($item['variation_id'])) {
                    $variation = DB::table('product_variations')->where('product_id', $product->id)->where('is_available', true)->find($item['variation_id']);
                    if (! $variation) {
                        throw ValidationException::withMessages(['items' => ['A selected product variation is unavailable.']]);
                    }
                } elseif (DB::table('product_variations')->where('product_id', $product->id)->where('is_available', true)->exists()) {
                    throw ValidationException::withMessages(['items' => ['Choose a size for this product.']]);
                }
                $price = (float) ($variation->price ?? $product->base_price);
                $modifierOptions = [];
                foreach ($item['modifier_option_ids'] ?? [] as $optionId) {
                    $option = DB::table('modifier_options')
                        ->join('product_modifier_group', 'product_modifier_group.modifier_group_id', '=', 'modifier_options.modifier_group_id')
                        ->where('product_modifier_group.product_id', $product->id)
                        ->where('modifier_options.is_available', true)
                        ->where('modifier_options.id', $optionId)
                        ->select('modifier_options.*')
                        ->first();
                    if (! $option) {
                        throw ValidationException::withMessages(['items' => ['A selected customization is not available for this product.']]);
                    }
                    $modifierOptions[] = $option;
                }
                foreach (DB::table('product_modifier_group')
                    ->join('modifier_groups', 'modifier_groups.id', '=', 'product_modifier_group.modifier_group_id')
                    ->where('product_modifier_group.product_id', $product->id)
                    ->where('modifier_groups.is_active', true)
                    ->select('modifier_groups.id', 'modifier_groups.name', 'modifier_groups.min_select', 'modifier_groups.max_select', 'modifier_groups.is_required')
                    ->get() as $group) {
                    $selectedCount = collect($modifierOptions)->where('modifier_group_id', $group->id)->count();
                    $minimum = max((int) $group->min_select, $group->is_required ? 1 : 0);
                    if ($selectedCount < $minimum || $selectedCount > (int) $group->max_select) {
                        throw ValidationException::withMessages(['items' => ["Choose between {$minimum} and {$group->max_select} options for {$group->name}."]]);
                    }
                }
                $modifierTotal = array_sum(array_map(fn ($option): float => (float) $option->price_adjustment, $modifierOptions));
                $lineSubtotal = round(($price + $modifierTotal) * (float) $item['quantity'], 2);
                $tax = round($lineSubtotal * $taxRate / 100, 2);
                $subtotal += $lineSubtotal;
                $items[] = [
                    'product_id' => $product->id,
                    'product_variation_id' => $variation?->id,
                    'product_name' => $product->name,
                    'variation_name' => $variation?->name,
                    'sku' => $variation?->sku ?? $product->sku,
                    'quantity' => $item['quantity'],
                    'unit_price' => $price,
                    'tax_rate' => $taxRate,
                    'tax_amount' => $tax,
                    'line_total' => $lineSubtotal + $tax,
                    '_modifier_options' => $modifierOptions,
                    'notes' => $item['notes'] ?? null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }
            $taxTotal = round(array_sum(array_column($items, 'tax_amount')), 2);
            $serviceRate = (float) $this->setting('service_charge_rate', 0);
            $serviceCharge = round($subtotal * $serviceRate / 100, 2);
            $deliveryFee = $data['order_type'] === 'delivery' ? (float) ($data['delivery_fee'] ?? $this->setting('delivery_fee', 0)) : 0;
            $discountAmount = 0.0;
            $discount = null;
            if (! empty($data['discount_id'])) {
                $discount = DB::table('discounts')->where('id', $data['discount_id'])->where('is_active', true)->first();
                if (! $discount || ($discount->starts_at && now()->lt($discount->starts_at)) || ($discount->ends_at && now()->gt($discount->ends_at))) {
                    throw ValidationException::withMessages(['discount_id' => ['This discount is not currently available.']]);
                }
                $discountAmount = $discount->type === 'percentage'
                    ? round($subtotal * min((float) $discount->value, 100) / 100, 2)
                    : min((float) $discount->value, $subtotal);
            }
            $status = $data['status'] ?? 'draft';
            $now = now();
            $orderId = DB::table('orders')->insertGetId([
                'order_number' => 'KA-'.now()->format('ymd').'-'.Str::upper(Str::random(6)),
                'order_type' => $data['order_type'],
                'status' => $status,
                'customer_id' => $data['customer_id'] ?? null,
                'created_by' => $user->id,
                'subtotal' => $subtotal,
                'discount_total' => $discountAmount,
                'tax_total' => $taxTotal,
                'service_charge_total' => $serviceCharge,
                'delivery_fee' => $deliveryFee,
                'total' => round($subtotal - $discountAmount + $taxTotal + $serviceCharge + $deliveryFee, 2),
                'notes' => $data['notes'] ?? null,
                'placed_at' => $status === 'confirmed' ? $now : null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            foreach ($items as $item) {
                $modifierOptions = $item['_modifier_options'];
                unset($item['_modifier_options']);
                $item['order_id'] = $orderId;
                $orderItemId = DB::table('order_items')->insertGetId($item);
                foreach ($modifierOptions as $option) {
                    DB::table('order_item_modifiers')->insert([
                        'order_item_id' => $orderItemId,
                        'modifier_option_id' => $option->id,
                        'modifier_group_name' => DB::table('modifier_groups')->where('id', $option->modifier_group_id)->value('name'),
                        'option_name' => $option->name,
                        'price_adjustment' => $option->price_adjustment,
                        'quantity' => 1,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }
            if ($discount) {
                DB::table('order_discounts')->insert([
                    'order_id' => $orderId,
                    'discount_id' => $discount->id,
                    'name' => $discount->name,
                    'type' => $discount->type,
                    'value' => $discount->value,
                    'amount' => $discountAmount,
                    'applied_by' => $user->id,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
            DB::table('order_status_history')->insert([
                'order_id' => $orderId, 'from_status' => null, 'to_status' => $status, 'changed_by' => $user->id,
                'created_at' => $now,
            ]);
            foreach ($data['table_ids'] ?? [] as $tableId) {
                $table = DB::table('dining_tables')->where('id', $tableId)->lockForUpdate()->first();
                if (! $table || $table->status !== 'available') {
                    throw ValidationException::withMessages(['table_ids' => ["Table {$tableId} is not available."]]);
                }
                DB::table('order_table_assignments')->insert(['order_id' => $orderId, 'dining_table_id' => $tableId, 'assigned_by' => $user->id, 'assigned_at' => $now]);
                DB::table('dining_tables')->where('id', $tableId)->update(['status' => 'occupied', 'updated_at' => $now]);
            }
            if ($data['order_type'] === 'delivery') {
                $address = DB::table('customer_addresses')->find($data['address_id']);
                if (! $address || (isset($data['customer_id']) && (int) $address->customer_id !== (int) $data['customer_id'])) {
                    throw ValidationException::withMessages(['address_id' => ['Select an address belonging to this customer.']]);
                }
                DB::table('deliveries')->insert([
                    'order_id' => $orderId,
                    'customer_address_id' => $address->id,
                    'status' => 'pending',
                    'delivery_fee' => $deliveryFee,
                    'recipient_name' => $address->recipient_name,
                    'recipient_phone' => $address->phone,
                    'address_snapshot' => trim($address->address_line.' '.($address->address_line_2 ?? '').', '.$address->city.' '.($address->region ?? '').' '.($address->postal_code ?? '')),
                    'delivery_notes' => $address->delivery_notes,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
            $this->log($user->id, 'created:orders', 'orders', $orderId, $request);

            return DB::table('orders')->find($orderId);
        });

        return response()->json(['record' => $order], 201);
    }

    private function updateOrderStatus(Request $request, int $id, int $userId): JsonResponse
    {
        $data = $request->validate(['status' => 'required|in:draft,held,confirmed,preparing,ready,served,completed,cancelled', 'notes' => 'nullable|string|max:500']);
        $order = DB::table('orders')->where('id', $id)->lockForUpdate()->first();
        abort_unless($order, 404);
        $transitions = [
            'draft' => ['held', 'confirmed', 'cancelled'],
            'held' => ['draft', 'confirmed', 'cancelled'],
            'confirmed' => ['preparing', 'cancelled'],
            'preparing' => ['ready', 'cancelled'],
            'ready' => ['served', 'completed', 'cancelled'],
            'served' => ['completed', 'cancelled'],
        ];
        if (! in_array($data['status'], $transitions[$order->status] ?? [], true)) {
            throw ValidationException::withMessages(['status' => ["An order cannot move from {$order->status} to {$data['status']}."]]);
        }
        if ($data['status'] === 'completed') {
            $paid = DB::table('payments')->where('order_id', $id)->where('status', 'completed')->sum('amount');
            if ((float) $paid < (float) $order->total) {
                throw ValidationException::withMessages(['status' => ['Record full payment before completing this order.']]);
            }
        }
        $now = now();
        DB::transaction(function () use ($id, $order, $data, $userId, $now): void {
            if ($data['status'] === 'completed') {
                $this->deductRecipeInventory($id, $userId);
            }
            DB::table('orders')->where('id', $id)->update([
                'status' => $data['status'],
                'placed_at' => $data['status'] === 'confirmed' ? $now : $order->placed_at,
                'completed_at' => $data['status'] === 'completed' ? $now : $order->completed_at,
                'cancelled_at' => $data['status'] === 'cancelled' ? $now : null,
                'cancellation_reason' => $data['status'] === 'cancelled' ? ($data['notes'] ?? 'Cancelled by administrator') : null,
                'updated_at' => $now,
            ]);
            DB::table('order_status_history')->insert(['order_id' => $id, 'from_status' => $order->status, 'to_status' => $data['status'], 'changed_by' => $userId, 'notes' => $data['notes'] ?? null, 'created_at' => $now]);
            if (in_array($data['status'], ['completed', 'cancelled'], true)) {
                $assignments = DB::table('order_table_assignments')->where('order_id', $id)->whereNull('released_at')->get();
                foreach ($assignments as $assignment) {
                    DB::table('order_table_assignments')->where('id', $assignment->id)->update(['released_at' => $now]);
                    DB::table('dining_tables')->where('id', $assignment->dining_table_id)->update(['status' => 'available', 'updated_at' => $now]);
                }
            }
        });

        return response()->json(['record' => DB::table('orders')->find($id)]);
    }

    private function updateDelivery(Request $request, int $id): JsonResponse
    {
        $data = $this->validatedRecord($request, self::RESOURCES['deliveries'], $id);
        $delivery = DB::table('deliveries')->where('id', $id)->first();
        abort_unless($delivery, 404);
        $transitions = [
            'pending' => ['preparing', 'cancelled'],
            'preparing' => ['ready', 'cancelled'],
            'ready' => ['assigned', 'cancelled'],
            'assigned' => ['out_for_delivery', 'cancelled'],
            'out_for_delivery' => ['delivered', 'cancelled'],
            'delivered' => [],
            'cancelled' => [],
        ];
        if (isset($data['status']) && $data['status'] !== $delivery->status && ! in_array($data['status'], $transitions[$delivery->status] ?? [], true)) {
            throw ValidationException::withMessages(['status' => ["A delivery cannot move from {$delivery->status} to {$data['status']}."]]);
        }
        if (($data['status'] ?? null) === 'assigned' && empty($data['rider_id']) && empty($delivery->rider_id)) {
            throw ValidationException::withMessages(['rider_id' => ['Assign a rider before marking the delivery assigned.']]);
        }
        $now = now();
        if (($data['status'] ?? null) === 'assigned') $data['assigned_at'] = $now;
        if (($data['status'] ?? null) === 'out_for_delivery') $data['picked_up_at'] = $now;
        if (($data['status'] ?? null) === 'delivered') $data['delivered_at'] = $now;
        $data['updated_at'] = $now;
        DB::table('deliveries')->where('id', $id)->update($data);

        return response()->json(['record' => DB::table('deliveries')->find($id)]);
    }

    private function updateOrderItem(Request $request, int $itemId): JsonResponse
    {
        $data = $request->validate([
            'quantity' => 'required|numeric|gt:0|max:1000',
            'notes' => 'nullable|string|max:500',
        ]);
        $item = DB::transaction(function () use ($data, $itemId): object {
            $item = DB::table('order_items')->where('id', $itemId)->lockForUpdate()->first();
            abort_unless($item, 404);
            $order = DB::table('orders')->where('id', $item->order_id)->lockForUpdate()->first();
            abort_unless($order, 404);
            if (! in_array($order->status, ['draft', 'held'], true) || DB::table('payments')->where('order_id', $order->id)->whereIn('status', ['completed', 'partially_refunded', 'refunded'])->exists()) {
                throw ValidationException::withMessages(['order' => ['Only unpaid draft or held orders can be edited.']]);
            }
            $modifierTotal = (float) DB::table('order_item_modifiers')->where('order_item_id', $itemId)->sum('price_adjustment');
            $quantity = (float) $data['quantity'];
            $lineSubtotal = round(((float) $item->unit_price + $modifierTotal) * $quantity, 2);
            $lineDiscount = min((float) $item->line_discount, $lineSubtotal);
            $taxable = max(0, $lineSubtotal - $lineDiscount);
            $tax = round($taxable * (float) $item->tax_rate / 100, 2);
            $lineTotal = $taxable + $tax;
            $now = now();
            DB::table('order_items')->where('id', $itemId)->update([
                'quantity' => $quantity,
                'line_discount' => $lineDiscount,
                'tax_amount' => $tax,
                'line_total' => $lineTotal,
                'notes' => $data['notes'] ?? $item->notes,
                'updated_at' => $now,
            ]);

            $items = DB::table('order_items')->where('order_id', $order->id)->get();
            $subtotal = round($items->sum(fn ($orderItem): float =>
                ((float) $orderItem->unit_price + (float) DB::table('order_item_modifiers')->where('order_item_id', $orderItem->id)->sum('price_adjustment')) * (float) $orderItem->quantity
            ), 2);
            $lineDiscounts = round($items->sum('line_discount'), 2);
            $taxTotal = round($items->sum('tax_amount'), 2);
            $serviceCharge = round(($subtotal - $lineDiscounts) * (float) $this->setting('service_charge_rate', 0) / 100, 2);
            $discountTotal = 0.0;
            foreach (DB::table('order_discounts')->where('order_id', $order->id)->get() as $discount) {
                $amount = $discount->type === 'percentage'
                    ? round(($subtotal - $lineDiscounts) * min((float) $discount->value, 100) / 100, 2)
                    : min((float) $discount->value, $subtotal - $lineDiscounts);
                $discountTotal += $amount;
                DB::table('order_discounts')->where('id', $discount->id)->update(['amount' => $amount, 'updated_at' => $now]);
            }
            DB::table('orders')->where('id', $order->id)->update([
                'subtotal' => $subtotal,
                'discount_total' => $discountTotal,
                'tax_total' => $taxTotal,
                'service_charge_total' => $serviceCharge,
                'total' => max(0, round($subtotal - $lineDiscounts - $discountTotal + $taxTotal + $serviceCharge + (float) $order->delivery_fee, 2)),
                'updated_at' => $now,
            ]);

            return DB::table('order_items')->find($itemId);
        });

        return response()->json(['record' => $item]);
    }

    private function recordPayment(Request $request, int $orderId): JsonResponse
    {
        $user = $this->authorizeAdmin($request, 'payments.manage');
        $data = $request->validate([
            'method' => 'required|in:cash,card,e_wallet,bank_transfer,other',
            'amount' => 'required|numeric|gt:0',
            'tendered_amount' => 'nullable|numeric|min:0',
            'reference_number' => 'nullable|string|max:120',
        ]);
        $payment = DB::transaction(function () use ($data, $orderId, $user): object {
            $order = DB::table('orders')->where('id', $orderId)->lockForUpdate()->first();
            abort_unless($order, 404);
            if (in_array($order->status, ['completed', 'cancelled'], true)) {
                throw ValidationException::withMessages(['order' => ['This order cannot accept payment.']]);
            }
            $paid = (float) DB::table('payments')->where('order_id', $orderId)->where('status', 'completed')->sum('amount');
            $remaining = round((float) $order->total - $paid, 2);
            $amount = round((float) $data['amount'], 2);
            if ($amount > $remaining) {
                throw ValidationException::withMessages(['amount' => ['Payment cannot exceed the remaining balance.']]);
            }
            $tendered = isset($data['tendered_amount']) ? round((float) $data['tendered_amount'], 2) : null;
            if ($data['method'] === 'cash' && ($tendered === null || $tendered < $amount)) {
                throw ValidationException::withMessages(['tendered_amount' => ['Cash received must be at least the amount applied.']]);
            }
            if ($data['method'] !== 'cash' && $tendered !== null && $tendered !== $amount) {
                throw ValidationException::withMessages(['tendered_amount' => ['Tendered amount is only used for cash payments.']]);
            }
            $now = now();
            $id = DB::table('payments')->insertGetId([
                'order_id' => $orderId, 'method' => $data['method'], 'status' => 'completed', 'amount' => $amount,
                'tendered_amount' => $tendered, 'change_amount' => $data['method'] === 'cash' ? round($tendered - $amount, 2) : 0,
                'reference_number' => $data['reference_number'] ?? null, 'processed_by' => $user->id,
                'paid_at' => $now, 'created_at' => $now, 'updated_at' => $now,
            ]);
            if (round($paid + $amount, 2) >= (float) $order->total) {
                $this->deductRecipeInventory($orderId, $user->id);
                DB::table('orders')->where('id', $orderId)->update(['status' => 'completed', 'completed_at' => $now, 'updated_at' => $now]);
                DB::table('order_status_history')->insert(['order_id' => $orderId, 'from_status' => $order->status, 'to_status' => 'completed', 'changed_by' => $user->id, 'notes' => 'Paid in full', 'created_at' => $now]);
                $assignments = DB::table('order_table_assignments')->where('order_id', $orderId)->whereNull('released_at')->get();
                foreach ($assignments as $assignment) {
                    DB::table('order_table_assignments')->where('id', $assignment->id)->update(['released_at' => $now]);
                    DB::table('dining_tables')->where('id', $assignment->dining_table_id)->update(['status' => 'available', 'updated_at' => $now]);
                }
            }

            return DB::table('payments')->find($id);
        });

        return response()->json(['record' => $payment], 201);
    }

    public function payOrder(Request $request, int $orderId): JsonResponse
    {
        return $this->recordPayment($request, $orderId);
    }

    private function refundPayment(Request $request, int $paymentId, int $userId): JsonResponse
    {
        $data = $request->validate(['amount' => 'required|numeric|gt:0', 'reason' => 'required|string|max:500', 'reference_number' => 'nullable|string|max:120']);
        $refund = DB::transaction(function () use ($data, $paymentId, $userId): object {
            $payment = DB::table('payments')->where('id', $paymentId)->lockForUpdate()->first();
            abort_unless($payment, 404);
            if (! in_array($payment->status, ['completed', 'partially_refunded'], true)) {
                throw ValidationException::withMessages(['payment' => ['Only completed payments can be refunded.']]);
            }
            $refunded = (float) DB::table('refunds')->where('payment_id', $paymentId)->where('status', 'completed')->sum('amount');
            $amount = round((float) $data['amount'], 2);
            if ($amount > round((float) $payment->amount - $refunded, 2)) {
                throw ValidationException::withMessages(['amount' => ['Refund cannot exceed the unrefunded payment balance.']]);
            }
            $now = now();
            $id = DB::table('refunds')->insertGetId([
                'payment_id' => $paymentId, 'amount' => $amount, 'reason' => $data['reason'],
                'reference_number' => $data['reference_number'] ?? null, 'status' => 'completed',
                'processed_by' => $userId, 'refunded_at' => $now, 'created_at' => $now, 'updated_at' => $now,
            ]);
            $totalRefunded = $refunded + $amount;
            DB::table('payments')->where('id', $paymentId)->update([
                'status' => $totalRefunded >= (float) $payment->amount ? 'refunded' : 'partially_refunded',
                'updated_at' => $now,
            ]);

            return DB::table('refunds')->find($id);
        });

        return response()->json(['record' => $refund], 201);
    }

    private function createInventoryTransaction(Request $request, int $userId): JsonResponse
    {
        $data = $request->validate([
            'ingredient_id' => 'required|integer|exists:ingredients,id',
            'type' => 'sometimes|in:stock_in,adjustment,waste,return',
            'action' => 'sometimes|in:stock_in,adjustment,waste',
            'quantity' => 'required|numeric|gt:0',
            'reference' => 'nullable|string|max:120',
            'notes' => 'nullable|string|max:500',
        ]);
        $type = $data['action'] ?? $data['type'] ?? null;
        if ($type === null) {
            throw ValidationException::withMessages(['type' => ['Select a stock movement type.']]);
        }
        $ingredient = DB::transaction(function () use ($data, $type, $userId, $request): object {
            $ingredient = DB::table('ingredients')->whereNull('deleted_at')->where('id', $data['ingredient_id'])->lockForUpdate()->first();
            abort_unless($ingredient, 404);
            $quantity = (float) $data['quantity'];
            $change = match ($type) {
                'stock_in', 'return' => $quantity,
                'waste' => -$quantity,
                'adjustment' => $quantity - (float) $ingredient->quantity_on_hand,
                default => throw ValidationException::withMessages(['type' => ['Unsupported inventory transaction type.']]),
            };
            $after = round((float) $ingredient->quantity_on_hand + $change, 3);
            if ($after < 0) {
                throw ValidationException::withMessages(['quantity' => ['Stock cannot be reduced below zero.']]);
            }
            $now = now();
            DB::table('ingredients')->where('id', $ingredient->id)->update(['quantity_on_hand' => $after, 'updated_at' => $now]);
            $id = DB::table('inventory_transactions')->insertGetId([
                'ingredient_id' => $ingredient->id, 'type' => $type, 'quantity_change' => $change,
                'quantity_after' => $after, 'unit_cost' => $ingredient->cost_per_unit,
                'user_id' => $userId, 'reference' => $data['reference'] ?? null, 'notes' => $data['notes'] ?? null,
                'created_at' => $now,
            ]);
            $this->log($userId, "inventory:{$type}", 'ingredients', $ingredient->id, $request);

            return DB::table('inventory_transactions')->find($id);
        });

        return response()->json(['record' => $ingredient], 201);
    }

    private function deductRecipeInventory(int $orderId, int $userId): void
    {
        if (DB::table('inventory_transactions')->where('order_id', $orderId)->where('type', 'sale')->exists()) {
            return;
        }
        $orderItems = DB::table('order_items')->where('order_id', $orderId)->get();
        foreach ($orderItems as $orderItem) {
            $recipeQuery = DB::table('recipes')->where('product_id', $orderItem->product_id);
            if ($orderItem->product_variation_id !== null) {
                $recipeQuery->where(function ($query) use ($orderItem): void {
                    $query->where('product_variation_id', $orderItem->product_variation_id)->orWhereNull('product_variation_id');
                })->orderByRaw('product_variation_id IS NULL');
            } else {
                $recipeQuery->whereNull('product_variation_id');
            }
            $recipe = $recipeQuery->first();
            if (! $recipe) {
                continue;
            }
            $recipeItems = DB::table('recipe_items')->where('recipe_id', $recipe->id)->get();
            foreach ($recipeItems as $recipeItem) {
                $ingredient = DB::table('ingredients')->whereNull('deleted_at')->where('id', $recipeItem->ingredient_id)->lockForUpdate()->first();
                if (! $ingredient) {
                    throw ValidationException::withMessages(['inventory' => ['A recipe ingredient is no longer available.']]);
                }
                $quantity = round((float) $recipeItem->quantity * (float) $orderItem->quantity, 3);
                $after = round((float) $ingredient->quantity_on_hand - $quantity, 3);
                if ($after < 0) {
                    throw ValidationException::withMessages(['inventory' => ["Not enough {$ingredient->name} to complete this order."]]);
                }
                $now = now();
                DB::table('ingredients')->where('id', $ingredient->id)->update(['quantity_on_hand' => $after, 'updated_at' => $now]);
                DB::table('inventory_transactions')->insert([
                    'ingredient_id' => $ingredient->id,
                    'type' => 'sale',
                    'quantity_change' => -$quantity,
                    'quantity_after' => $after,
                    'unit_cost' => $ingredient->cost_per_unit,
                    'order_id' => $orderId,
                    'user_id' => $userId,
                    'reference' => 'Order',
                    'created_at' => $now,
                ]);
            }
        }
    }

    private function createStaff(Request $request): JsonResponse
    {
        $request->merge(['email' => Str::lower((string) $request->input('email'))]);
        $data = $request->validate([
            'name' => 'required|string|max:150',
            'email' => 'required|email|max:255|unique:users,email',
            'password' => ['required', 'string', 'min:12', 'max:255'],
            'role' => ['required', Rule::in(['admin', 'manager', 'cashier', 'staff'])],
        ]);
        $user = DB::transaction(function () use ($data): User {
            $user = User::create(['name' => $data['name'], 'email' => $data['email'], 'password' => $data['password']]);
            $user->roles()->attach(Role::where('name', $data['role'])->firstOrFail());

            return $user;
        });

        return response()->json(['record' => $this->staffRecord($user)], 201);
    }

    private function updateStaff(Request $request, int $id): JsonResponse
    {
        $target = User::findOrFail($id);
        $data = $request->validate([
            'name' => 'sometimes|required|string|max:150',
            'email' => ['sometimes', 'required', 'email', 'max:255', Rule::unique('users')->ignore($id)],
            'role' => ['sometimes', 'required', Rule::in(['admin', 'manager', 'cashier', 'staff'])],
            'is_active' => 'sometimes|boolean',
            'password' => 'sometimes|required|string|min:12|max:255',
        ]);
        if (array_key_exists('is_active', $data) && ! $data['is_active']) {
            $current = request()->user();
            abort_if($current?->id === $id, 422, 'You cannot deactivate your own account.');
            abort_if($target->roles()->where('name', 'admin')->exists() && User::where('is_active', true)->whereHas('roles', fn ($query) => $query->where('name', 'admin'))->count() <= 1, 422, 'The last active administrator cannot be deactivated.');
        }
        DB::transaction(function () use ($target, $data): void {
            $fields = array_intersect_key($data, array_flip(['name', 'email', 'password', 'is_active']));
            $target->forceFill($fields)->save();
            if (isset($data['role'])) {
                $target->roles()->sync([Role::where('name', $data['role'])->firstOrFail()->id]);
            }
        });

        return response()->json(['record' => $this->staffRecord($target->fresh())]);
    }

    private function staffRows(): object
    {
        return User::with('roles')->orderBy('name')->get()->map(fn (User $user): array => $this->staffRecord($user));
    }

    private function staffRecord(User $user): array
    {
        return ['id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'role' => $user->roles->first()?->name, 'is_active' => $user->is_active, 'created_at' => $user->created_at];
    }

    private function resource(string $name): array
    {
        abort_unless(isset(self::RESOURCES[$name]), 404, 'Unknown admin resource.');

        return self::RESOURCES[$name];
    }

    private function validatedRecord(Request $request, array $config, ?int $id = null): array
    {
        $rules = $config['rules'];
        if ($config['table'] === 'products' && $request->hasFile('image')) {
            $rules['image'] = 'required|image|mimes:jpg,jpeg,png,webp|max:5120';
        }
        foreach (['sku', 'slug', 'code'] as $uniqueField) {
            if (isset($rules[$uniqueField])) {
                $table = $config['table'];
                $unique = Rule::unique($table, $uniqueField);
                if ($id !== null) {
                    $unique->ignore($id);
                }
                $fieldRules = $rules[$uniqueField];
                $rules[$uniqueField] = [
                    ...(is_array($fieldRules) ? $fieldRules : explode('|', $fieldRules)),
                    $unique,
                ];
            }
        }
        if ($id !== null) {
            foreach ($rules as $field => $rule) {
                $ruleParts = is_array($rule) ? $rule : [$rule];
                if (is_string($ruleParts[0]) && str_starts_with($ruleParts[0], 'required')) {
                    $ruleParts[0] = preg_replace('/^required/', 'sometimes', $ruleParts[0]);
                    $rules[$field] = is_array($rule) ? $ruleParts : $ruleParts[0];
                } else {
                    $rules[$field] = $rule;
                }
            }
        }
        $validated = $request->validate($rules);

        return array_intersect_key($validated, array_flip($config['fields']));
    }

    private function productSizeRows(Request $request): ?array
    {
        if (! $request->exists('pricing_mode')) {
            return null;
        }

        $mode = $request->input('pricing_mode');
        $sizes = $request->input('sizes');
        if (is_string($sizes)) {
            $sizes = json_decode($sizes, true);
        }
        $request->merge(['sizes' => $sizes]);

        $validated = $request->validate([
            'pricing_mode' => 'required|in:single,size',
            'sizes' => 'present|array',
            'sizes.*.id' => 'sometimes|nullable|integer|exists:product_variations,id',
            'sizes.*.name' => 'required|string|max:100|distinct:ignore_case',
            'sizes.*.sku' => 'nullable|string|max:80',
            'sizes.*.price' => 'required|numeric|min:0',
            'sizes.*.is_available' => 'sometimes|boolean',
        ]);
        $sizes = $validated['sizes'];
        if ($mode === 'size' && ! collect($sizes)->contains(fn (array $size): bool => ($size['is_available'] ?? true) && trim($size['name']) !== '')) {
            throw ValidationException::withMessages(['sizes' => ['Add at least one available size with a price.']]);
        }
        if ($mode === 'single' && $sizes !== []) {
            throw ValidationException::withMessages(['sizes' => ['Remove size rows before switching to a single price.']]);
        }
        if ($mode === 'size') {
            $request->merge(['base_price' => min(array_map(fn (array $size): float => (float) $size['price'], array_filter($sizes, fn (array $size): bool => ($size['is_available'] ?? true))))]);
        }

        return $sizes;
    }

    private function syncProductSizes(int $productId, array $sizes): void
    {
        $now = now();
        $retainedIds = [];
        foreach ($sizes as $size) {
            $sizeValues = [
                'product_id' => $productId,
                'name' => $size['name'],
                'sku' => $size['sku'] ?? null,
                'price' => $size['price'],
                'is_available' => $size['is_available'] ?? true,
                'sort_order' => $size['sort_order'] ?? 0,
                'updated_at' => $now,
            ];
            if (! empty($size['id'])) {
                $sizeId = (int) $size['id'];
                $updated = DB::table('product_variations')
                    ->where('id', $sizeId)
                    ->where('product_id', $productId)
                    ->update($sizeValues);
                if ($updated === 0 && ! DB::table('product_variations')->where('id', $sizeId)->where('product_id', $productId)->exists()) {
                    throw ValidationException::withMessages(['sizes' => ['A selected size does not belong to this product.']]);
                }
                $retainedIds[] = $sizeId;
            } else {
                $retainedIds[] = DB::table('product_variations')->insertGetId([...$sizeValues, 'created_at' => $now]);
            }
        }

        $unusedSizes = DB::table('product_variations')->where('product_id', $productId);
        if ($retainedIds !== []) {
            $unusedSizes->whereNotIn('id', $retainedIds);
        }
        $unusedSizes->update(['is_available' => false, 'updated_at' => $now]);
    }

    private function rows(string $table, bool $softDelete = false): object
    {
        $query = DB::table($table);
        if ($softDelete && in_array('deleted_at', $this->columns($table), true)) {
            $query->whereNull('deleted_at');
        }

        return $query->orderByDesc('id')->limit(500)->get();
    }

    private function columns(string $table): array
    {
        return Schema::getColumnListing($table);
    }

    private function setting(string $key, mixed $default): mixed
    {
        $value = DB::table('settings')->where('key', $key)->value('value');
        if ($value === null) {
            return $default;
        }

        return json_decode($value, true) ?? $default;
    }

    private function authorizeAdmin(Request $request, string $permission = 'admin.manage'): User
    {
        $user = $request->user();
        abort_unless($user instanceof User && $user->is_active, 403);
        abort_unless(
            $this->userHasRole($user, 'admin')
                || $user->roles()->whereHas('permissions', fn ($query) => $query->where('name', $permission))->exists(),
            403,
        );

        return $user;
    }

    private function authorizeAnyPermission(Request $request, array $permissions): User
    {
        $user = $request->user();
        abort_unless($user instanceof User && $user->is_active, 403);
        abort_unless($this->userHasRole($user, 'admin') || $user->roles()
            ->whereHas('permissions', fn ($query) => $query->whereIn('name', $permissions))
            ->exists(), 403);

        return $user;
    }

    private function userHasRole(User $user, string $role): bool
    {
        return $user->roles()->where('name', $role)->exists();
    }

    private function resourcePermission(string $resource): string
    {
        return match ($resource) {
            'categories', 'products', 'variations', 'modifier-groups', 'modifier-options', 'recipes', 'recipe-items' => 'catalog.manage',
            'customers', 'addresses', 'loyalty', 'discounts' => 'customers.manage',
            'tables' => 'tables.manage',
            'orders', 'order-items' => 'pos.use',
            'payments', 'refunds' => 'payments.manage',
            'ingredients', 'inventory-transactions' => 'inventory.manage',
            'deliveries' => 'delivery.manage',
            'staff', 'permissions', 'settings' => 'admin.manage',
            default => 'admin.manage',
        };
    }

    private function log(int $userId, string $action, string $subjectType, int $subjectId, Request $request): void
    {
        DB::table('activity_logs')->insert([
            'user_id' => $userId,
            'action' => $action,
            'subject_type' => $subjectType,
            'subject_id' => $subjectId,
            'ip_address' => $request->ip(),
            'created_at' => now(),
        ]);
    }
}
