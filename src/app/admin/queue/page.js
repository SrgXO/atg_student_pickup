
"use client";

import { useCallback, useEffect, useState } from "react";

const COLUMNS = [
  {
    title: "Arrived",
    status: "ARRIVED",
    description: "Waiting for teacher assignment",
  },
  {
    title: "Preparing",
    status: "PREPARING",
    description: "Students being fetched",
  },
  {
    title: "Ready",
    status: "READY",
    description: "Awaiting parent handover",
  },
  {
    title: "Picked Up",
    status: "PICKED_UP",
    description: "Completed today",
  },
];

function formatTime(value) {
  if (!value) return null;

  return new Date(value).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function QueuePage() {
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchQueue = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);

      const response = await fetch("/api/admin/queue", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to retrieve queue."
        );
      }

      setQueues(data.queue || []);
      setError("");
      setLastUpdated(new Date());
    } catch (err) {
      console.error("ADMIN QUEUE:", err);
      setError(err.message || "Unable to retrieve queue.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchQueue(true);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchQueue]);

  const activeCount = queues.filter((item) =>
    ["ARRIVED", "PREPARING", "READY"].includes(item.status)
  ).length;

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-gray-900">

      {/* HEADER */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Queue Monitor
          </h1>

          <p className="mt-1 text-sm text-gray-400">
            Live administrative view of student dismissal
          </p>

          <p className="mt-2 text-xs text-gray-500">
            {activeCount} active pickups
            {lastUpdated &&
              ` · Updated ${lastUpdated.toLocaleTimeString(
                "en-GB",
                { timeZone: "Asia/Bangkok" }
              )}`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="rounded-full bg-green-50 px-4 py-2 text-xs font-semibold text-green-700">
            ● Live
          </span>

          <button
            type="button"
            onClick={() => fetchQueue(true)}
            disabled={loading || refreshing}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold transition hover:bg-gray-100 disabled:opacity-50"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600"
        >
          {error}
        </div>
      )}

      {/* QUEUE COLUMNS */}
      <div className="mt-8 grid grid-cols-1 gap-5 xl:grid-cols-4">
        {COLUMNS.map((column) => (
          <QueueColumn
            key={column.status}
            {...column}
            queues={queues}
            loading={loading}
          />
        ))}
      </div>
    </main>
  );
}

function QueueColumn({
  title,
  description,
  status,
  queues,
  loading,
}) {
  const items = queues.filter(
    (item) => item.status === status
  );

  return (
    <section className="self-start overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-200 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">{title}</h2>

          <span className="text-xl font-bold tabular-nums">
            {items.length}
          </span>
        </div>

        <p className="mt-1 text-xs text-gray-400">
          {description}
        </p>
      </div>

      <div className="max-h-[65vh] space-y-3 overflow-y-auto p-4">
        {items.length === 0 ? (
          <p className="py-8 text-center text-xs text-gray-400">
            {loading ? "Loading..." : "No students"}
          </p>
        ) : (
          items.map((item) => (
            <QueueCard
              key={item.pickup_queue_id}
              item={item}
            />
          ))
        )}
      </div>
    </section>
  );
}

function QueueCard({ item }) {
  let timeLabel = "Arrival";
  let timestamp = item.arrival_time;

  if (item.status === "PREPARING") {
    timeLabel = "Preparing since";
    timestamp = item.preparation_start_time;
  }

  if (item.status === "READY") {
    timeLabel = "Ready since";
    timestamp = item.ready_time;
  }

  if (item.status === "PICKED_UP") {
    timeLabel = "Picked up";
    timestamp = item.pickup_time;
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xl font-bold tabular-nums">
          {item.queue_number ?? "—"}
        </p>

        {item.gate_slot && (
          <span className="rounded-md bg-gray-100 px-2 py-1 text-[10px] font-bold">
            Gate {item.gate_slot}
          </span>
        )}
      </div>

      <p className="mt-2 text-sm font-semibold">
        {item.student_name}
      </p>

      <p className="mt-1 text-xs text-gray-400">
        {item.classroom_name || "Classroom unavailable"}
      </p>

      <div className="mt-3 border-t border-gray-100 pt-3">
        <p className="text-xs text-gray-500">
          {item.teacher_name || "Unassigned"}
        </p>

        <p className="mt-2 text-[11px] text-gray-400">
          {timeLabel}: {formatTime(timestamp) || "—"}
        </p>
      </div>
    </div>
  );
}
