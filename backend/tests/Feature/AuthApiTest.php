<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
    }

    public function test_customer_registration_assigns_customer_role_and_starts_a_session(): void
    {
        $response = $this->postJson('/register', [
            'name' => 'Ari Santos',
            'email' => 'ARI@example.com',
            'password' => 'CoffeePassword123',
            'password_confirmation' => 'CoffeePassword123',
        ]);

        $response->assertCreated()
            ->assertJsonPath('user.name', 'Ari Santos')
            ->assertJsonPath('user.email', 'ari@example.com')
            ->assertJsonPath('user.roles', ['customer'])
            ->assertJsonMissingPath('user.password');

        $this->assertAuthenticated();
        $this->assertDatabaseHas('users', ['email' => 'ari@example.com']);
        $this->assertDatabaseHas('role_user', [
            'user_id' => User::where('email', 'ari@example.com')->value('id'),
            'role_id' => Role::where('name', 'customer')->value('id'),
        ]);
    }

    public function test_public_registration_rejects_submitted_role_or_permission_fields(): void
    {
        $this->postJson('/register', [
            'name' => 'Mallory',
            'email' => 'mallory@example.com',
            'password' => 'CoffeePassword123',
            'password_confirmation' => 'CoffeePassword123',
            'role' => 'admin',
            'permissions' => ['manage-users'],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['role', 'permissions']);

        $this->assertDatabaseMissing('users', ['email' => 'mallory@example.com']);
    }

    public function test_login_returns_roles_and_rejects_invalid_credentials(): void
    {
        $user = User::factory()->create(['password' => 'CoffeePassword123']);
        $user->roles()->attach(Role::where('name', 'customer')->firstOrFail());

        $this->postJson('/login', [
            'email' => strtoupper($user->email),
            'password' => 'wrong-password',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('email');

        $this->postJson('/login', [
            'email' => strtoupper($user->email),
            'password' => 'CoffeePassword123',
            'remember' => true,
        ])->assertOk()
            ->assertJsonPath('user.roles', ['customer'])
            ->assertJsonMissingPath('user.password');

        $this->assertAuthenticatedAs($user);
        $this->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('user.id', $user->id);
    }

    public function test_disabled_users_cannot_login_or_access_authenticated_endpoints(): void
    {
        $user = User::factory()->create([
            'email' => 'disabled@example.com',
            'password' => 'CoffeePassword123',
            'is_active' => false,
        ]);

        $this->postJson('/login', [
            'email' => $user->email,
            'password' => 'CoffeePassword123',
        ])->assertUnprocessable();

        $this->actingAs($user)->getJson('/api/user')->assertUnauthorized();
    }

    public function test_admin_endpoint_rejects_unauthenticated_requests(): void
    {
        $this->getJson('/api/admin/me')->assertUnauthorized();
    }

    public function test_admin_endpoint_rejects_customers(): void
    {
        $customer = User::factory()->create();
        $customer->roles()->attach(Role::where('name', 'customer')->firstOrFail());

        $this->actingAs($customer)->getJson('/api/admin/me')->assertForbidden();
    }

    public function test_admin_endpoint_allows_an_active_admin(): void
    {
        $admin = User::factory()->create();
        $admin->roles()->attach(Role::where('name', 'admin')->firstOrFail());
        $this->assertTrue($admin->is_active);
        $this->assertSame(['admin'], $admin->roles()->pluck('name')->all());

        $this->actingAs($admin)->getJson('/api/admin/me')
            ->assertOk()
            ->assertJsonPath('user.roles', ['admin']);
    }

    public function test_admin_account_can_only_be_created_through_the_interactive_command(): void
    {
        $this->artisan('kape:create-admin')
            ->expectsQuestion('Admin name', 'Kape Owner')
            ->expectsQuestion('Admin email', 'OWNER@example.com')
            ->expectsQuestion('Admin password (minimum 12 characters)', 'SecureCoffeePassword123')
            ->expectsQuestion('Confirm admin password', 'SecureCoffeePassword123')
            ->assertExitCode(0);

        $admin = User::where('email', 'owner@example.com')->firstOrFail();
        $this->assertTrue(Hash::check('SecureCoffeePassword123', $admin->password));
        $this->assertSame(['admin'], $admin->roles()->pluck('name')->all());
    }

    public function test_logout_invalidates_the_authenticated_session(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);

        $this->postJson('/logout')->assertOk();
        $this->assertGuest();
        $this->getJson('/api/user')->assertUnauthorized();
    }

    public function test_password_reset_request_is_generic_and_valid_tokens_change_password(): void
    {
        Notification::fake();
        $user = User::factory()->create();

        $genericMessage = 'If an account exists for that email, password reset instructions will be sent.';

        $this->postJson('/forgot-password', ['email' => 'missing@example.com'])
            ->assertOk()
            ->assertJsonPath('message', $genericMessage);

        $this->postJson('/forgot-password', ['email' => $user->email])
            ->assertOk()
            ->assertJsonPath('message', $genericMessage);

        $token = null;
        Notification::assertSentTo($user, ResetPassword::class, function (ResetPassword $notification) use (&$token, $user): bool {
            $token = $notification->token;
            $resetUrl = $notification->toMail($user)->actionUrl;

            return str_starts_with($resetUrl, 'http://127.0.0.1:5174/reset-password?')
                && str_contains($resetUrl, 'email='.urlencode($user->email))
                && str_contains($resetUrl, 'token='.urlencode($token));
        });

        $this->postJson('/reset-password', [
            'token' => $token,
            'email' => $user->email,
            'password' => 'NewCoffeePassword456',
            'password_confirmation' => 'NewCoffeePassword456',
        ])->assertOk();

        $this->assertTrue(Hash::check('NewCoffeePassword456', $user->fresh()->password));
    }

    public function test_login_attempts_are_rate_limited(): void
    {
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->postJson('/login', [
                'email' => 'limit@example.com',
                'password' => 'incorrect',
            ])->assertUnprocessable();
        }

        $this->postJson('/login', [
            'email' => 'limit@example.com',
            'password' => 'incorrect',
        ])->assertTooManyRequests();
    }

    public function test_frontend_origin_receives_credentialed_cors_headers(): void
    {
        $this->withHeader('Origin', 'http://127.0.0.1:5174')
            ->options('/login')
            ->assertHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:5174')
            ->assertHeader('Access-Control-Allow-Credentials', 'true');
    }
}
