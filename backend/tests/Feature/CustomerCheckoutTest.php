<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class CustomerCheckoutTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
    }

    public function test_only_customers_can_read_enabled_sandbox_payment_methods(): void
    {
        $this->getJson('/api/customer/payment-methods')->assertUnauthorized();

        $admin = User::factory()->create();
        $admin->roles()->attach(Role::where('name', 'admin')->firstOrFail());
        $this->actingAs($admin)->postJson('/api/admin/records/settings', [
            'key' => 'payment_methods',
            'group' => 'payments',
            'value' => [
                ['code' => 'cash', 'label' => 'Cash at the door', 'enabled' => true],
                ['code' => 'card', 'label' => 'Card sandbox', 'enabled' => false],
            ],
        ])->assertCreated();

        $customer = $this->customer();
        $this->actingAs($customer)
            ->getJson('/api/customer/payment-methods')
            ->assertOk()
            ->assertJsonCount(1, 'methods')
            ->assertJsonPath('methods.0.code', 'cash')
            ->assertJsonPath('methods.0.label', 'Cash at the door');

        $admin = User::factory()->create();
        $admin->roles()->attach(Role::where('name', 'admin')->firstOrFail());
        $this->actingAs($admin)->getJson('/api/customer/payment-methods')->assertForbidden();
    }

    public function test_customer_checkout_persists_delivery_order_and_marks_payment_as_simulated(): void
    {
        $admin = User::factory()->create();
        $admin->roles()->attach(Role::where('name', 'admin')->firstOrFail());
        $this->actingAs($admin);
        $category = $this->postJson('/api/admin/records/categories', ['name' => 'Coffee'])
            ->assertCreated()
            ->json('record');
        $product = $this->postJson('/api/admin/records/products', [
            'category_id' => $category['id'],
            'name' => 'Latte',
            'base_price' => 80,
        ])->assertCreated()->json('record');
        $size = $this->postJson('/api/admin/records/variations', [
            'product_id' => $product['id'],
            'name' => 'Large',
            'price' => 100,
        ])->assertCreated()->json('record');

        DB::table('settings')->insert([
            ['key' => 'delivery_fee', 'group' => 'orders', 'value' => '15', 'created_at' => now(), 'updated_at' => now()],
            ['key' => 'tax_rate', 'group' => 'orders', 'value' => '5', 'created_at' => now(), 'updated_at' => now()],
        ]);
        $customer = $this->customer();

        $this->actingAs($customer)
            ->postJson('/api/customer/checkout', [
                'payment_method' => 'e_wallet',
                'items' => [[
                    'product_id' => $product['id'],
                    'variation_id' => $size['id'],
                    'quantity' => 2,
                    'price' => 1,
                ]],
                'recipient_name' => 'Coffee Customer',
                'phone' => '09171234567',
                'address_line' => '12 Amore Street',
                'city' => 'Manila',
                'delivery_notes' => 'Call on arrival',
                'customer_latitude' => 14.5995,
                'customer_longitude' => 120.9842,
            ])
            ->assertCreated()
            ->assertJsonPath('record.order_type', 'delivery')
            ->assertJsonPath('record.status', 'confirmed')
            ->assertJsonPath('record.subtotal', 200)
            ->assertJsonPath('record.delivery_fee', 15)
            ->assertJsonPath('record.total', 225)
            ->assertJsonPath('message', 'Sandbox checkout completed. No real payment was processed.');

        $order = DB::table('orders')->where('customer_id', DB::table('customers')->where('email', $customer->email)->value('id'))->first();
        $this->assertNotNull($order);
        $this->assertDatabaseHas('order_items', [
            'order_id' => $order->id,
            'product_id' => $product['id'],
            'product_variation_id' => $size['id'],
            'quantity' => 2,
            'unit_price' => 100,
        ]);
        $this->assertDatabaseHas('payments', [
            'order_id' => $order->id,
            'method' => 'e_wallet',
            'status' => 'simulated',
            'amount' => 225,
            'processed_by' => null,
            'paid_at' => null,
        ]);
        $this->assertDatabaseHas('deliveries', [
            'order_id' => $order->id,
            'status' => 'pending',
            'recipient_name' => 'Coffee Customer',
            'recipient_phone' => '09171234567',
        ]);
        $delivery = DB::table('deliveries')->where('order_id', $order->id)->first();
        $this->assertDatabaseHas('customer_addresses', [
            'id' => $delivery->customer_address_id,
            'latitude' => 14.5995,
            'longitude' => 120.9842,
        ]);
        $this->assertDatabaseHas('order_status_history', [
            'order_id' => $order->id,
            'to_status' => 'confirmed',
            'changed_by' => $customer->id,
        ]);

        DB::table('deliveries')->where('id', $delivery->id)->update([
            'status' => 'out_for_delivery',
            'rider_id' => User::factory()->create()->id,
        ]);
        $riderId = (int) DB::table('deliveries')->where('id', $delivery->id)->value('rider_id');
        $this->actingAs($customer)
            ->getJson('/api/customer/deliveries')
            ->assertOk()
            ->assertJsonPath('deliveries.0.customer_latitude', 14.5995)
            ->assertJsonPath('deliveries.0.rider_latitude', null);
        $this->actingAs($this->customer())
            ->getJson('/api/customer/deliveries')
            ->assertOk()
            ->assertJsonCount(0, 'deliveries');

        $otherRider = User::factory()->create();
        $this->actingAs($otherRider)
            ->postJson("/api/driver/deliveries/{$delivery->id}/location", ['latitude' => 14.6, 'longitude' => 120.99])
            ->assertNotFound();

        $rider = User::findOrFail($riderId);
        $this->actingAs($rider)
            ->postJson("/api/driver/deliveries/{$delivery->id}/location", [
                'latitude' => 14.61,
                'longitude' => 120.991,
                'accuracy' => 8,
            ])
            ->assertOk();

        $this->actingAs($customer)
            ->getJson('/api/customer/deliveries')
            ->assertOk()
            ->assertJsonPath('deliveries.0.rider_latitude', 14.61)
            ->assertJsonPath('deliveries.0.rider_longitude', 120.991)
            ->assertJsonPath('deliveries.0.rider_name', $rider->name);
    }

    public function test_customer_checkout_rejects_disabled_methods_and_unavailable_products(): void
    {
        $admin = User::factory()->create();
        $admin->roles()->attach(Role::where('name', 'admin')->firstOrFail());
        $this->actingAs($admin);
        $category = $this->postJson('/api/admin/records/categories', ['name' => 'Coffee'])->json('record');
        $product = $this->postJson('/api/admin/records/products', [
            'category_id' => $category['id'],
            'name' => 'Unavailable latte',
            'base_price' => 100,
            'is_available' => false,
        ])->json('record');
        DB::table('settings')->insert([
            'key' => 'payment_methods',
            'group' => 'payments',
            'value' => json_encode([
                ['code' => 'cash', 'label' => 'Cash', 'enabled' => true],
                ['code' => 'card', 'label' => 'Card', 'enabled' => false],
            ], JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $customer = $this->customer();
        $this->actingAs($customer);
        $payload = [
            'items' => [['product_id' => $product['id'], 'quantity' => 1]],
            'recipient_name' => 'Coffee Customer',
            'phone' => '09171234567',
            'address_line' => '12 Amore Street',
            'city' => 'Manila',
        ];
        $this->postJson('/api/customer/checkout', ['payment_method' => 'card', ...$payload])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('payment_method');
        $this->postJson('/api/customer/checkout', ['payment_method' => 'cash', ...$payload])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('items');
        $this->assertDatabaseCount('orders', 0);
    }

    private function customer(): User
    {
        $customer = User::factory()->create();
        $customer->roles()->attach(Role::where('name', 'customer')->firstOrFail());

        return $customer;
    }
}
