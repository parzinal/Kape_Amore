<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CustomerCatalogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user instanceof User && $user->is_active, 403);

        $categories = DB::table('categories')
            ->whereNull('deleted_at')
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        $products = DB::table('products')
            ->whereIn('category_id', $categories->pluck('id'))
            ->whereNull('deleted_at')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map(function (object $product): object {
                $product->is_available = (bool) $product->is_available;

                return $product;
            });

        $variations = DB::table('product_variations')
            ->whereIn('product_id', $products->pluck('id'))
            ->where('is_available', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map(function (object $variation): object {
                $variation->is_available = (bool) $variation->is_available;

                return $variation;
            });

        return response()->json([
            'records' => [
                'categories' => $categories,
                'products' => $products,
                'variations' => $variations,
            ],
        ]);
    }

    public function landing(): JsonResponse
    {
        $value = DB::table('settings')->where('key', 'featured_images')->value('value');
        $images = is_string($value) ? json_decode($value, true) : [];

        return response()->json(['images' => is_array($images) ? $images : []]);
    }
}
