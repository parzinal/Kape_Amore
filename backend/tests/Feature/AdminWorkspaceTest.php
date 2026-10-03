<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AdminWorkspaceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
    }

    public function test_admin_workspace_rejects_customers_without_dashboard_permission(): void
    {
        $this->getJson('/api/admin/workspace')->assertUnauthorized();

        $customer = User::factory()->create();
        $customer->roles()->attach(Role::where('name', 'customer')->firstOrFail());
        $this->actingAs($customer)->getJson('/api/admin/workspace')->assertForbidden();
    }

    public function test_manager_and_cashier_permissions_limit_workspace_actions(): void
    {
        $this->seed(PermissionSeeder::class);

        $manager = User::factory()->create();
        $manager->roles()->attach(Role::where('name', 'manager')->firstOrFail());
        $this->actingAs($manager)->postJson('/api/admin/records/categories', ['name' => 'Coffee'])->assertCreated();
        $this->postJson('/api/admin/records/staff', [
            'name' => 'Unauthorized Staff',
            'email' => 'unauthorized@example.com',
            'password' => 'A-secure-password-123',
            'role_id' => Role::where('name', 'cashier')->value('id'),
        ])->assertForbidden();

        $cashier = User::factory()->create();
        $cashier->roles()->attach(Role::where('name', 'cashier')->firstOrFail());
        $this->actingAs($cashier)->getJson('/api/admin/workspace')
            ->assertOk()
            ->assertJsonMissingPath('records.staff')
            ->assertJsonMissingPath('records.settings');
        $this->postJson('/api/admin/records/categories', ['name' => 'Restricted'])->assertForbidden();
    }

    public function test_category_slug_validation_supports_pipe_rules_and_uniqueness(): void
    {
        $this->actingAs($this->admin());
        $category = $this->postJson('/api/admin/records/categories', [
            'name' => 'Signature Coffee',
            'slug' => 'signature-coffee',
        ])->assertCreated()->json('record');

        $this->patchJson("/api/admin/records/categories/{$category['id']}", [
            'slug' => 'signature-coffee',
        ])->assertOk();

        $this->postJson('/api/admin/records/categories', [
            'name' => 'Another Category',
            'slug' => 'signature-coffee',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['slug']);
    }

    public function test_admin_can_manage_catalog_create_orders_and_record_split_safe_cash_payment(): void
    {
        $this->actingAs($this->admin());
        $category = $this->postJson('/api/admin/records/categories', ['name' => 'Coffee'])->assertCreated()->json('record');
        $product = $this->postJson('/api/admin/records/products', [
            'category_id' => $category['id'],
            'name' => 'Latte',
            'base_price' => 145,
        ])->assertCreated()->json('record');

        $order = $this->postJson('/api/admin/records/orders', [
            'order_type' => 'takeout',
            'items' => [['product_id' => $product['id'], 'quantity' => 2]],
        ])->assertCreated()->json('record');

        $this->assertEquals(290.0, (float) $order['total']);
        $this->postJson("/api/admin/orders/{$order['id']}/payments", [
            'method' => 'cash',
            'amount' => 290,
            'tendered_amount' => 300,
        ])->assertCreated()->assertJsonPath('record.change_amount', 10);

        $this->assertDatabaseHas('orders', ['id' => $order['id'], 'status' => 'completed']);
        $this->getJson('/api/admin/workspace')
            ->assertOk()
            ->assertJsonPath('records.products.0.name', 'Latte')
            ->assertJsonPath('summary.today_orders', 1)
            ->assertJsonPath('summary.weekly_sales.0.sales', 290)
            ->assertJsonPath('summary.weekly_sales.0.orders', 1);
    }

    public function test_admin_can_create_product_sizes_and_pos_uses_the_size_price(): void
    {
        $this->actingAs($this->admin());
        $category = $this->postJson('/api/admin/records/categories', ['name' => 'Coffee'])
            ->assertCreated()
            ->json('record');
        $product = $this->postJson('/api/admin/records/products', [
            'category_id' => $category['id'],
            'name' => 'Latte',
            'base_price' => 145,
        ])->assertCreated()->json('record');

        $size = $this->postJson('/api/admin/records/variations', [
            'product_id' => $product['id'],
            'name' => 'Large',
            'price' => 185,
        ])->assertCreated()->json('record');

        $this->getJson('/api/admin/workspace')
            ->assertOk()
            ->assertJsonPath('records.products.0.id', $product['id'])
            ->assertJsonPath('records.variations.0.id', $size['id'])
            ->assertJsonPath('records.variations.0.product_id', $product['id']);

        $order = $this->postJson('/api/admin/records/orders', [
            'order_type' => 'takeout',
            'items' => [[
                'product_id' => $product['id'],
                'variation_id' => $size['id'],
                'quantity' => 2,
            ]],
        ])->assertCreated()->json('record');

        $this->assertEquals(370.0, (float) $order['total']);
        $this->assertDatabaseHas('order_items', [
            'order_id' => $order['id'],
            'product_variation_id' => $size['id'],
            'unit_price' => 185,
        ]);
    }

    public function test_product_form_can_manage_size_pricing_inline_and_switch_to_single_price(): void
    {
        $this->actingAs($this->admin());
        $category = $this->postJson('/api/admin/records/categories', ['name' => 'Coffee'])
            ->assertCreated()
            ->json('record');
        $product = $this->post('/api/admin/records/products', [
            'category_id' => $category['id'],
            'name' => 'Cappuccino',
            'pricing_mode' => 'size',
            'sizes' => json_encode([
                ['name' => 'Small', 'sku' => '', 'price' => 125],
                ['name' => 'Large', 'sku' => '', 'price' => 180],
            ], JSON_THROW_ON_ERROR),
        ], ['Accept' => 'application/json'])->assertCreated()->json('record');

        $this->assertEquals(125.0, (float) $product['base_price']);
        $sizes = DB::table('product_variations')->where('product_id', $product['id'])->orderBy('price')->get();
        $this->assertCount(2, $sizes);
        $this->assertNull($sizes[0]->sku);
        $this->assertNull($sizes[1]->sku);

        $this->postJson('/api/admin/records/orders', [
            'order_type' => 'takeout',
            'items' => [['product_id' => $product['id'], 'quantity' => 1]],
        ])->assertUnprocessable();

        $order = $this->postJson('/api/admin/records/orders', [
            'order_type' => 'takeout',
            'items' => [['product_id' => $product['id'], 'variation_id' => $sizes[1]->id, 'quantity' => 1]],
        ])->assertCreated()->json('record');
        $this->assertEquals(180.0, (float) $order['total']);

        $this->patchJson("/api/admin/records/products/{$product['id']}", [
            'pricing_mode' => 'single',
            'base_price' => 95,
            'sizes' => [],
        ])->assertOk();

        $this->assertDatabaseHas('products', ['id' => $product['id'], 'base_price' => 95]);
        $this->assertDatabaseMissing('product_variations', ['product_id' => $product['id'], 'is_available' => true]);
        $singlePriceOrder = $this->postJson('/api/admin/records/orders', [
            'order_type' => 'takeout',
            'items' => [['product_id' => $product['id'], 'quantity' => 1]],
        ])->assertCreated()->json('record');
        $this->assertEquals(95.0, (float) $singlePriceOrder['total']);
    }

    public function test_product_image_can_be_uploaded_and_replaced(): void
    {
        Storage::fake('public');
        $this->actingAs($this->admin());
        $category = $this->postJson('/api/admin/records/categories', ['name' => 'Coffee'])->assertCreated()->json('record');

        $product = $this->post('/api/admin/records/products', [
            'category_id' => $category['id'],
            'name' => 'Latte',
            'base_price' => 145,
            'image' => UploadedFile::fake()->image('latte.jpg'),
        ], ['Accept' => 'application/json'])->assertCreated()->json('record');
        $originalImage = $product['image_path'];
        Storage::disk('public')->assertExists($originalImage);

        $updated = $this->post("/api/admin/records/products/{$product['id']}", [
            '_method' => 'PATCH',
            'image' => UploadedFile::fake()->image('latte-updated.png'),
        ], ['Accept' => 'application/json'])->assertOk()->json('record');
        Storage::disk('public')->assertMissing($originalImage);
        Storage::disk('public')->assertExists($updated['image_path']);
        $this->assertDatabaseHas('products', ['id' => $product['id'], 'image_path' => $updated['image_path']]);
    }

    public function test_inventory_movements_are_ledgered_and_cannot_reduce_stock_below_zero(): void
    {
        $this->actingAs($this->admin());
        $ingredient = $this->postJson('/api/admin/records/ingredients', [
            'name' => 'Coffee beans',
            'unit' => 'g',
            'low_stock_threshold' => 100,
        ])->assertCreated()->json('record');

        $this->postJson('/api/admin/records/inventory-transactions', [
            'ingredient_id' => $ingredient['id'],
            'type' => 'stock_in',
            'quantity' => 500,
        ])->assertCreated();

        $this->postJson('/api/admin/records/inventory-transactions', [
            'ingredient_id' => $ingredient['id'],
            'type' => 'waste',
            'quantity' => 600,
        ])->assertUnprocessable();

        $this->assertDatabaseHas('ingredients', ['id' => $ingredient['id'], 'quantity_on_hand' => 500]);
        $this->assertDatabaseCount('inventory_transactions', 1);
    }

    public function test_product_customizations_and_recipe_stock_are_applied_when_order_is_paid(): void
    {
        $this->actingAs($this->admin());
        $category = $this->postJson('/api/admin/records/categories', ['name' => 'Coffee'])->assertCreated()->json('record');
        $product = $this->postJson('/api/admin/records/products', [
            'category_id' => $category['id'],
            'name' => 'Latte',
            'base_price' => 145,
        ])->assertCreated()->json('record');
        $group = $this->postJson('/api/admin/records/modifier-groups', [
            'name' => 'Milk',
            'min_select' => 1,
            'max_select' => 1,
            'is_required' => true,
        ])->assertCreated()->json('record');
        $option = $this->postJson('/api/admin/records/modifier-options', [
            'modifier_group_id' => $group['id'],
            'name' => 'Oat milk',
            'price_adjustment' => 5,
        ])->assertCreated()->json('record');
        $this->postJson("/api/admin/products/{$product['id']}/modifier-groups", ['group_ids' => [$group['id']]])->assertOk();

        $ingredient = $this->postJson('/api/admin/records/ingredients', ['name' => 'Coffee beans', 'unit' => 'g'])->assertCreated()->json('record');
        $recipe = $this->postJson('/api/admin/records/recipes', ['product_id' => $product['id'], 'name' => 'Latte'])->assertCreated()->json('record');
        $this->postJson('/api/admin/records/recipe-items', [
            'recipe_id' => $recipe['id'],
            'ingredient_id' => $ingredient['id'],
            'quantity' => 10,
        ])->assertCreated();
        $this->postJson('/api/admin/records/inventory-transactions', [
            'ingredient_id' => $ingredient['id'],
            'type' => 'stock_in',
            'quantity' => 100,
        ])->assertCreated();

        $order = $this->postJson('/api/admin/records/orders', [
            'order_type' => 'takeout',
            'items' => [[
                'product_id' => $product['id'],
                'quantity' => 2,
                'modifier_option_ids' => [$option['id']],
            ]],
        ])->assertCreated()->json('record');
        $this->assertEquals(300.0, (float) $order['total']);
        $this->assertDatabaseHas('order_item_modifiers', [
            'option_name' => 'Oat milk',
            'price_adjustment' => 5,
        ]);

        $this->postJson("/api/admin/orders/{$order['id']}/payments", [
            'method' => 'cash',
            'amount' => 300,
            'tendered_amount' => 300,
        ])->assertCreated();
        $this->assertDatabaseHas('ingredients', ['id' => $ingredient['id'], 'quantity_on_hand' => 80]);
        $this->assertDatabaseHas('inventory_transactions', [
            'ingredient_id' => $ingredient['id'],
            'order_id' => $order['id'],
            'type' => 'sale',
            'quantity_change' => -20,
        ]);
    }

    public function test_admin_can_assign_permissions_and_refund_a_payment_with_a_reason(): void
    {
        $this->actingAs($this->admin());
        $role = Role::where('name', 'cashier')->firstOrFail();
        $permission = $this->postJson('/api/admin/records/permissions', [
            'name' => 'pos.use',
            'display_name' => 'Use point of sale',
        ])->assertCreated()->json('record');
        $this->postJson("/api/admin/roles/{$role->id}/permissions", ['permission_ids' => [$permission['id']]])->assertOk();
        $this->assertDatabaseHas('permission_role', ['role_id' => $role->id, 'permission_id' => $permission['id']]);

        $category = $this->postJson('/api/admin/records/categories', ['name' => 'Coffee'])->assertCreated()->json('record');
        $product = $this->postJson('/api/admin/records/products', [
            'category_id' => $category['id'],
            'name' => 'Espresso',
            'base_price' => 100,
        ])->assertCreated()->json('record');
        $order = $this->postJson('/api/admin/records/orders', [
            'order_type' => 'takeout',
            'items' => [['product_id' => $product['id'], 'quantity' => 1]],
        ])->assertCreated()->json('record');
        $payment = $this->postJson("/api/admin/orders/{$order['id']}/payments", [
            'method' => 'e_wallet',
            'amount' => 100,
            'reference_number' => 'TX-123',
        ])->assertCreated()->json('record');

        $this->patchJson("/api/admin/records/payments/{$payment['id']}", [
            'amount' => 25,
            'reason' => 'Partial order correction',
        ])->assertCreated();
        $this->assertDatabaseHas('payments', ['id' => $payment['id'], 'status' => 'partially_refunded']);
        $this->assertDatabaseHas('refunds', ['payment_id' => $payment['id'], 'amount' => 25]);
    }

    private function admin(): User
    {
        $admin = User::factory()->create();
        $admin->roles()->attach(Role::where('name', 'admin')->firstOrFail());

        return $admin;
    }
}
