
"use client";

import { useCallback, useEffect, useState } from "react";

import {
  ClipboardList,
  Clock3,
  CircleCheck,
  UserCheck,
} from "lucide-react";

// Temporary demonstration data.
// Will be replaced by the Admin Duty API.


export default function AdminPage() {
  const [overview, setOverview] = useState(null);

  const [recentPickups, setRecentPickups] = useState([]);
  const [recentError, setRecentError] = useState("");

  const [dutyTeachers, setDutyTeachers] = useState([]);
  const [dutyError, setDutyError] = useState("");

  

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);


  // --------------------------------
  // FETCH ADMIN OVERVIEW
  // --------------------------------

  const fetchOverview = useCallback(async (silent = false) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
  

      const response = await fetch("/api/admin/overview", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to load Admin Overview."
        );
      }

      setOverview(data);
      setLastUpdated(new Date());
      setError("");
    } catch (err) {
      console.error("ADMIN OVERVIEW ERROR:", err);

      setError(
        err.message || "Failed to retrieve dashboard data."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

const fetchRecentPickups = useCallback(async () => {
  try {
    const response = await fetch("/api/admin/recent-pickups", {
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Failed to load recent pickups."
      );
    }

    setRecentPickups(data.pickups);
    setRecentError("");
  } catch (error) {
    console.error("RECENT PICKUPS ERROR:", error);
    setRecentError(error.message);
  }
}, []);


const fetchDutyTeachers = useCallback(async () => {
  try {
    const response = await fetch("/api/admin/on-duty", {
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Failed to load duty assignments."
      );
    }

    setDutyTeachers(data.teachers);
    setDutyError("");
  } catch (error) {
    console.error("ADMIN DUTY ERROR:", error);
    setDutyError(error.message);
  }
}, []);






  // --------------------------------
  // INITIAL LOAD + AUTO REFRESH
  // --------------------------------

  useEffect(() => {
    fetchOverview();
    fetchRecentPickups();
    fetchDutyTeachers(); 
    

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchOverview(true);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchOverview, 
    fetchRecentPickups, 
    fetchDutyTeachers,
    
  ]);

  // --------------------------------
  // LIVE STATISTICS
  // --------------------------------

  const counts = overview?.counts;

  function stat(key) {
    if (!counts) return "—";

    return counts[key] ?? 0;
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">

      {/* HEADER */}
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-8 py-5">
        <div>
          <h1 className="text-2xl font-bold">
            Admin Dashboard
          </h1>

          <p className="mt-1 text-sm text-gray-400">
            Student pickup operations overview
          </p>
        </div>

        <div className="text-right">
          <p className="text-sm font-semibold">
            Administrator
          </p>

          <p className="text-xs text-gray-400">
            ATG School
          </p>
        </div>
      </header>

      {/* DASHBOARD CONTENT */}
      <div className="space-y-8 p-8">

        {/* LIVE DATA INDICATOR */}
        <div className="flex items-center justify-between">

          <div>
            {error ? (
              <p
                className="text-xs font-medium text-red-600"
                role="alert"
              >
                {error}
              </p>
            ) : (
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500" />

                <p className="text-xs text-gray-500">
                  {loading
                    ? "Loading live statistics..."
                    : `Today's pickup statistics · ${
                        overview?.date ?? ""
                      }`}
                </p>
              </div>
            )}

            {lastUpdated && (
              <p className="mt-1 text-[11px] text-gray-400">
                Last updated:{" "}
                {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => fetchOverview(true)}
            disabled={loading || refreshing}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {/* SUMMARY CARDS */}
        <section className="grid grid-cols-4 gap-5">

          <StatCard
            title="Total Pickups"
            value={stat("total")}
            subtitle="Today"
            icon={<ClipboardList size={20} />}
          />

          <StatCard
            title="Preparing"
            value={stat("preparing")}
            subtitle="Active requests"
            icon={<Clock3 size={20} />}
          />

          <StatCard
            title="Ready"
            value={stat("ready")}
            subtitle="Waiting at gate"
            icon={<CircleCheck size={20} />}
          />

          <StatCard
            title="Picked Up"
            value={stat("completed")}
            subtitle="Completed today"
            icon={<UserCheck size={20} />}
          />

        </section>

        {/* MAIN INFORMATION */}
        <section className="grid grid-cols-3 gap-6">

          {/* RECENT PICKUPS */}
          <div className="col-span-2 overflow-hidden rounded-xl border border-gray-200 bg-white">

            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
              <div>
                <h2 className="font-semibold">
                  Recent Pickup Activity
                </h2>

                <p className="mt-1 text-xs text-gray-400">
                  Latest pickup requests today
                </p>

        
              </div>

              <a
                href="/admin/logs"
                className="text-sm font-semibold text-gray-500 transition hover:text-black"
              >
                View All
              </a>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">

                <thead className="bg-gray-50 text-xs uppercase text-gray-400">
                  <tr>
                    <th className="px-6 py-4">
                      Queue
                    </th>

                    <th className="px-6 py-4">
                      Student
                    </th>

                    <th className="px-6 py-4">
                      Teacher
                    </th>

                    <th className="px-6 py-4">
                      Arrival
                    </th>

                    <th className="px-6 py-4">
                      Status
                    </th>
                  </tr>
                </thead>

                
              <tbody>
                {recentPickups.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-12 text-center text-sm text-gray-400"
                    >
                      {recentError || "No pickup activity recorded today."}
                    </td>
                  </tr>
                ) : (
                  recentPickups.map((pickup) => (
                    <tr
                      key={pickup.pickup_queue_id}
                      className="border-t border-gray-100"
                    >
                      <td className="px-6 py-5 font-bold">
                        {pickup.queue_number ?? "—"}
                      </td>

                      <td className="px-6 py-5">
                        <p className="font-semibold">
                          {pickup.student_name}
                        </p>

                        <p className="mt-1 text-xs text-gray-400">
                          {pickup.classroom_name ?? "—"}
                        </p>
                      </td>

                      <td className="px-6 py-5">
                        {pickup.teacher_name || "Unassigned"}
                      </td>

                      <td className="px-6 py-5 text-gray-500">
                        {pickup.arrival_time
                          ? new Date(pickup.arrival_time).toLocaleTimeString(
                              "en-GB",
                              {
                                timeZone: "Asia/Bangkok",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )
                          : "Not arrived"}
                      </td>

                      <td className="px-6 py-5">
                        <StatusBadge status={pickup.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>


              </table>
            </div>
          </div>

          {/* TEACHERS ON DUTY */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">

            <div className="border-b border-gray-200 px-6 py-5">
              <h2 className="font-semibold">
                Teachers On Duty
              </h2>

              <p className="mt-1 text-xs text-gray-400">
                Current dismissal assignments
              </p>

              
            </div>

            
          <div className="divide-y divide-gray-100">
            {dutyTeachers.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-gray-400">
                {dutyError || "No teachers assigned today."}
              </div>
            ) : (
              dutyTeachers.map((teacher) => (
                <div
                  key={teacher.duty_id}
                  className="px-6 py-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold">
                        {teacher.teacher_name}
                      </p>

                      
                    </div>

                    <span className="whitespace-nowrap rounded-full bg-gray-100 px-3 py-1 text-[10px] font-semibold text-gray-700">
                      Assigned Today
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-gray-500">
                    {teacher.gate_label}
                  </p>
                </div>
              ))
            )}
          </div>


          </div>
        </section>


      </div>
    </main>
  );
}

/* --------------------------------
REUSABLE COMPONENTS
--------------------------------- */

function StatCard({
  title,
  value,
  subtitle,
  icon,
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">

      <div className="flex items-start justify-between">

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            {title}
          </p>

          <p className="mt-3 text-3xl font-bold tabular-nums">
            {value}
          </p>

          <p className="mt-1 text-xs text-gray-400">
            {subtitle}
          </p>
        </div>

        <div className="rounded-lg bg-gray-100 p-3 text-gray-500">
          {icon}
        </div>

      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    NEW: "bg-blue-50 text-blue-700",
    REQUESTED: "bg-blue-50 text-blue-700",
    ARRIVED: "bg-indigo-50 text-indigo-700",
    PREPARING: "bg-yellow-50 text-yellow-700",
    READY: "bg-green-50 text-green-700",
    PICKED_UP: "bg-gray-100 text-gray-700",
    CANCELLED: "bg-red-50 text-red-700",
  };

  const labels = {
    NEW: "New",
    REQUESTED: "Requested",
    ARRIVED: "Arrived",
    PREPARING: "Preparing",
    READY: "Ready",
    PICKED_UP: "Picked Up",
    CANCELLED: "Cancelled",
  };

  return (
    <span
      className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
        styles[status] || "bg-gray-100 text-gray-700"
      }`}
    >
      {labels[status] || status}
    </span>
  );
}





