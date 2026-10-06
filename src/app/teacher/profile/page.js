"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  UserRound,
  ShieldCheck,
  ArrowRight,
  Clock3,
  RefreshCw,
} from "lucide-react";
import LogoutButton from "@/components/LogoutButton";

export default function TeacherProfilePage() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [duty, setDuty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchProfile() {
      try {
        const response = await fetch("/api/teacher/profile", {
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Failed to load profile.");
        }

        if (!cancelled) {
          setUser(data.user);
          setDuty(data.duty);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  const roles = user?.roles ?? [];

  const canSwitchToParent = roles.some(
    (role) => role.toLowerCase() === "parent"
  );

  const fullName = user
    ? `${user.first_name} ${user.last_name}`
    : "";

  const initials = user
    ? `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase()
    : "";

  return (
    <main className="min-h-screen bg-white pb-32">
      <div className="mx-auto max-w-md">

        {/* HEADER */}

        <header className="px-5 pb-6 pt-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
            ATG · Teacher Dashboard
          </p>

          <h1 className="mt-2 text-2xl font-bold text-black">
            My Profile
          </h1>

          <p className="mt-1 text-xs text-gray-400">
            Account information and gate assignment.
          </p>
        </header>

        <div className="mx-5 border-t border-gray-100" />

        <section className="px-5 pt-7">

          {loading && (
            <div className="flex items-center gap-3 py-8 text-gray-400">
              <RefreshCw size={17} className="animate-spin" />
              <p className="text-sm">Loading profile...</p>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {!loading && user && (
            <>
              {/* IDENTITY */}

              <div className="rounded-2xl border border-gray-200 p-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-black text-lg font-bold text-white">
                    {initials}
                  </div>

                  <div>
                    <h2 className="text-lg font-bold text-black">
                      {fullName}
                    </h2>

                    <p className="mt-1 text-xs text-gray-400">
                      Currently using Teacher mode
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-5 border-t border-gray-100 pt-5">

                  <div className="flex items-center gap-3">
                    <Mail size={17} className="text-gray-400" />

                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-widest text-gray-400">
                        Email Address
                      </p>

                      <p className="mt-1 break-all text-sm font-medium">
                        {user.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <UserRound size={17} className="text-gray-400" />

                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-gray-400">
                        Teacher ID
                      </p>

                      <p className="mt-1 text-sm font-medium">
                        #{user.teacher_id}
                      </p>
                    </div>
                  </div>

                </div>
              </div>

              {/* TODAY'S DUTY */}

              <div className="mt-8">
                <div className="mb-4 flex items-center gap-2">
                  <Clock3 size={17} />

                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                    Today's Gate Assignment
                  </h3>
                </div>

                <div className="rounded-2xl border border-gray-200 p-5">
                  {duty ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-gray-400">
                          Assigned Position
                        </p>

                        <h4 className="mt-2 text-xl font-bold">
                          Gate {duty.gate_slot}
                        </h4>

                        <p className="mt-2 text-xs text-gray-400">
                          {duty.start_time?.slice(0, 5) ?? "—"}
                          {" – "}
                          {duty.end_time?.slice(0, 5) ?? "—"}
                        </p>
                      </div>

                      <span className="rounded-full bg-gray-100 px-3 py-2 text-xs font-semibold">
                        Assigned
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">
                      No gate duty assigned for today.
                    </p>
                  )}
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
                    const isTeacher =
                      role.toLowerCase() === "teacher";

                    return (
                      <div
                        key={role}
                        className={`flex items-center justify-between rounded-xl border p-4 ${
                          isTeacher
                            ? "border-black bg-black text-white"
                            : "border-gray-200 bg-white text-black"
                        }`}
                      >
                        <div>
                          <p className="text-sm font-semibold">{role}</p>

                          {isTeacher && (
                            <p className="mt-1 text-[11px] text-gray-300">
                              Current mode
                            </p>
                          )}
                        </div>

                        {isTeacher && (
                          <span className="text-xs font-semibold">
                            Active ✓
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SWITCH WORKSPACE */}

              {canSwitchToParent && (
                <div className="mt-8 border-t border-gray-100 pt-6">
                  <p className="text-sm font-semibold text-black">
                    Switch Workspace
                  </p>

                  <p className="mt-2 text-xs leading-5 text-gray-400">
                    Your account also has Parent access.
                    Switch to the Parent dashboard to manage
                    your children's pickups.
                  </p>

                  <button
                    type="button"
                    onClick={() => router.push("/parent")}
                    className="mt-5 flex w-full items-center justify-between rounded-xl bg-black px-5 py-4 text-sm font-semibold text-white"
                  >
                    Switch to Parent Mode
                    <ArrowRight size={17} />
                  </button>
                </div>
              )}

              <div className="mt-9 rounded-xl bg-gray-50 p-4">
                <p className="text-xs font-semibold text-black">
                  Account Information
                </p>

                <p className="mt-2 text-xs leading-5 text-gray-400">
                  Your assigned roles and gate duty schedule
                  are managed by the school administrator.
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