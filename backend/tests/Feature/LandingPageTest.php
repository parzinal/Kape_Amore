<?php

namespace Tests\Feature;

use Tests\TestCase;

class LandingPageTest extends TestCase
{
    public function test_root_redirects_to_the_react_frontend(): void
    {
        $this->get('/')
            ->assertRedirect(config('app.frontend_url'));
    }
}
