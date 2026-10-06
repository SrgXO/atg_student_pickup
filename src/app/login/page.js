"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ROLE_PATHS = {
  PARENT: "/parent",
  TEACHER: "/teacher",
  ADMIN: "/admin",
};

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [signedInUser, setSignedInUser] =
    useState(null);

  async function handleLogin(event) {
    event.preventDefault();

    if (loading) return;

    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/auth/login",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            email,
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to sign in."
        );
      }

      const validRoles = data.user.roles.filter(
        (role) => ROLE_PATHS[role]
      );

      if (validRoles.length === 0) {
        throw new Error(
          "No valid dashboard role assigned."
        );
      }

      // One role -> directly enter dashboard
      if (validRoles.length === 1) {
        router.replace(
          ROLE_PATHS[validRoles[0]]
        );

        router.refresh();
        return;
      }

      // Multiple roles -> let user choose
      setSignedInUser({
        ...data.user,
        roles: validRoles,
      });

    } catch (error) {
      console.error("LOGIN ERROR:", error);
      setError(error.message);

    } finally {
      setLoading(false);
    }
  }

  function selectRole(role) {
    if (!signedInUser?.roles.includes(role)) {
      return;
    }

    router.replace(ROLE_PATHS[role]);
    router.refresh();
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
    });

    setSignedInUser(null);
    setPassword("");
    setError("");
  }

  return (
    <main className="min-h-screen bg-white px-6 py-10">
      <div className="mx-auto flex min-h-[800px] max-w-md flex-col justify-center">

        <div className="mb-12 text-center">
          <img
            src="/ATG_logo.png"
            alt="ATG Logo"
            className="mx-auto mb-4 w-32"
          />

          <h1 className="text-lg font-bold">
            Student Pickup Management System
          </h1>

          <p className="mt-2 text-sm text-gray-400">
            {signedInUser
              ? "Choose your dashboard"
              : "Sign in to continue"}
          </p>
        </div>

        <div className="rounded-3xl border border-gray-200 p-6">

          {signedInUser ? (
            <>
              <h2 className="font-bold">
                Welcome, {signedInUser.first_name}
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                Select which dashboard you want to use.
              </p>

              <div className="mt-6 space-y-3">

                {signedInUser.roles.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() =>
                      selectRole(role)
                    }
                    className="w-full rounded-xl border border-gray-200 px-4 py-4 text-left font-semibold hover:border-black"
                  >
                    {role}
                  </button>
                ))}

              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="mt-6 w-full text-sm text-gray-500 underline"
              >
                Sign out
              </button>
            </>
          ) : (
            <form onSubmit={handleLogin}>

              <div className="mb-5">

                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Email Address
                </label>

                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="you@atg.edu"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm outline-none focus:border-black"
                />

              </div>

              <div className="mb-5">

                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Password
                </label>

                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm outline-none focus:border-black"
                />

              </div>

              {error && (
                <p className="mb-5 text-sm text-red-600">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-black py-4 font-semibold text-white disabled:opacity-50"
              >
                {loading
                  ? "Signing in..."
                  : "Sign in"}
              </button>

            </form>
          )}

        </div>

        <div className="mt-10 text-center text-xs text-gray-400">

          <p>
            Need an account? Contact school admin
          </p>

          <p className="mt-4">
            ATG Student Pickup System v1.0
          </p>

        </div>

      </div>
    </main>
  );
}