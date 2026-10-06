
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, RefreshCw, Search } from "lucide-react";

function getThailandDate() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type) =>
    parts.find((part) => part.type === type)?.value;

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function formatDateTime(value) {
  if (!value) return "—";

  // The API already returns database-local YYYY-MM-DD HH:mm:ss.
  // Display it directly without applying a second timezone conversion.
  const [date, time] = value.split(" ");

  return (
    <div>
      <p className="font-medium tabular-nums">
        {time?.slice(0, 5) || "—"}
      </p>
      <p className="mt-1 text-[11px] text-gray-400">
        {date || ""}
      </p>
    </div>
  );
}

function formatDuration(value) {
  if (value == null) return "—";

  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return "—";

  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;

  if (minutes === 0) return `${seconds}s`;

  return remaining
    ? `${minutes}m ${remaining}s`
    : `${minutes}m`;
}

function StatusBadge({ status }) {
  const labels = {
    REQUESTED: "Requested",
    ARRIVED: "Arrived",
    PREPARING: "Preparing",
    READY: "Ready",
    PICKED_UP: "Picked Up",
    CANCELLED: "Cancelled",
  };

  const styles = {
    REQUESTED: "bg-blue-50 text-blue-700",
    ARRIVED: "bg-indigo-50 text-indigo-700",
    PREPARING: "bg-yellow-50 text-yellow-700",
    READY: "bg-green-50 text-green-700",
    PICKED_UP: "bg-gray-100 text-gray-700",
    CANCELLED: "bg-red-50 text-red-700",
  };

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
        styles[status] || "bg-gray-100 text-gray-600"
      }`}
    >
      {labels[status] || status}
    </span>
  );
}

export default function LogsPage() {
  const [selectedDate, setSelectedDate] = useState(getThailandDate);

  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchLogs = useCallback(
    async (silent = false) => {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const response = await fetch(
          `/api/admin/logs?date=${encodeURIComponent(selectedDate)}`,
          { cache: "no-store" }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Failed to load pickup logs."
          );
        }

        setLogs(data.logs || []);
        setError("");
      } catch (err) {
        console.error("ADMIN PICKUP LOGS:", err);
        setError(
          err.message || "Unable to retrieve pickup logs."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedDate]
  );

  useEffect(() => {
    fetchLogs();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchLogs(true);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchLogs]);

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return logs;

    return logs.filter((log) => {
      const queue = String(log.queue_number ?? "");
      const student = (log.student_name || "").toLowerCase();

      return (
        queue.includes(query) ||
        student.includes(query)
      );
    });
  }, [logs, search]);

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-gray-900">

      {/* PAGE HEADER */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Pickup Logs
          </h1>

          <p className="mt-1 text-sm text-gray-400">
            Complete student pickup records and dismissal durations
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchLogs(true)}
          disabled={loading || refreshing}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-gray-100 disabled:opacity-40"
        >
          <RefreshCw
            size={16}
            className={refreshing ? "animate-spin" : ""}
          />

          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-600"
        >
          {error}
        </div>
      )}

      {/* TABLE CONTAINER */}
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">

        {/* FILTER BAR */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 px-6 py-5">

          <div>
            <h2 className="font-semibold">
              Pickup Records
            </h2>

            <p className="mt-1 text-xs text-gray-400">
              {filteredLogs.length} records displayed
              {search ? ` · ${logs.length} total` : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">

            {/* SEARCH */}
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5">
              <Search size={16} className="text-gray-400" />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Queue or student name"
                aria-label="Search queue or student name"
                className="w-52 bg-transparent text-sm outline-none placeholder:text-gray-400"
              />
            </div>

            {/* DATE SELECTOR */}
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5">
              <CalendarDays
                size={16}
                className="text-gray-400"
              />

              <input
                type="date"
                value={selectedDate}
                onChange={(event) =>
                  setSelectedDate(event.target.value)
                }
                className="bg-transparent text-sm outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => setSelectedDate(getThailandDate())}
              className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium hover:bg-gray-50"
            >
              Today
            </button>
          </div>
        </div>

        {/* DATA TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1350px] text-left text-sm">

            <thead className="bg-gray-50 text-xs uppercase text-gray-400">
              <tr>
                <th className="px-5 py-4">Queue</th>
                <th className="px-5 py-4">Student</th>
                <th className="px-5 py-4">Parent</th>
                <th className="px-5 py-4">Teacher / Gate</th>
                <th className="px-5 py-4">Requested</th>
                <th className="px-5 py-4">Arrival</th>
                <th className="px-5 py-4">Preparing</th>
                <th className="px-5 py-4">Ready</th>
                <th className="px-5 py-4">Picked Up</th>
                <th className="px-5 py-4">Total Duration</th>
                <th className="px-5 py-4">Status</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-5 py-16 text-center text-sm text-gray-400"
                  >
                    Loading pickup logs...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-5 py-16 text-center text-sm text-gray-400"
                  >
                    {search
                      ? "No matching records."
                      : "No pickup records for this date."}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr
                    key={log.pickup_queue_id}
                    className="border-t border-gray-100 align-top transition hover:bg-gray-50"
                  >
                    {/* QUEUE */}
                    <td className="px-5 py-5 font-bold tabular-nums">
                      {log.queue_number ?? "—"}
                    </td>

                    {/* STUDENT */}
                    <td className="px-5 py-5">
                      <p className="font-semibold">
                        {log.student_name}
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        {log.classroom_name || "—"}
                      </p>
                    </td>

                    {/* PARENT */}
                    <td className="px-5 py-5">
                      {log.parent_name || "—"}
                    </td>

                    {/* TEACHER / GATE */}
                    <td className="px-5 py-5">
                      <p className="font-medium">
                        {log.teacher_name || "Unassigned"}
                      </p>

                      {log.gate_slot && (
                        <p className="mt-1 text-xs text-gray-400">
                          Gate {log.gate_slot}
                        </p>
                      )}
                    </td>

                    {/* TIMESTAMPS */}
                    <td className="px-5 py-5">
                      {formatDateTime(log.request_time)}
                    </td>

                    <td className="px-5 py-5">
                      {formatDateTime(log.arrival_time)}
                    </td>

                    <td className="px-5 py-5">
                      {formatDateTime(
                        log.preparation_start_time
                      )}
                    </td>

                    <td className="px-5 py-5">
                      {formatDateTime(log.ready_time)}
                    </td>

                    <td className="px-5 py-5">
                      {formatDateTime(log.pickup_time)}
                    </td>

                    {/* TOTAL DISMISSAL */}
                    <td className="px-5 py-5 font-semibold tabular-nums">
                      {formatDuration(log.dismissal_seconds)}
                    </td>

                    {/* STATUS */}
                    <td className="px-5 py-5">
                      <StatusBadge status={log.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>

          </table>
        </div>

        {/* FOOTER */}
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 text-xs text-gray-400">
          <span>
            Showing {filteredLogs.length} of {logs.length} records
          </span>

          <span>
            Total Duration = Arrival → Picked Up
          </span>
        </div>
      </section>
    </main>
  );
}
