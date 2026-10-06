"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Clock3,
  CheckCircle2,
  RefreshCw,
  UsersRound,
  UserCheck,
} from "lucide-react";


export default function TeacherPage() {
  const [teacher, setTeacher] = useState(null);
  const [duty, setDuty] = useState(null);
  const [onDuty, setOnDuty] = useState(false);
  const [queue, setQueue] = useState([]);

  const [activeTab, setActiveTab] = useState("ALL");

  const [selectedIds, setSelectedIds] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // ------------------------------------
  // FETCH CENTRALIZED QUEUE
  // ------------------------------------

  const fetchQueue = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);

    try {
      const response = await fetch("/api/teacher/queue", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to load queue.");
      }

      setTeacher(data.teacher);
      setDuty(data.duty);
      setOnDuty(data.onDuty);
      setQueue(data.queue ?? []);
      setError("");

    } catch (err) {
      console.error("TEACHER QUEUE ERROR:", err);
      setError(err.message);

    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ------------------------------------
  // AUTOMATIC REFRESH
  // ------------------------------------

  useEffect(() => {
    fetchQueue(true);

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchQueue(true);
      }
    }, 5000);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        fetchQueue(true);
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
  }, [fetchQueue]);

  // ------------------------------------
  // CLEAR SELECTION WHEN TAB CHANGES
  // ------------------------------------

  useEffect(() => {
    setSelectedIds([]);
    setMessage("");
    setError("");
  }, [activeTab]);

  // ------------------------------------
  // COUNTS
  // ------------------------------------

  const arrivedCount = queue.filter(
    (item) => item.status === "ARRIVED"
  ).length;

  const preparingCount = queue.filter(
    (item) => item.status === "PREPARING"
  ).length;

  const readyCount = queue.filter(
    (item) => item.status === "READY"
  ).length;

  // ------------------------------------
  // TAB FILTER
  // ------------------------------------

  const filteredQueue = queue.filter((item) => {
    if (activeTab === "ALL") {
      return item.status === "ARRIVED";
    }

    return (
      item.handler_gate_slot === activeTab &&
      item.handled_by_teacher_id != null &&
      ["PREPARING", "READY"].includes(item.status)
    );
  });

  // ------------------------------------
  // WHICH ROWS CURRENT TEACHER CAN SELECT
  // ------------------------------------

  const selectableItems = filteredQueue.filter((item) => {
    // All tab = incoming ARRIVED students
    if (activeTab === "ALL") {
      return item.status === "ARRIVED";
    }

    // Teacher A/B tab:
    // only PREPARING records assigned to the logged-in teacher
    return (
      item.status === "PREPARING" &&
      Number(item.handled_by_teacher_id) ===
        Number(teacher?.teacher_id)
    );
  });

  const selectableIds = selectableItems.map(
    (item) => item.pickup_queue_id
  );

  const allSelected =
    selectableIds.length > 0 &&
    selectableIds.every((id) =>
      selectedIds.includes(id)
    );

  // ------------------------------------
  // SELECTION
  // ------------------------------------

  function toggleSelection(id) {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.filter(
          (selectedId) => selectedId !== id
        );
      }

      return [...current, id];
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(selectableIds);
    }
  }

  // ------------------------------------
  // START PREPARING
  // ------------------------------------

  async function startPreparing() {
    if (selectedIds.length === 0 || processing) return;

    setProcessing(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/teacher/queue/prepare",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            queueIds: selectedIds,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to start preparing."
        );
      }

      setMessage(data.message);
      setSelectedIds([]);

      await fetchQueue(true);

      // Move teacher directly to their own column.
      if (duty?.gate_slot) {
        setActiveTab(duty.gate_slot);
      }

    } catch (err) {
      console.error("START PREPARING ERROR:", err);
      setError(err.message);

      await fetchQueue(true);

    } finally {
      setProcessing(false);
    }
  }

  // ------------------------------------
  // MARK READY
  // ------------------------------------

  async function markReady() {
    if (selectedIds.length === 0 || processing) return;

    setProcessing(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/teacher/queue/ready",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            queueIds: selectedIds,
          }),
        }
      );

      const data = await response.json();

      console.log("MARK READY RESPONSE:", {
          status: response.status,
          data,
        });
      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to mark students ready."
        );
      }

      setMessage(data.message);
      setSelectedIds([]);

      await fetchQueue(true);

    } catch (err) {
      console.error("MARK READY ERROR:", err);
      setError(err.message);

      await fetchQueue(true);

    } finally {
      setProcessing(false);
    }
  }

  // ------------------------------------
  // TIME
  // ------------------------------------

  function formatTime(value) {
    if (!value) return "—";

    return new Date(value).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // ------------------------------------
  // UI
  // ------------------------------------

  return (
    <main className="min-h-screen bg-white pb-40">
      <div className="mx-auto max-w-md">

        {/* HEADER */}

        <header className="border-b border-gray-100 px-5 pb-6 pt-10">

          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
            ATG · Teacher Dashboard
          </p>

          <div className="mt-3 flex items-start justify-between">

            <div>
              <h1 className="text-2xl font-bold text-black">
                Gate Duty
              </h1>
              

              <p className="mt-2 text-sm text-gray-500">
                {teacher
                  ? `${teacher.first_name} ${teacher.last_name}`
                  : "Loading teacher..."}
              </p>

              {duty && (
                <p className="mt-1 text-xs text-gray-400">
                  Gate {duty.gate_slot} ·{" "}
                  {duty.start_time?.slice(0, 5)}–
                  {duty.end_time?.slice(0, 5)}
                </p>
              )}
            </div>

            <span className="rounded-full bg-black px-3 py-2 text-[10px] font-semibold text-white">
              {onDuty
                ? `Gate ${duty?.gate_slot}`
                : "Not Assigned"}
            </span>

          </div>
        </header>

        <section className="px-5 pt-6">

          {/* SUMMARY */}

          <div className="grid grid-cols-3 gap-2">

            <SummaryCard
              label="Arrived"
              value={arrivedCount}
              icon={<UsersRound size={16} />}
            />

            <SummaryCard
              label="Preparing"
              value={preparingCount}
              icon={<Clock3 size={16} />}
            />

            <SummaryCard
              label="Ready"
              value={readyCount}
              icon={<CheckCircle2 size={16} />}
            />

          </div>

          {/* TABS */}

          <div className="mt-8">

            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
              Gate Queue
            </p>

            <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1">

              {[
                { value: "ALL", label: "All" },
                { value: "A", label: "Teacher A" },
                { value: "B", label: "Teacher B" },
              ].map((tab) => (

                <button
                  key={tab.value}
                  type="button"
                  onClick={() =>
                    setActiveTab(tab.value)
                  }
                  className={`rounded-lg py-3 text-xs font-semibold transition ${
                    activeTab === tab.value
                      ? "bg-black text-white"
                      : "text-gray-500"
                  }`}
                >
                  {tab.label}
                </button>

              ))}

            </div>
          </div>

          {/* QUEUE HEADER */}

          <div className="mb-4 mt-7 flex items-center justify-between">

            <div>
              <h2 className="text-sm font-bold text-black">
                {activeTab === "ALL"
                  ? "Waiting for Teacher"
                  : `Teacher ${activeTab} Queue`}
              </h2>

              <p className="mt-1 text-xs text-gray-400">
                {filteredQueue.length} students
              </p>
            </div>

            <button
              type="button"
              onClick={() => fetchQueue()}
              disabled={refreshing}
              aria-label="Refresh teacher queue"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 disabled:opacity-40"
            >
              <RefreshCw
                size={17}
                className={
                  refreshing ? "animate-spin" : ""
                }
              />
            </button>

          </div>

          {/* SELECT ALL */}

          {!loading &&
            onDuty &&
            selectableIds.length > 0 && (

              <button
                type="button"
                onClick={toggleSelectAll}
                className="mb-4 flex items-center gap-2 text-xs font-semibold text-gray-600"
              >
                <Checkbox checked={allSelected} />

                {allSelected
                  ? "Deselect All"
                  : `Select All (${selectableIds.length})`}
              </button>

            )}

          {/* SUCCESS */}

          {message && (
            <div className="mb-4 rounded-xl bg-gray-100 p-4 text-xs font-semibold text-gray-700">
              {message}
            </div>
          )}

          {/* ERROR */}

          {error && (
            <div className="mb-4 rounded-xl bg-red-50 p-4 text-xs text-red-600">
              {error}
            </div>
          )}

          {/* LOADING */}

          {loading && (
            <p className="py-8 text-center text-sm text-gray-400">
              Loading gate queue...
            </p>
          )}

          {!loading && !onDuty && (
            <div className="rounded-2xl border border-gray-200 p-6 text-center">
              <p className="text-sm font-semibold">
                No gate duty assigned today.
              </p>
            </div>
          )}

          {/* QUEUE */}

          {!loading && onDuty && (
            <div className="space-y-3">

              {filteredQueue.length === 0 && (
                <div className="rounded-2xl border border-gray-200 p-7 text-center">

                  <p className="text-sm text-gray-400">
                    {activeTab === "ALL"
                      ? "No students waiting for a teacher."
                      : "No pickups in this section."}
                  </p>

                </div>
              )}

              {filteredQueue.map((item) => {

                const selectable =
                  activeTab === "ALL"
                    ? item.status === "ARRIVED"
                    : item.status === "PREPARING" &&
                      Number(
                        item.handled_by_teacher_id
                      ) ===
                        Number(teacher?.teacher_id);

                const selected =
                  selectedIds.includes(
                    item.pickup_queue_id
                  );

                return (
                  <div
                    key={item.pickup_queue_id}
                    className={`overflow-hidden rounded-2xl border ${
                      selected
                        ? "border-black"
                        : "border-gray-200"
                    }`}
                  >

                    <div className="p-5">

                      <div className="flex items-start justify-between">

                        <div className="flex items-start gap-3">

                          {selectable && (
                            <button
                              type="button"
                              onClick={() =>
                                toggleSelection(
                                  item.pickup_queue_id
                                )
                              }
                              aria-label={`Select ${item.student_first_name}`}
                              className="mt-1"
                            >
                              <Checkbox
                                checked={selected}
                              />
                            </button>
                          )}

                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                              Queue Number
                            </p>

                            <h3 className="mt-1 text-3xl font-bold text-black">
                              {item.queue_number}
                            </h3>
                          </div>

                        </div>

                        <span className="rounded-full bg-gray-100 px-3 py-2 text-[10px] font-semibold text-black">
                          {item.status}
                        </span>

                      </div>

                      <h4 className="mt-5 text-sm font-bold text-black">
                        {item.student_first_name}{" "}
                        {item.student_last_name}
                      </h4>

                      <p className="mt-1 text-xs text-gray-400">
                        {item.classroom_name}

                        {item.building
                          ? ` · ${item.building}`
                          : ""}
                      </p>

                      <div className="mt-5 grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">

                        <div>
                          <p className="text-[10px] text-gray-400">
                            Arrived
                          </p>

                          <p className="mt-1 text-xs font-semibold">
                            {formatTime(
                              item.arrival_time
                            )}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-[10px] text-gray-400">
                            Handling Teacher
                          </p>

                          <p className="mt-1 text-xs font-semibold">
                            {item.handler_gate_slot
                              ? `Teacher ${item.handler_gate_slot}`
                              : "Not yet assigned"}
                          </p>
                        </div>

                      </div>

                      {item.preparation_start_time && (
                        <div className="mt-3 text-xs text-gray-400">
                          Preparation started{" "}
                          <span className="font-semibold text-gray-700">
                            {formatTime(
                              item.preparation_start_time
                            )}
                          </span>
                        </div>
                      )}

                      {item.status === "READY" && (
                        <div className="mt-4 flex items-center gap-2 rounded-xl bg-gray-50 p-3">

                          <CheckCircle2
                            size={16}
                            className="text-black"
                          />

                          <p className="text-xs font-semibold">
                            Ready for parent handover
                          </p>

                        </div>
                      )}

                    </div>
                  </div>
                );
              })}

            </div>
          )}

          {!loading && onDuty && (
            <p className="mt-7 text-center text-[11px] text-gray-400">
              Automatically refreshes every 5 seconds
            </p>
          )}

        </section>
      </div>

      {/* --------------------------------
          BULK ACTION BAR
      -------------------------------- */}

      {selectedIds.length > 0 && (
        <div className="fixed bottom-24 left-1/2 z-40 w-[calc(100%-32px)] max-w-sm -translate-x-1/2 rounded-2xl border border-gray-200 bg-white p-3 shadow-xl">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100">
              <UserCheck size={18} />
            </div>

            <div className="min-w-0 flex-1">

              <p className="text-xs font-bold">
                {selectedIds.length} selected
              </p>

              <p className="text-[10px] text-gray-400">
                {activeTab === "ALL"
                  ? "Assign to your gate"
                  : "Mark selected students ready"}
              </p>

            </div>

            <button
              type="button"
              disabled={processing}
              onClick={
                activeTab === "ALL"
                  ? startPreparing
                  : markReady
              }
              className="rounded-xl bg-black px-4 py-3 text-xs font-semibold text-white disabled:opacity-40"
            >
              {processing
                ? "Processing..."
                : activeTab === "ALL"
                ? `Preparing (${selectedIds.length})`
                : `Ready (${selectedIds.length})`}
            </button>

          </div>

        </div>
      )}

    </main>
  );
}

// ------------------------------------
// CHECKBOX
// ------------------------------------

function Checkbox({ checked }) {
  return (
    <span
      className={`flex h-5 w-5 items-center justify-center rounded-md border ${
        checked
          ? "border-black bg-black text-white"
          : "border-gray-300 bg-white"
      }`}
    >
      {checked && (
        <span className="text-[11px] font-bold">
          ✓
        </span>
      )}
    </span>
  );
}

// ------------------------------------
// SUMMARY CARD
// ------------------------------------

function SummaryCard({ label, value, icon }) {
  return (
    <div className="rounded-xl border border-gray-200 p-3">

      <div className="flex items-center justify-between text-gray-400">

        <span className="text-[10px] font-semibold uppercase">
          {label}
        </span>

        {icon}

      </div>

      <p className="mt-3 text-2xl font-bold text-black">
        {value}
      </p>

    </div>
  );
}