<?php

namespace App\Console\Commands;

use App\Models\Role;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

class CreateAdminUser extends Command
{
    protected $signature = 'kape:create-admin';

    protected $description = 'Create an administrator account using interactive prompts';

    public function handle(): int
    {
        $name = trim((string) $this->ask('Admin name'));
        $email = Str::lower(trim((string) $this->ask('Admin email')));
        $password = (string) $this->secret('Admin password (minimum 12 characters)');
        $passwordConfirmation = (string) $this->secret('Confirm admin password');

        $validator = Validator::make([
            'name' => $name,
            'email' => $email,
            'password' => $password,
            'password_confirmation' => $passwordConfirmation,
        ], [
            'name' => ['required', 'string', 'max:150'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'confirmed', 'max:255', Password::min(12)],
        ]);

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }

        DB::transaction(function () use ($name, $email, $password): void {
            $adminRole = Role::where('name', 'admin')->firstOrFail();
            $user = User::create([
                'name' => $name,
                'email' => $email,
                'password' => $password,
            ]);
            $user->roles()->attach($adminRole);
        });

        $this->info("Administrator account {$email} created.");

        return self::SUCCESS;
    }
}
