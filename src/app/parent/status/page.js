"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  RefreshCw,
} from "lucide-react";

const STATUS_INFO = {
  REQUESTED: {
    label: "Requested",
    description: "Confirm your arrival when you reach school.",
  },
  ARRIVED: {
    label: "Arrived",
    description:
      "You are in the pickup queue. Waiting for a teacher to begin preparing your child.",
  },
  PREPARING: {
    label: "Preparing",
    description: "A teacher is preparing your child.",
  },
  READY: {
    label: "Ready",
    description: "Your child is ready. Please proceed to the gate.",
  },
};

export default function ParentStatusPage() {
  const [active, setActive] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [handoverQueueId, setHandoverQueueId] = useState(null);

  // Load both active and completed pickups.
  const fetchPickups = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);

    try {
      const response = await fetch("/api/parent/pickups", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to load pickups.");
      }

      const data = await response.json();

      if (
        !data.success ||
        !Array.isArray(data.active) ||
        !Array.isArray(data.completed)
      ) {
        throw new Error("Invalid API response.");
      }

      setActive(data.active);
      setCompleted(data.completed);
      setLastUpdated(new Date());
      setError("");
    } catch (err) {
      console.error(err);
      setError("Unable to update pickup information.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  async function handleHandover(pickupQueueId) {
  if (!pickupQueueId) {
    setError("Pickup queue ID is missing.");
    return;
  }

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

    await fetchPickups(true);
  } catch (error) {
    console.error("HANDOVER ERROR:", error);
    setError(error.message);
  } finally {
    setHandoverQueueId(null);
  }
}

  // Initial fetch and five-second polling.
  useEffect(() => {
    fetchPickups(true);

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchPickups(true);
      }
    }, 5000);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        fetchPickups(true);
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
  }, [fetchPickups]);

  function formatTime(value) {
    if (!value) return "—";

    return new Date(value).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <main className="min-h-screen bg-white pb-32">
      <div className="mx-auto max-w-md">

        {/* HEADER */}

        <header className="px-5 pb-6 pt-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
            Parent Dashboard
          </p>

          <div className="mt-2 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-black">
                Pickup Status
              </h1>

              <p className="mt-1 text-xs text-gray-400">
                Track your children's pickup progress.
              </p>
            </div>

            <button
              type="button"
              onClick={() => fetchPickups()}
              disabled={refreshing}
              aria-label="Refresh pickup status"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 disabled:opacity-40"
            >
              <RefreshCw
                size={17}
                className={refreshing ? "animate-spin" : ""}
              />
            </button>
          </div>
        </header>

        <div className="mx-5 border-t border-gray-100" />

        <section className="px-5 pt-7">

          {/* LOADING */}

          {loading && (
            <p className="text-sm text-gray-400">
              Loading pickup information...
            </p>
          )}

          {/* ERROR */}

          {error && (
            <div className="mb-5 rounded-xl border border-red-100 bg-red-50 p-4">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          {!loading && (
            <>
              {/* ACTIVE PICKUPS */}

              <div className="mb-4 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                  Active Pickups
                </p>

                <span className="text-xs text-gray-400">
                  {active.length}
                </span>
              </div>

              {active.length === 0 && (
                <div className="rounded-2xl border border-gray-200 p-6 text-center">
                  <Clock3
                    size={24}
                    className="mx-auto text-gray-400"
                  />

                  <p className="mt-3 text-sm font-semibold text-black">
                    No active pickups
                  </p>

                  <p className="mt-2 text-xs text-gray-400">
                    Your current requests will appear here.
                  </p>

                  <Link
                    href="/parent/pickup"
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-black px-5 py-3 text-xs font-semibold text-white"
                  >
                    Request Pickup
                    <ArrowRight size={14} />
                  </Link>
                </div>
              )}

              <div className="space-y-3">
                {active.map((pickup) => {
                  const info = STATUS_INFO[pickup.pickup_status];

                  return (
                    <div
                      key={pickup.pickup_queue_id}
                      className="overflow-hidden rounded-2xl border border-gray-200"
                    >
                      <div className="flex items-start justify-between p-5">
                        <div>
                          <h2 className="text-sm font-bold text-black">
                            {pickup.first_name} {pickup.last_name}
                          </h2>

                          <p className="mt-1 text-xs text-gray-400">
                            {pickup.classroom_name}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-widest text-gray-400">
                            Queue
                          </p>

                          <p className="mt-1 text-2xl font-bold text-black">
                            {pickup.queue_number == null
                              ? "—"
                              : `${pickup.queue_number}`}
                          </p>
                        </div>
                      </div>

                      <div className="border-t border-gray-100 bg-gray-50 p-5">
                        <div className="flex items-center gap-2">
                          {pickup.pickup_status === "READY" && (
                            <div className="mt-4">
                              <div className="rounded-lg bg-white p-3">
                                <p className="text-xs font-semibold text-black">
                                  Your child is ready at the pickup gate.
                                </p>

                                <p className="mt-1 text-[11px] leading-5 text-gray-500">
                                  Confirm only after your child has been handed over
                                  to you.
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  handleHandover(pickup.pickup_queue_id)
                                }
                                disabled={
                                  handoverQueueId === pickup.pickup_queue_id
                                }
                                className="mt-3 w-full rounded-xl bg-black px-4 py-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                              >
                                {handoverQueueId === pickup.pickup_queue_id
                                  ? "Confirming..."
                                  : "Confirm Handover"}
                              </button>
                            </div>
                          )}

                          <p className="text-sm font-semibold text-black">
                            {info?.label}
                          </p>
                        </div>

                        <p className="mt-2 text-xs leading-5 text-gray-500">
                          {info?.description}
                        </p>

                        {pickup.pickup_status === "REQUESTED" && (
                          <Link
                            href="/parent"
                            className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-black"
                          >
                            Confirm arrival
                            <ArrowRight size={14} />
                          </Link>
                        )}

                        {pickup.pickup_status === "READY" && (
                          <p className="mt-3 rounded-lg bg-white p-3 text-xs font-semibold text-black">
                            Please proceed to the pickup gate.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* COMPLETED TODAY */}

              <div className="mb-4 mt-10 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                  Completed Today
                </p>

                <span className="text-xs text-gray-400">
                  {completed.length}
                </span>
              </div>

              {completed.length === 0 && (
                <div className="rounded-2xl border border-gray-200 p-5">
                  <p className="text-center text-xs text-gray-400">
                    No completed pickups today.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                {completed.map((pickup) => (
                  <div
                    key={pickup.pickup_queue_id}
                    className="rounded-2xl border border-gray-200 p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                          <CheckCircle2
                            size={19}
                            className="text-black"
                          />
                        </div>

                        <div>
                          <h2 className="text-sm font-semibold text-black">
                            {pickup.first_name} {pickup.last_name}
                          </h2>

                          <p className="mt-1 text-xs text-gray-400">
                            {pickup.classroom_name}
                          </p>
                        </div>
                      </div>

                      <p className="text-sm font-bold text-black">
                        {pickup.queue_number == null
                          ? "—"
                          : `${pickup.queue_number}`}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                      <span className="text-xs font-semibold text-black">
                        Picked Up
                      </span>

                      <span className="text-xs text-gray-500">
                        {formatTime(pickup.pickup_time)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* LAST UPDATED */}

              {lastUpdated && (
                <p className="mt-7 text-center text-[11px] text-gray-400">
                  Automatically updates every 5 seconds
                  <br />
                  Last updated:{" "}
                  {lastUpdated.toLocaleTimeString("en-GB")}
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}