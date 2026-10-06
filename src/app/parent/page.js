"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";


export default function ParentPage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [arrivingRequestId, setArrivingRequestId] = useState(null);
  const [handoverQueueId, setHandoverQueueId] = useState(null); 
  const [currentUser, setCurrentUser] = useState(null);
  const [userError, setUserError] = useState("");
  // --------------------------------------------------
  // CURRENT DATE
  // --------------------------------------------------

  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  async function fetchCurrentUser() {
  try {
    const response = await fetch("/api/me", {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Failed to load user information.");
    }

    const data = await response.json();

    if (!data.success || !data.user) {
      throw new Error("Invalid user response.");
    }

    setCurrentUser(data.user);
    setUserError("");
  } catch (error) {
    console.error("USER ERROR:", error);
    setUserError("Unable to load profile.");
  }
}
  // --------------------------------------------------
  // FETCH CHILDREN + CURRENT PICKUP STATUS
  // --------------------------------------------------

  async function fetchChildren() {
    try {
      const response = await fetch("/api/parent/children", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch student data");
      }

      const data = await response.json();

      setStudents(data.children ?? []);
      setError("");
    } catch (error) {
      console.error(error);
      setError("Failed to load your children.");
    } finally {
      setLoading(false);
    }
  }

  // Load children when Parent Home first opens.
  useEffect(() => {
  fetchCurrentUser();
  fetchChildren();

  // Refresh pickup information every 5 seconds.
  const interval = setInterval(() => {
    if (document.visibilityState === "visible") {
      fetchChildren();
    }
  }, 5000);

  // Immediately refresh when returning to the tab.
  function handleVisibilityChange() {
    if (document.visibilityState === "visible") {
      fetchChildren();
    }
  }

  document.addEventListener(
    "visibilitychange",
    handleVisibilityChange
  );

  return () => {
    clearInterval(interval);

    document.removeEventListener(
      "visibilitychange",
      handleVisibilityChange
    );
  };
}, []);

  // --------------------------------------------------
  // I'VE ARRIVED
  // --------------------------------------------------

  async function handleArrival(pickupRequestId) {
    try {
      setArrivingRequestId(pickupRequestId);
      setError("");

      const response = await fetch(
        `/api/pickups/${pickupRequestId}/arrive`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to confirm arrival."
        );
    } await fetchChildren();
    } catch (error) {
      console.error(error);
      setError(error.message);
    } finally {
      setArrivingRequestId(null);
    }
  }

