"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  UsersRound,
} from "lucide-react";

export default function ParentPickupPage() {
  const router = useRouter();
  const searchParams = useSearchParams(); 

  const preselectedStudent = searchParams.get("student"); 

  const [students, setStudents] = useState([]); 
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [loading, setLoading] = useState(true); 
  const [submitting, setSubmitting] = useState(false); 
  const [error, setError] = useState(""); 

  // --------------------------------
  // Load parent's real children
  // --------------------------------

  useEffect(() => { // Fetch the list of children associated with the logged-in parent when the component mounts
    async function fetchChildren() {
      try {
        const response = await fetch("/api/parent/children");

        if (!response.ok) {
          throw new Error("Failed to load children");
        }

        const data = await response.json(); 

        setStudents(data.children ?? []); // Set the state with the list of children retrieved from the API

        // If Parent Home sent ?student=1,
        // automatically select that child.
        if (preselectedStudent) {
          const studentId = Number(preselectedStudent);

          const belongsToParent = data.children.some(
            (student) => student.student_id === studentId
          );

          if (belongsToParent) {
            setSelectedStudents([studentId]);
          }
        }
      } catch (error) {
        console.error(error);
        setError("Could not load your children.");
      } finally {
        setLoading(false);
      }
    }

    fetchChildren();
  }, [preselectedStudent]);

  // --------------------------------
  // Select / deselect child
  // --------------------------------

  function toggleStudent(studentId) {
    setSelectedStudents((current) => {
      if (current.includes(studentId)) {
        return current.filter((id) => id !== studentId);
      }

      return [...current, studentId];
    });
  }

  // --------------------------------
  // Create pickup
  // --------------------------------

  async function createPickup() {
    if (selectedStudents.length === 0) {
      setError("Select at least one child.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/pickups", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          studentIds: selectedStudents,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to create pickup request"
        );
      }

      router.push("/parent");

    } catch (error) {
      console.error(error);
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-white pb-32">
      <div className="mx-auto max-w-md">

        {/* HEADER */}

        <header className="px-5 pb-6 pt-8">
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-6 flex h-10 w-10 items-center justify-center rounded-full border border-gray-200"
            aria-label="Go back"
          >
            <ArrowLeft size={18} />
          </button>

          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
            Pickup Request
          </p>

          <h1 className="mt-1 text-2xl font-bold text-black">
            Who are you picking up?
          </h1>

          <p className="mt-2 text-sm leading-5 text-gray-500">
            Select one or more children. Each child will receive
            their own queue number when you arrive.
          </p>
        </header>

        <div className="mx-5 border-t border-gray-100" />

        {/* CHILD SELECTION */}

        <section className="px-5 pt-6">
          {loading && ( 
            <div className="rounded-2xl border border-gray-200 p-5">
              <p className="text-sm text-gray-400">
                Loading children...
              </p>
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-red-500">
                {error}
              </p>
            </div>
          )}

          {!loading && (
            <div className="space-y-3">
              {students.map((student) => {
                const selected = selectedStudents.includes(
                  student.student_id
                );

                return (
                  <button
                    type="button"
                    key={student.student_id}
                    onClick={() =>
                      toggleStudent(student.student_id)
                    }
                    className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition ${
                      selected
                        ? "border-black bg-black text-white"
                        : "border-gray-200 bg-white text-black"
                    }`}
                  >
                    {/* INITIALS */}

                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                        selected
                          ? "bg-white/15 text-white"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {student.first_name[0]}
                      {student.last_name[0]}
                    </div>

                    {/* CHILD */}

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {student.first_name} {student.last_name}
                      </p>

                      <p
                        className={`mt-0.5 text-xs ${ 
                          selected
                            ? "text-gray-300"
                            : "text-gray-400"
                        }`}
                      >
                        {student.grade_level} 
                        {student.classroom_name && 
                          ` • ${student.classroom_name}`}  
                      </p> 
                    </div>

                    {/* CHECK */}

                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full border ${ 
                        selected
                          ? "border-white bg-white text-black"
                          : "border-gray-300"
                      }`}
                    >
                      {selected && (
                        <Check
                          size={14}
                          strokeWidth={2.5}
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* SUMMARY */}

        {!loading && students.length > 0 && (
          <section className="px-5 pt-7">
            <div className="flex items-center gap-3 rounded-2xl bg-gray-50 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white">
                <UsersRound
                  size={18}
                  className="text-gray-600"
                />
              </div>

              <div>
                <p className="text-xs text-gray-400">
                  Selected
                </p>

                <p className="text-sm font-semibold text-black">
                  {selectedStudents.length}{" "}
                  {selectedStudents.length === 1
                    ? "child"
                    : "children"}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* SUBMIT */}

        <section className="px-5 pt-5">
          <button
            type="button"
            onClick={createPickup}
            disabled={
              selectedStudents.length === 0 ||
              submitting ||
              loading
            }
            className="w-full rounded-xl bg-black px-5 py-4 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
          >
            {submitting
              ? "Creating Request..."
              : selectedStudents.length === 0
              ? "Select a Child"
              : `Request Pickup for ${
                  selectedStudents.length
                } ${
                  selectedStudents.length === 1
                    ? "Child"
                    : "Children"
                }`}
          </button>
        </section>

      </div>
    </main>
  );
}