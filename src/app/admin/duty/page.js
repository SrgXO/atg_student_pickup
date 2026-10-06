
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  Plus,
  RefreshCw,
  X,
  Trash
} from "lucide-react";

// Get today's date in Thailand, not UTC.
function getDate() {
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

function formatDisplayDate(dateString) {
  if (!dateString) return "—";

  return new Date(`${dateString}T12:00:00`).toLocaleDateString(
    "en-GB",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  );
}

const INITIAL_FORM = {
  teacher_id: "",
  gate_slot: "",
  start_time: "13:30",
  end_time: "15:30",
};

export default function DutyPage() {
  const [selectedDate, setSelectedDate] = useState(
    getDate
  );

  const [assignments, setAssignments] = useState([]);
  const [teachers, setTeachers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState(INITIAL_FORM);

  // ------------------------------------
  // FETCH DUTY SCHEDULE
  // ------------------------------------

  const fetchDuty = useCallback(
    async (silent = false) => {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const response = await fetch(
          `/api/admin/duty?date=${encodeURIComponent(selectedDate)}`,
          { cache: "no-store" }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Failed to load duty schedule."
          );
        }

        setAssignments(data.assignments || []);
        setTeachers(data.teachers || []);
        setError("");
      } catch (err) {
        console.error("ADMIN DUTY FETCH:", err);
        setError(err.message || "Unable to load duty schedule.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedDate]
  );

  // ------------------------------------
  // INITIAL LOAD + POLLING
  // ------------------------------------

  useEffect(() => {
    fetchDuty();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchDuty(true);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchDuty]);

  // ------------------------------------
  // AVAILABLE OPTIONS
  // ------------------------------------

  const occupiedGates = assignments.map(
    (assignment) => assignment.gate_slot
  );

  const assignedTeacherIds = assignments.map(
    (assignment) => Number(assignment.teacher_id)
  );

  const availableTeachers = teachers.filter(
    (teacher) =>
      !assignedTeacherIds.includes(Number(teacher.teacher_id))
  );

  const availableGates = ["A", "B"].filter(
    (gate) => !occupiedGates.includes(gate)
  );

  // ------------------------------------
  // FORM ACTIONS
  // ------------------------------------

  function openForm() {
    setForm(INITIAL_FORM);
    setFormError("");
    setSuccessMessage("");
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setFormError("");
  }

  function updateForm(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  // ------------------------------------
  // CREATE ASSIGNMENT
  // ------------------------------------

  async function handleSubmit(event) {
    event.preventDefault();

    setFormError("");

    if (
      !form.teacher_id ||
      !form.gate_slot ||
      !form.start_time ||
      !form.end_time
    ) {
      setFormError("Please complete all fields.");
      return;
    }

    if (form.start_time >= form.end_time) {
      setFormError(
        "End time must be later than start time."
      );
      return;
    }

    try {
      setSaving(true);

      const response = await fetch("/api/admin/duty", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          duty_date: selectedDate,
          teacher_id: Number(form.teacher_id),
          gate_slot: form.gate_slot,
          start_time: form.start_time,
          end_time: form.end_time,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to create assignment."
        );
      }

      setShowForm(false);
      setForm(INITIAL_FORM);
      setSuccessMessage(
        data.message || "Assignment created successfully."
      );

      await fetchDuty(true);
    } catch (err) {
      console.error("CREATE DUTY ERROR:", err);
      setFormError(
        err.message || "Failed to save assignment."
      );
    } finally {
      setSaving(false);
    }
  }


async function handleDelete(assignment) {
  const confirmed = window.confirm(
    `Delete ${assignment.teacher_name}'s Gate ${assignment.gate_slot} assignment for ${formatDisplayDate(assignment.duty_date)}?`
  );

  if (!confirmed) return;

  try {
    setError("");
    setSuccessMessage("");

    const response = await fetch(
      `/api/admin/duty/${assignment.duty_id}`,
      {
        method: "DELETE",
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Failed to delete assignment."
      );
    }

    setSuccessMessage(data.message);
    await fetchDuty(true);
  } catch (error) {
    console.error("DELETE DUTY ERROR:", error);
    setError(error.message);
  }
}


  // ------------------------------------
  // PAGE
  // ------------------------------------

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">

      {/* HEADER */}
      <header className="border-b border-gray-200 bg-white px-8 py-5">
        <h1 className="text-2xl font-bold">
          Duty Schedule
        </h1>

        <p className="mt-1 text-sm text-gray-400">
          Manage teacher duty assignments
        </p>
      </header>

      <div className="space-y-5 p-8">

        {/* NOTIFICATIONS */}
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            className="rounded-lg border border-green-200 bg-green-50 px-5 py-3 text-sm text-green-700"
          >
            {successMessage}
          </div>
        )}

        {/* MAIN TABLE CONTAINER */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">

          {/* TABLE HEADER */}
          <div className="flex items-center justify-between gap-5 border-b border-gray-200 px-6 py-5">

            <div>
              <h2 className="font-semibold">
                Duty Assignments
              </h2>

              <p className="mt-1 text-xs text-gray-400">
                {formatDisplayDate(selectedDate)}
              </p>
            </div>

            <div className="flex items-center gap-3">

              {/* DATE SELECTOR */}
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                <CalendarDays
                  size={16}
                  className="text-gray-400"
                />

                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => {
                    setSelectedDate(event.target.value);
                    setSuccessMessage("");
                  }}
                  className="bg-transparent text-sm outline-none"
                />
              </div>

              {/* TODAY SHORTCUT */}
              <button
                type="button"
                onClick={() => setSelectedDate(getDate())}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                Today
              </button>

              {/* REFRESH */}
              <button
                type="button"
                onClick={() => fetchDuty(true)}
                disabled={loading || refreshing}
                aria-label="Refresh duty schedule"
                className="rounded-lg border border-gray-200 p-2.5 hover:bg-gray-50 disabled:opacity-40"
              >
                <RefreshCw
                  size={16}
                  className={refreshing ? "animate-spin" : ""}
                />
              </button>

              {/* ADD ASSIGNMENT */}
              <button
                type="button"
                onClick={openForm}
                disabled={
                  loading ||
                  availableGates.length === 0 ||
                  availableTeachers.length === 0
                }
                className="flex items-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus size={16} />
                Add Assignment
              </button>

            </div>
          </div>

          {/* TABLE */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">

              <thead className="bg-gray-50 text-xs uppercase text-gray-400">
                <tr>
                  <th className="px-6 py-4">
                    Teacher
                  </th>

                  <th className="px-6 py-4">
                    Gate
                  </th>

                  <th className="px-6 py-4">
                    Date
                  </th>

                  <th className="px-6 py-4">
                    Time
                  </th>

                  <th className="px-6 py-4">
                    Status
                  </th>

                  <th className="px-6 py-4 text-right">
                    Action 
                  </th>
             </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-sm text-gray-400"
                    >
                      Loading duty schedule...
                    </td>
                  </tr>
                ) : assignments.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-sm text-gray-400"
                    >
                      No gate assignments for this date.
                    </td>
                  </tr>
                ) : (
                  assignments.map((row) => (
                    <tr
                      key={row.duty_id}
                      className="border-t border-gray-100"
                    >
                      <td className="px-6 py-5 font-semibold">
                        {row.teacher_name}
                      </td>

                      <td className="px-6 py-5">
                        <span className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold">
                          Gate {row.gate_slot}
                        </span>
                      </td>

                      <td className="px-6 py-5 text-gray-500">
                        {formatDisplayDate(row.duty_date)}
                      </td>

                      <td className="px-6 py-5 font-medium tabular-nums text-gray-600">
                        {row.start_time} – {row.end_time}
                      </td>

                      <td className="px-6 py-5">
                        <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                          Scheduled
                        </span>
                      </td>


<td className="px-6 py-5 text-right">
  <button
    type="button"
    onClick={() => handleDelete(row)}
    title="Delete assignment"
    aria-label={`Delete ${row.teacher_name}'s assignment`}
    className="inline-flex items-center justify-center rounded-lg border border-red-100 p-2 text-red-500 transition hover:bg-red-50 hover:text-red-700"
  >
    <Trash size={16} />
  </button>
</td>

                    </tr>
                  ))
                )}
              </tbody>

            </table>
          </div>

          {/* TABLE FOOTER */}
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 text-xs text-gray-400">

            <span>
              {assignments.length} of 2 gates assigned
            </span>

            <span>
              One teacher per gate per day
            </span>

          </div>

        </div>
      </div>

      {/* ---------------------------------
          ADD ASSIGNMENT MODAL
      ---------------------------------- */}

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeForm();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="assignment-title"
            className="w-full max-w-md rounded-xl bg-white shadow-xl"
          >

            {/* MODAL HEADER */}
            <div className="flex items-start justify-between border-b border-gray-200 px-6 py-5">

              <div>
                <h2
                  id="assignment-title"
                  className="text-lg font-bold"
                >
                  Add Duty Assignment
                </h2>

                <p className="mt-1 text-xs text-gray-400">
                  {formatDisplayDate(selectedDate)}
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                aria-label="Close form"
                className="rounded-lg p-2 hover:bg-gray-100 disabled:opacity-40"
              >
                <X size={18} />
              </button>

            </div>

            {/* MODAL FORM */}
            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-6"
            >

              {formError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600"
                >
                  {formError}
                </div>
              )}

              {/* TEACHER */}
              <div>
                <label
                  htmlFor="duty-teacher"
                  className="mb-2 block text-xs font-semibold"
                >
                  Teacher
                </label>

                <select
                  id="duty-teacher"
                  value={form.teacher_id}
                  onChange={(event) =>
                    updateForm(
                      "teacher_id",
                      event.target.value
                    )
                  }
                  required
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-black"
                >
                  <option value="">
                    Select a teacher
                  </option>

                  {availableTeachers.map((teacher) => (
                    <option
                      key={teacher.teacher_id}
                      value={teacher.teacher_id}
                    >
                      {teacher.teacher_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* GATE */}
              <div>
                <label
                  htmlFor="duty-gate"
                  className="mb-2 block text-xs font-semibold"
                >
                  Assigned Gate
                </label>

                <select
                  id="duty-gate"
                  value={form.gate_slot}
                  onChange={(event) =>
                    updateForm(
                      "gate_slot",
                      event.target.value
                    )
                  }
                  required
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-black"
                >
                  <option value="">
                    Select gate
                  </option>

                  {availableGates.map((gate) => (
                    <option key={gate} value={gate}>
                      Gate {gate}
                    </option>
                  ))}
                </select>
              </div>

              {/* TIME */}
              <div className="grid grid-cols-2 gap-4">

                <div>
                  <label
                    htmlFor="duty-start"
                    className="mb-2 block text-xs font-semibold"
                  >
                    Start Time
                  </label>

                  <input
                    id="duty-start"
                    type="time"
                    value={form.start_time}
                    onChange={(event) =>
                      updateForm(
                        "start_time",
                        event.target.value
                      )
                    }
                    required
                    className="w-full rounded-lg border border-gray-200 px-3 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label
                    htmlFor="duty-end"
                    className="mb-2 block text-xs font-semibold"
                  >
                    End Time
                  </label>

                  <input
                    id="duty-end"
                    type="time"
                    value={form.end_time}
                    onChange={(event) =>
                      updateForm(
                        "end_time",
                        event.target.value
                      )
                    }
                    required
                    className="w-full rounded-lg border border-gray-200 px-3 py-3 text-sm outline-none focus:border-black"
                  />
                </div>

              </div>

              <p className="text-xs leading-5 text-gray-400">
                Each gate can have one teacher per day.
                A teacher cannot be assigned to both gates
                on the same date.
              </p>

              {/* ACTION BUTTONS */}
              <div className="flex justify-end gap-3 border-t border-gray-100 pt-5">

                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-lg border border-gray-200 px-5 py-3 text-sm font-semibold hover:bg-gray-50 disabled:opacity-40"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-black px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-40"
                >
                  {saving
                    ? "Saving..."
                    : "Create Assignment"}
                </button>

              </div>

            </form>
          </div>
        </div>
      )}

    </main>
  );
}
