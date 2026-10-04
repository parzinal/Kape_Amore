<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\Api\AdminWorkspaceController;
use App\Http\Controllers\Api\CustomerCatalogController;
use App\Http\Controllers\Api\CustomerCheckoutController;
use App\Http\Controllers\Api\DeliveryTrackingController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('/user', [AuthController::class, 'currentUser']);
    Route::get('/customer/catalog', [CustomerCatalogController::class, 'index']);
    Route::get('/customer/payment-methods', [CustomerCheckoutController::class, 'paymentMethods']);
    Route::post('/customer/checkout', [CustomerCheckoutController::class, 'checkout']);
    Route::get('/customer/deliveries', [DeliveryTrackingController::class, 'customerDeliveries']);
    Route::post('/driver/deliveries/{delivery}/location', [DeliveryTrackingController::class, 'shareLocation'])->whereNumber('delivery');
});

Route::middleware(['auth:sanctum', 'role:admin'])->get('/admin/me', function (Request $request) {
    $user = $request->user()->loadMissing('roles');

    return response()->json([
        'user' => [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'roles' => $user->roles->pluck('name')->values(),
        ],
    ]);
});

Route::prefix('/admin')->middleware('auth:sanctum')->group(function (): void {
    Route::get('/workspace', [AdminWorkspaceController::class, 'index']);
    Route::get('/reports', [AdminWorkspaceController::class, 'report']);
    Route::post('/products/{product}/modifier-groups', [AdminWorkspaceController::class, 'assignModifierGroups']);
    Route::post('/orders/{order}/payments', [AdminWorkspaceController::class, 'payOrder']);
    Route::post('/orders/{order}/tables', [AdminWorkspaceController::class, 'assignOrderTables']);
    Route::post('/roles/{role}/permissions', [AdminWorkspaceController::class, 'assignRolePermissions']);
    Route::post('/records/{resource}', [AdminWorkspaceController::class, 'createRecord']);
    Route::patch('/records/{resource}/{id}', [AdminWorkspaceController::class, 'updateRecord'])->whereNumber('id');
    Route::delete('/records/{resource}/{id}', [AdminWorkspaceController::class, 'deleteRecord'])->whereNumber('id');
});
