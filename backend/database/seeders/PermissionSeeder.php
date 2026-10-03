<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        $permissions = [
            'dashboard.view' => 'View dashboard',
            'pos.use' => 'Use point of sale',
            'catalog.manage' => 'Manage menu catalog',
            'tables.manage' => 'Manage dining tables',
            'payments.manage' => 'Manage payments and refunds',
            'inventory.manage' => 'Manage inventory',
            'delivery.manage' => 'Manage deliveries',
            'customers.manage' => 'Manage customers and discounts',
            'reports.view' => 'View reports',
            'admin.manage' => 'Manage staff, permissions, and settings',
        ];

        $records = [];
        foreach ($permissions as $name => $displayName) {
            $records[$name] = Permission::updateOrCreate(['name' => $name], ['display_name' => $displayName]);
        }

        $defaultAccess = [
            'manager' => array_values(array_diff(array_keys($permissions), ['admin.manage'])),
            'cashier' => ['dashboard.view', 'pos.use', 'payments.manage', 'customers.manage'],
            'staff' => ['dashboard.view', 'pos.use'],
        ];
        foreach ($defaultAccess as $roleName => $allowed) {
            $role = Role::where('name', $roleName)->firstOrFail();
            $role->permissions()->sync(array_map(fn (string $name): int => $records[$name]->id, $allowed));
        }
    }
}
