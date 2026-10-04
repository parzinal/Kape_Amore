<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CustomerCheckoutController extends Controller
{
    private const DEFAULT_PAYMENT_METHODS = [
        ['code' => 'cash', 'label' => 'Cash on delivery', 'enabled' => true],
        ['code' => 'card', 'label' => 'Card (sandbox)', 'enabled' => true],
        ['code' => 'e_wallet', 'label' => 'E-wallet (sandbox)', 'enabled' => true],
        ['code' => 'bank_transfer', 'label' => 'Bank transfer (sandbox)', 'enabled' => true],
        ['code' => 'other', 'label' => 'Other (sandbox)', 'enabled' => true],
    ];

    public function paymentMethods(Request $request): JsonResponse
    {
        $this->customer($request);

        return response()->json(['methods' => array_values(array_filter($this->configuredPaymentMethods(), fn (array $method): bool => $method['enabled']))]);
    }

    public function checkout(Request $request): JsonResponse
    {
        $user = $this->customer($request);
        $data = $request->validate([
            'payment_method' => 'required|string|max:24',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|integer|exists:products,id',
            'items.*.variation_id' => 'nullable|integer|exists:product_variations,id',
            'items.*.quantity' => 'required|integer|min:1|max:100',
            'recipient_name' => 'required|string|max:160',
            'phone' => 'required|string|max:30',
            'address_line' => 'required|string|max:255',
            'address_line_2' => 'nullable|string|max:255',
            'city' => 'required|string|max:120',
            'region' => 'nullable|string|max:120',
            'postal_code' => 'nullable|string|max:20',
            'delivery_notes' => 'nullable|string|max:1000',
            'notes' => 'nullable|string|max:1000',
            'customer_latitude' => 'nullable|required_with:customer_longitude|numeric|between:-90,90',
            'customer_longitude' => 'nullable|required_with:customer_latitude|numeric|between:-180,180',
        ]);

        $paymentMethod = collect($this->configuredPaymentMethods())->firstWhere('code', $data['payment_method']);
        if (! $paymentMethod || ! $paymentMethod['enabled']) {
            throw ValidationException::withMessages(['payment_method' => ['This payment method is not currently available.']]);
        }

        $result = DB::transaction(function () use ($data, $user, $paymentMethod): array {
            $customer = DB::table('customers')
                ->whereNull('deleted_at')
                ->whereRaw('LOWER(email) = ?', [Str::lower($user->email)])
                ->first();

            $now = now();
            if (! $customer) {
                $customerId = DB::table('customers')->insertGetId([
                    'name' => $user->name,
                    'email' => $user->email,
                    'phone' => $data['phone'],
                    'loyalty_points' => 0,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                $customer = DB::table('customers')->find($customerId);
            }

            $addressId = DB::table('customer_addresses')->insertGetId([
                'customer_id' => $customer->id,
                'label' => 'Delivery address',
                'recipient_name' => $data['recipient_name'],
                'phone' => $data['phone'],
                'address_line' => $data['address_line'],
                'address_line_2' => $data['address_line_2'] ?? null,
                'city' => $data['city'],
                'region' => $data['region'] ?? null,
                'postal_code' => $data['postal_code'] ?? null,
                'latitude' => $data['customer_latitude'] ?? null,
                'longitude' => $data['customer_longitude'] ?? null,
                'delivery_notes' => $data['delivery_notes'] ?? null,
                'is_default' => ! DB::table('customer_addresses')->where('customer_id', $customer->id)->exists(),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $address = DB::table('customer_addresses')->find($addressId);

            $subtotal = 0.0;
            $taxRate = (float) $this->setting('tax_rate', 0);
            $items = [];
            foreach ($data['items'] as $item) {
                $product = DB::table('products')
                    ->join('categories', 'categories.id', '=', 'products.category_id')
                    ->whereNull('products.deleted_at')
                    ->where('products.is_available', true)
                    ->where('categories.is_active', true)
                    ->where('products.id', $item['product_id'])
                    ->select('products.*')
                    ->first();
                if (! $product) {
                    throw ValidationException::withMessages(['items' => ['A selected product is unavailable.']]);
                }

                $variation = null;
                if (! empty($item['variation_id'])) {
                    $variation = DB::table('product_variations')
                        ->where('product_id', $product->id)
                        ->where('is_available', true)
                        ->where('id', $item['variation_id'])
                        ->first();
                    if (! $variation) {
                        throw ValidationException::withMessages(['items' => ['A selected product size is unavailable.']]);
                    }
                } elseif (DB::table('product_variations')->where('product_id', $product->id)->where('is_available', true)->exists()) {
                    throw ValidationException::withMessages(['items' => ['Choose a size for each selected product.']]);
                }

                $price = (float) ($variation->price ?? $product->base_price);
                $lineSubtotal = round($price * (int) $item['quantity'], 2);
                $tax = round($lineSubtotal * $taxRate / 100, 2);
                $subtotal += $lineSubtotal;
                $items[] = [
                    'product_id' => $product->id,
                    'product_variation_id' => $variation?->id,
                    'product_name' => $product->name,
                    'variation_name' => $variation?->name,
                    'sku' => $variation?->sku ?? $product->sku,
                    'quantity' => (int) $item['quantity'],
                    'unit_price' => $price,
                    'line_discount' => 0,
                    'tax_rate' => $taxRate,
                    'tax_amount' => $tax,
                    'line_total' => $lineSubtotal + $tax,
                    'notes' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            $taxTotal = round(array_sum(array_column($items, 'tax_amount')), 2);
            $serviceCharge = round($subtotal * (float) $this->setting('service_charge_rate', 0) / 100, 2);
            $deliveryFee = (float) $this->setting('delivery_fee', 0);
            $total = round($subtotal + $taxTotal + $serviceCharge + $deliveryFee, 2);
            $orderId = DB::table('orders')->insertGetId([
                'order_number' => 'KA-'.now()->format('ymd').'-'.Str::upper(Str::random(6)),
                'order_type' => 'delivery',
                'status' => 'confirmed',
                'customer_id' => $customer->id,
                'created_by' => $user->id,
                'subtotal' => $subtotal,
                'discount_total' => 0,
                'tax_total' => $taxTotal,
                'service_charge_total' => $serviceCharge,
                'delivery_fee' => $deliveryFee,
                'total' => $total,
                'notes' => $data['notes'] ?? null,
                'placed_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            foreach ($items as $item) {
                $item['order_id'] = $orderId;
                DB::table('order_items')->insert($item);
            }

            DB::table('deliveries')->insert([
                'order_id' => $orderId,
                'customer_address_id' => $addressId,
                'status' => 'pending',
                'delivery_fee' => $deliveryFee,
                'recipient_name' => $address->recipient_name,
                'recipient_phone' => $address->phone,
                'address_snapshot' => trim($address->address_line.' '.($address->address_line_2 ?? '').', '.$address->city.' '.($address->region ?? '').' '.($address->postal_code ?? '')),
                'delivery_notes' => $address->delivery_notes,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            DB::table('payments')->insert([
                'order_id' => $orderId,
                'method' => $paymentMethod['code'],
                'status' => 'simulated',
                'amount' => $total,
                'change_amount' => 0,
                'reference_number' => 'SANDBOX-'.Str::upper(Str::random(12)),
                'processed_by' => null,
                'paid_at' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            DB::table('order_status_history')->insert([
                'order_id' => $orderId,
                'from_status' => null,
                'to_status' => 'confirmed',
                'changed_by' => $user->id,
                'notes' => 'Customer order placed using sandbox checkout.',
                'created_at' => $now,
            ]);

            return [
                'record' => DB::table('orders')->find($orderId),
                'message' => 'Sandbox checkout completed. No real payment was processed.',
            ];
        });

        return response()->json($result, 201);
    }

    private function customer(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User && $user->is_active && $user->roles()->where('name', 'customer')->exists(), 403);

        return $user;
    }

    private function configuredPaymentMethods(): array
    {
        $value = DB::table('settings')->where('key', 'payment_methods')->value('value');
        if ($value === null) {
            return self::DEFAULT_PAYMENT_METHODS;
        }

        $configured = json_decode((string) $value, true);
        if (! is_array($configured)) {
            throw new \UnexpectedValueException('The configured payment methods setting must be a JSON array.');
        }

        return array_map(function (array $default) use ($configured): array {
            foreach ($configured as $method) {
                if (is_array($method) && ($method['code'] ?? null) === $default['code']) {
                    if (! isset($method['label']) || ! is_string($method['label']) || trim($method['label']) === '') {
                        throw new \UnexpectedValueException('Each configured payment method must have a non-empty label.');
                    }

                    return [
                        'code' => $default['code'],
                        'label' => trim($method['label']),
                        'enabled' => (bool) ($method['enabled'] ?? false),
                    ];
                }
            }

            return [...$default, 'enabled' => false];
        }, self::DEFAULT_PAYMENT_METHODS);
    }

    private function setting(string $key, float $default): float
    {
        $value = DB::table('settings')->where('key', $key)->value('value');
        if ($value === null) {
            return $default;
        }

        $decoded = json_decode((string) $value, true);

        return is_numeric($decoded) ? (float) $decoded : $default;
    }
}