async function handleHandover(pickupQueueId) {
  if (!pickupQueueId) {
    setError("Pickup queue ID is missing. Please refresh.");
    return;
  }

  if (handoverQueueId !== null) return;

  try {
    setHandoverQueueId(pickupQueueId);
    setError("");

    const response = await fetch(
      `/api/parent/pickups/${pickupQueueId}/handover`,
      {
        method: "POST",
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Failed to confirm handover."
      );
    }

    await fetchChildren();
  } catch (error) {
    console.error("PARENT HOME HANDOVER ERROR:", error);
    setError(error.message);
  } finally {
    setHandoverQueueId(null);
  }
}

  


  // --------------------------------------------------
  // CHILDREN AVAILABLE FOR A NEW PICKUP
  // --------------------------------------------------

  const availableChildren = students.filter(
    (student) => !student.pickup_status); 


  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <main className="min-h-screen bg-white pb-28">
      <div className="mx-auto max-w-md">

        {/* HEADER */}

        <header className="px-5 pb-6 pt-10">
          <div className="flex items-start justify-between">

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                Good afternoon
              </p>

              <h1 className="mt-1 text-xl font-bold text-black">
                {currentUser 
                  ? `${currentUser.first_name} ${currentUser.last_name}`
                  : userError 
                    ? "Profile unavailable"
                    : "Loading..."
                }
                
                
              
              </h1>

              <p className="mt-1 text-xs text-gray-400">
                {currentDate}
              </p>
            </div>

            <Link
              href="/parent/profile"
              className="rounded-full bg-black px-8 py-1.5 text-xs font-semibold text-white"
            >
              {currentUser?.roles?.includes("Parent") //case-sensitive care
              ? "Parent"
              : "Profile"}

            </Link>

          </div>
        </header>

        <div className="mx-5 border-t border-gray-100" />

        {/* CHILDREN */}

        <section className="px-5 pt-7">

          {/* SECTION HEADER */}

          <div className="mb-4 flex items-center justify-between">

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                My Children
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Manage today's pickup
              </p>
            </div>

            {!loading && !error && (
              <span className="text-xs text-gray-400">
                {students.length}{" "}
                {students.length === 1
                  ? "child"
                  : "children"}
              </span>
            )}

          </div>

          {/* LOADING */}

          {loading && (
            <div className="rounded-2xl border border-gray-200 p-5">
              <p className="text-sm text-gray-400">
                Loading children...
              </p>
            </div>
          )}

          {/* ERROR */}

          {error && (
            <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-4">
              <p className="text-sm text-red-500">
                {error}
              </p>
            </div>
          )}

          {/* CHILD CARDS */}

          {!loading && (
            <div className="space-y-3">

              {students.map((student) => {
                const status = student.pickup_status;

                return (
                  <div
                    key={student.student_id}
                    className="rounded-2xl border border-gray-200 bg-white p-4"
                  >

                    {/* CHILD INFORMATION */}

                    <div className="flex items-center gap-3">

                      {/* INITIALS */}

                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-600">
                        {student.first_name?.[0]}
                        {student.last_name?.[0]}
                      </div>

                      {/* NAME + CLASS */}

                      <div className="min-w-0 flex-1">

                        <h2 className="truncate text-sm font-semibold text-black">
                          {student.first_name}{" "}
                          {student.last_name}
                        </h2>

                        <p className="mt-0.5 text-xs text-gray-400">
                          {student.grade_level}

                          {student.classroom_name &&
                            ` • ${student.classroom_name}`}
                        </p>

                      </div>

                    </div>

                    {/* PICKUP STATE */}

                    <div className="mt-4 border-t border-gray-100 pt-3">

                      {/* -------------------------------- */}
                      {/* NO ACTIVE PICKUP */}
                      {/* -------------------------------- */}

                      {!status && (
                        <div className="flex items-center justify-between">

                          <div className="flex items-center gap-2">

                            <span className="h-2 w-2 rounded-full bg-gray-300" />

                            <span className="text-xs text-gray-500">
                              No active pickup
                            </span>

                          </div>

                          <Link
                            href={`/parent/pickup?student=${student.student_id}`}
                            className="flex items-center gap-1 text-xs font-semibold text-black"
                          >
                            Request

                            <ChevronRight size={14} />
                          </Link>

                        </div>
                      )}

                      {/* -------------------------------- */}
                      {/* REQUESTED */}
                      {/* -------------------------------- */}

                      {student.pickup_status === "REQUESTED" && (
                
                        <div>

                          <div className="flex items-center gap-2">

                            <span className="h-2 w-2 rounded-full bg-black" />

                            <span className="text-xs font-semibold text-black">
                              Pickup requested
                            </span>

                          </div>

                          <p className="mt-2 text-xs leading-5 text-gray-400">
                            Let us know when you arrive at
                            school.
                          </p>

                          <button
                            type="button"
                            onClick={() =>
                              handleArrival(
                                student.pickup_request_id
                              )
                            }
                            disabled={
                              arrivingRequestId ===
                              student.pickup_request_id
                            }
                            className="mt-3 w-full rounded-xl bg-black px-4 py-3 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-gray-300"
                          >
                            {arrivingRequestId ===
                            student.pickup_request_id
                              ? "Confirming..."
                              : "I've Arrived"}
                          </button>

                        </div>
                      )}
                      {/* -------------------------------- */}
                      {/* ARRIVED */}
                      {/* -------------------------------- */}

                      {student.pickup_status === "ARRIVED" && (
                        <div className="flex items-start justify-between">
                          <div className="pr-4">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-black" />

                              <span className="text-xs font-semibold text-black">
                                Arrived
                              </span>
                            </div>

                            <p className="mt-2 text-xs leading-5 text-gray-400">
                              You are in the pickup queue. Waiting for a teacher
                              to begin preparing {student.first_name}.
                            </p>
                          </div>

                          <div className="shrink-0 text-right">
                            <p className="text-[10px] uppercase tracking-wider text-gray-400">
                              Queue
                            </p>

                            <p className="text-xl font-bold text-black">
                              {student.queue_number ?? "—"}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* -------------------------------- */}
                      {/* PREPARING */}
                      {/* -------------------------------- */}

                      {student.pickup_status === "PREPARING" && (
                        <div className="flex items-start justify-between">

                          <div className="pr-4">

                            <div className="flex items-center gap-2">

                              <span className="h-2 w-2 rounded-full bg-black" />

                              <span className="text-xs font-semibold text-black">
                                Preparing
                              </span>

                            </div>

                            <p className="mt-2 text-xs leading-5 text-gray-400">
                              A teacher is preparing{" "}
                              {student.first_name}.
                            </p>

                          </div>

                          {/* QUEUE NUMBER */}

                          <div className="shrink-0 text-right">

                            <p className="text-[10px] uppercase tracking-wider text-gray-400">
                              Queue
                            </p>

                            <p className="text-xl font-bold text-black">
                              {student.queue_number}
                            </p>

                          </div>

                        </div>
                      )}

                      {/* -------------------------------- */}
                      {/* READY */}
                      {/* -------------------------------- */}

                      {student.pickup_status === "READY" && (
                        <div>
                          <div className="flex items-start justify-between">
                            <div className="pr-4">
                              <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-black" />

                                <span className="text-xs font-semibold text-black">
                                  Ready
                                </span>
                              </div>

                              <p className="mt-2 text-xs leading-5 text-gray-500">
                                {student.first_name} is ready at the gate.
                                Confirm once your child has been handed over to you.
                              </p>
                            </div>

                            <div className="shrink-0 text-right">
                              <p className="text-[10px] uppercase tracking-wider text-gray-400">
                                Queue
                              </p>

                              <p className="text-xl font-bold text-black">
                                {student.queue_number ?? "—"}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              handleHandover(student.pickup_queue_id)
                            }
                            disabled={
                              handoverQueueId !== null 
                            }
                            className="mt-4 w-full rounded-xl bg-black px-4 py-3 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-gray-300"
                          >
                            {handoverQueueId === student.pickup_queue_id
                              ? "Confirming..."
                              : "Confirm Handover"}
                          </button>
                        </div>
                      )}
                      {student.pickup_status === "PICKED_UP" && (
                          <div className="mt-4 rounded-xl bg-gray-100 px-4 py-3">
                            <p className="text-sm font-semibold text-black">
                              Picked Up
                            </p>

                            <p className="mt-1 text-xs text-gray-500">
                              Pickup completed today. New requests are unavailable.
                            </p>
                          </div>
                        )}

                    </div>
                  </div>
                );
              })}

            </div>
          )}

          {/* MULTI-CHILD PICKUP */}

          {!loading &&
            !error &&
            availableChildren.length > 1 && (
              <Link
                href="/parent/pickup"
                className="mt-5 flex w-full items-center justify-center rounded-xl bg-black px-4 py-3.5 text-sm font-semibold text-white transition active:scale-[0.99]"
              >
                Request Pickup for Multiple Children
              </Link>
            )}

        </section>
      </div>
    </main>
  );
}