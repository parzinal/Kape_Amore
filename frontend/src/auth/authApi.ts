export type AuthUser = {
  id: number;
  name: string;
  email: string;
  roles: string[];
};

type AuthResponse = {
  user: AuthUser;
  message?: string;
};

const apiOrigin = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "")
  ?? "http://127.0.0.1:8000";

function readCookie(name: string): string | null {
  const cookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}

async function readMessage(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);

  if (body && typeof body === "object" && "errors" in body) {
    const errors = (body as { errors?: Record<string, string[]> }).errors;
    const firstError = errors ? Object.values(errors).flat()[0] : undefined;
    if (firstError) return firstError;
  }

  if (body && typeof body === "object" && "message" in body) {
    const message = (body as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }

  return response.status === 419
    ? "Your session expired. Refresh the page and try again."
    : "We couldn't complete that request. Please try again.";
}

async function csrfCookie(): Promise<void> {
  const response = await fetch(`${apiOrigin}/sanctum/csrf-cookie`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error("Unable to start a secure session. Check that the Kape Amore server is running.");
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const xsrfToken = readCookie("XSRF-TOKEN");
  const response = await fetch(`${apiOrigin}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(xsrfToken ? { "X-XSRF-TOKEN": xsrfToken } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(await readMessage(response));
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function withUser(payload: AuthResponse): AuthUser {
  if (!payload?.user || !Array.isArray(payload.user.roles)) {
    throw new Error("The server returned an invalid account response.");
  }
  return payload.user;
}

export const authApi = {
  async currentUser(): Promise<AuthUser | null> {
    const response = await fetch(`${apiOrigin}/api/user`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (response.status === 401) return null;
    if (!response.ok) throw new Error(await readMessage(response));
    const payload = await response.json() as AuthResponse;
    return withUser(payload);
  },

  async login(email: string, password: string, remember: boolean): Promise<AuthUser> {
    await csrfCookie();
    const payload = await request<AuthResponse>("/login", {
      method: "POST",
      body: JSON.stringify({ email, password, remember }),
    });
    return withUser(payload);
  },

  async register(name: string, email: string, password: string, passwordConfirmation: string): Promise<AuthUser> {
    await csrfCookie();
    const payload = await request<AuthResponse>("/register", {
      method: "POST",
      body: JSON.stringify({
        name,
        email,
        password,
        password_confirmation: passwordConfirmation,
      }),
    });
    return withUser(payload);
  },

  async sendPasswordReset(email: string): Promise<string> {
    await csrfCookie();
    const payload = await request<{ message: string }>("/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    return payload.message;
  },

  async resetPassword(input: {
    token: string;
    email: string;
    password: string;
    passwordConfirmation: string;
  }): Promise<string> {
    await csrfCookie();
    const payload = await request<{ message: string }>("/reset-password", {
      method: "POST",
      body: JSON.stringify({
        token: input.token,
        email: input.email,
        password: input.password,
        password_confirmation: input.passwordConfirmation,
      }),
    });
    return payload.message;
  },

  async logout(): Promise<void> {
    await request<void>("/logout", { method: "POST" });
  },
};
