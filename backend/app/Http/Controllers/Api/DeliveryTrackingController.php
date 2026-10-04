<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DeliveryTrackingController extends Controller
{
    public function customerDeliveries(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user instanceof User && $user->is_active && $user->roles()->where('name', 'customer')->exists(), 403);

        $customer = DB::table('customers')
            ->whereNull('deleted_at')
            ->whereRaw('LOWER(email) = ?', [strtolower($user->email)])
            ->first();
        if (! $customer) {
            return response()->json(['deliveries' => []]);
        }

        $deliveries = DB::table('deliveries')
            ->join('orders', 'orders.id', '=', 'deliveries.order_id')
            ->leftJoin('customer_addresses', 'customer_addresses.id', '=', 'deliveries.customer_address_id')
            ->leftJoin('users as riders', 'riders.id', '=', 'deliveries.rider_id')
            ->where('orders.customer_id', $customer->id)
            ->whereNotIn('deliveries.status', ['delivered', 'cancelled'])
            ->orderByDesc('orders.created_at')
            ->select([
                'deliveries.id',
                'deliveries.order_id',
                'deliveries.status',
                'deliveries.rider_id',
                'deliveries.rider_latitude',
                'deliveries.rider_longitude',
                'deliveries.rider_location_updated_at',
                'orders.order_number',
                'orders.total',
                'customer_addresses.latitude as customer_latitude',
                'customer_addresses.longitude as customer_longitude',
                'riders.name as rider_name',
            ])
            ->get()
            ->map(function (object $delivery): object {
                $delivery->rider_latitude = $delivery->rider_latitude === null ? null : (float) $delivery->rider_latitude;
                $delivery->rider_longitude = $delivery->rider_longitude === null ? null : (float) $delivery->rider_longitude;
                $delivery->customer_latitude = $delivery->customer_latitude === null ? null : (float) $delivery->customer_latitude;
                $delivery->customer_longitude = $delivery->customer_longitude === null ? null : (float) $delivery->customer_longitude;

                return $delivery;
            });

        return response()->json(['deliveries' => $deliveries]);
    }

    public function shareLocation(Request $request, int $deliveryId): JsonResponse
    {
        $user = $request->user();
        abort_unless($user instanceof User && $user->is_active, 403);
        $data = $request->validate([
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'accuracy' => 'nullable|numeric|min:0|max:10000',
        ]);

        $delivery = DB::table('deliveries')
            ->where('id', $deliveryId)
            ->where('rider_id', $user->id)
            ->where('status', 'out_for_delivery')
            ->first();
        abort_unless($delivery, 404);

        $updatedAt = now();
        DB::table('deliveries')->where('id', $deliveryId)->update([
            'rider_latitude' => $data['latitude'],
            'rider_longitude' => $data['longitude'],
            'rider_location_updated_at' => $updatedAt,
            'updated_at' => $updatedAt,
        ]);

        return response()->json(['updated_at' => $updatedAt->toISOString()]);
    }
}
