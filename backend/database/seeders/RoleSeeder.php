<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        foreach ([
            'customer' => 'Customer',
            'admin' => 'Administrator',
            'manager' => 'Manager',
            'cashier' => 'Cashier',
            'staff' => 'Staff',
        ] as $name => $displayName) {
            Role::updateOrCreate(
                ['name' => $name],
                ['display_name' => $displayName],
            );
        }
    }
}
