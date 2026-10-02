<?php

use App\Http\Controllers\AuthController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('/user', [AuthController::class, 'currentUser']);
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
