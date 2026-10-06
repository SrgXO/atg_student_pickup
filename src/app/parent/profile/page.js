"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  UserRound,
  Mail,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
} from "lucide-react";

import LogoutButton from "@/components/LogoutButton";

export default function ParentProfile() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ----------------------------------------
  // FETCH CURRENT USER
  // ----------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function fetchCurrentUser() {
      try {
        const response = await fetch("/api/me", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load user profile.");
        }

        const data = await response.json();

        if (!data.success || !data.user) {
          throw new Error("Invalid user response.");
        }

        if (!cancelled) {
          setCurrentUser(data.user);
          setError("");
        }
      } catch (err) {
        console.error("PROFILE ERROR:", err);

        if (!cancelled) {
          setError("Unable to load your profile.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchCurrentUser();

    return () => {
      cancelled = true;
    };
  }, []);

  // ----------------------------------------
  // DERIVED USER INFORMATION
  // ----------------------------------------

  const roles = currentUser?.roles ?? [];

  const canSwitchToTeacher = roles.some(
    (role) => role.toLowerCase() === "teacher"
  );

  const fullName = currentUser
    ? `${currentUser.first_name} ${currentUser.last_name}`
    : "";

  const initials = currentUser
    ? `${currentUser.first_name?.[0] ?? ""}${
        currentUser.last_name?.[0] ?? ""
      }`.toUpperCase()
    : "";

  // ----------------------------------------
  // UI
  // ----------------------------------------

  return (
    <main className="min-h-screen bg-white pb-32">
      <div className="mx-auto max-w-md">

        {/* HEADER */}

        <header className="px-5 pb-6 pt-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
            Parent Dashboard
          </p>

          <h1 className="mt-2 text-2xl font-bold text-black">
            My Profile
          </h1>

          <p className="mt-1 text-xs text-gray-400">
            Your account information and assigned roles.
          </p>
        </header>

        <div className="mx-5 border-t border-gray-100" />

        {/* CONTENT */}

        <section className="px-5 pt-7">

          {loading && (
            <div className="flex items-center gap-3 py-8 text-gray-400">
              <RefreshCw size={17} className="animate-spin" />

              <p className="text-sm">
                Loading your profile...
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-4">
              <p className="text-sm text-red-600">
                {error}
              </p>
            </div>
          )}

          {!loading && currentUser && (
            <>
              {/* PROFILE CARD */}

              <div className="rounded-2xl border border-gray-200 p-5">

                <div className="flex items-center gap-4">

                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-black text-lg font-bold text-white">
                    {initials}
                  </div>

                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-black">
                      {fullName}
                    </h2>

                    <p className="mt-1 text-xs text-gray-400">
                      Currently using Parent mode
                    </p>
                  </div>

                </div>

                <div className="mt-6 border-t border-gray-100 pt-5">

                  <div className="flex items-center gap-3">
                    <Mail size={17} className="text-gray-400" />

                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-widest text-gray-400">
                        Email Address
                      </p>

                      <p className="mt-1 break-all text-sm font-medium text-black">
                        {currentUser.email}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center gap-3">
                    <UserRound size={17} className="text-gray-400" />

                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-gray-400">
                        User ID
                      </p>

                      <p className="mt-1 text-sm font-medium text-black">
                        #{currentUser.user_id}
                      </p>
                    </div>
                  </div>

                </div>
              </div>

              {/* ASSIGNED ROLES */}

              <div className="mt-9">

                <div className="mb-4 flex items-center gap-2">
                  <ShieldCheck size={17} />

                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                    Assigned Roles
                  </h3>
                </div>

                <div className="space-y-3">

                  {roles.map((role) => {
                    const isParent =
                      role.toLowerCase() === "parent";

                    return (
                      <div
                        key={role}
                        className={`flex items-center justify-between rounded-xl border p-4 ${
                          isParent
                            ? "border-black bg-black text-white"
                            : "border-gray-200 bg-white text-black"
                        }`}
                      >
                        <div>
                          <p className="text-sm font-semibold">
                            {role}
                          </p>

                          {isParent && (
                            <p className="mt-1 text-[11px] text-gray-300">
                              Current mode
                            </p>
                          )}
                        </div>

                        {isParent && (
                          <span className="text-xs font-semibold">
                            Active ✓
                          </span>
                        )}
                      </div>
                    );
                  })}

                </div>

              </div>

              {/* TEACHER ROLE SWITCHING */}

              {canSwitchToTeacher && (
                <div className="mt-8 border-t border-gray-100 pt-6">

                  <p className="text-sm font-semibold text-black">
                    Switch Workspace
                  </p>

                  <p className="mt-2 text-xs leading-5 text-gray-400">
                    Your account also has Teacher access.
                    Switch to the Teacher dashboard to
                    access its features.
                  </p>

                  <button
                    type="button"
                    onClick={() => router.push("/teacher")}
                    className="mt-5 flex w-full items-center justify-between rounded-xl bg-black px-5 py-4 text-sm font-semibold text-white"
                  >
                    Switch to Teacher Mode

                    <ArrowRight size={17} />
                  </button>

                </div>
              )}

              {/* ACCOUNT INFORMATION */}

              <div className="mt-9 rounded-xl bg-gray-50 p-4">

                <p className="text-xs font-semibold text-black">
                  Account Information
                </p>

                <p className="mt-2 text-xs leading-5 text-gray-400">
                  Your personal information and assigned
                  roles are managed by the school administrator.
                </p>

              </div>
              <LogoutButton className="mt-5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-50">
                      Logout
                    </LogoutButton>

            </>
          )}

        </section>
      </div>
    </main>
  );
}