
"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock3, RefreshCw } from "lucide-react";

export default function TeacherHistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const filteredHistory = history.filter((item) => {
    const keyword = search.toLowerCase().trim();

    const searchableText = [
      item.queue_number,
      item.student_first_name,
      item.student_last_name,
      //item.classroom_name,
      //item.handler_first_name,
     // item.handler_last_name,
    //  item.handover_first_name,
     // item.handover_last_name,
    ]
      .filter((value) => value != null)
      .join(" ")
      .toLowerCase();

    return searchableText.includes(keyword);
  });

  const fetchHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/teacher/history", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to load history.");
      }

      setHistory(data.history ?? []);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchHistory();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchHistory]);

  function formatTime(value) {
    if (!value) return "—";

    return new Date(value).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatDuration(seconds) {
    if (seconds == null) return "—";

    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;

    return `${minutes}m ${remaining}s`;
  }

  return (
    <main className="min-h-screen bg-white pb-32">
      <div className="mx-auto max-w-md px-5 pt-10">

        {/* HEADER */}

        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
          ATG · Teacher Dashboard
        </p>

        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            Pickup History
          </h1>

          <button
            type="button"
            onClick={fetchHistory}
            aria-label="Refresh history"
            className="rounded-full border border-gray-200 p-3"
          >
            <RefreshCw size={17} />
          </button>
        </div>

        <p className="mt-2 text-sm text-gray-400">
          Completed handovers today
        </p>

        {/* SUMMARY */}

        <div className="mt-7 rounded-2xl bg-black p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-300">
                Total Completed
              </p>

              <p className="mt-2 text-3xl font-bold">
                {history.length}
              </p>
            </div>

            <CheckCircle2 size={28} />
          </div>
        </div>

        {/* ERRORS */}

        {error && (
          <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-600">
            {error}
          </p>
        )}

        {loading && (
          <p className="mt-8 text-center text-sm text-gray-400">
            Loading history...
          </p>
        )}

        {/* COMPLETED RECORDS */}
                <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search student or queue number..."
          className="mt-6 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black"
        />

        {!loading && history.length === 0 && (
          <div className="mt-7 rounded-2xl border border-gray-200 p-7 text-center">
            <p className="text-sm text-gray-400">
              No completed pickups today.
            </p>
          </div>
        )}

        <div className="mt-7 space-y-4">
          {filteredHistory.map((item) => (
            <div
              key={item.pickup_queue_id}
              className="rounded-2xl border border-gray-200 p-5"
            >

              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-gray-400">
                    Queue Number
                  </p>

                  <h2 className="mt-1 text-2xl font-bold">
                    {item.queue_number}
                  </h2>
                </div>

                <span className="rounded-full bg-black px-3 py-2 text-[10px] font-semibold text-white">
                  COMPLETED
                </span>
              </div>

              <h3 className="mt-5 text-sm font-bold">
                {item.student_first_name}{" "}
                {item.student_last_name}
              </h3>

              <p className="mt-1 text-xs text-gray-400">
                {item.classroom_name}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">

                <TimeItem
                  label="Arrived"
                  value={formatTime(item.arrival_time)}
                />

                <TimeItem
                  label="Ready"
                  value={formatTime(item.ready_time)}
                />

                <TimeItem
                  label="Picked Up"
                  value={formatTime(item.pickup_time)}
                />

                <TimeItem
                  label="Dismissal Duration"
                  value={formatDuration(item.dismissal_seconds)}
                />

              </div>

              <div className="mt-5 border-t border-gray-100 pt-4">

                <p className="text-xs text-gray-400">
                  Prepared by
                </p>

                <p className="mt-1 text-sm font-semibold">
                  {item.handler_first_name
                    ? `${item.handler_first_name} ${item.handler_last_name}`
                    : "Not recorded"}

                  {item.handler_gate_slot
                    ? ` · Gate ${item.handler_gate_slot}`
                    : ""}
                </p>

                <p className="mt-4 text-xs text-gray-400">
                  Handover confirmed by parent 
                </p>

                

              </div>

              <div className="mt-5 flex items-center gap-2 rounded-xl bg-gray-50 p-3">
                <Clock3 size={15} className="text-gray-400" />

                <p className="text-xs text-gray-500">
                  Completed at {formatTime(item.pickup_time)}
                </p>
              </div>

            </div>
          ))}
        </div>

      </div>
    </main>
  );
}

function TimeItem({ label, value }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-gray-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold">
        {value}
      </p>
    </div>
  );
}
