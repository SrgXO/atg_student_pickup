"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, CircleCheck } from "lucide-react";

import { students } from "@/data/students";

 function ConfirmationContent() {

  const searchParams = useSearchParams();

  const studentIds =
    (searchParams.get("students") || "1").split(",").map(Number);
  
  const selectedStudents = students.filter((student) => studentIds.includes(student.id));

  const queueNumber =
    searchParams.get("queue") || "A-011";

  

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-md px-4 pb-10 pt-8">

        <div className="rounded-xl bg-black px-5 py-7 text-center">
          <h1 className="text-xl font-semibold text-white">
            Pickup Request Confirmation
          </h1>
        </div>

        <div className="mt-10 rounded-xl border border-gray-200 p-4">
          <div className="flex items-center">

            <div className="flex items-center gap-2">
              <CheckCircle2 size={23} />

              <span className="text-xs font-semibold">
                Confirm Arrival
              </span>
            </div>

            <div className="mx-3 h-px flex-1 bg-black" />

            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-black text-xs font-bold text-white">
                2
              </div>

              <span className="text-xs font-semibold">
                Queue Assigned
              </span>
            </div>

          </div>
        </div>

        <div className="mt-5 rounded-xl bg-black p-6 text-white">

          <p className="text-center text-xs uppercase tracking-[0.2em] text-gray-400">
            Your Queue Number
          </p>

          <p className="mt-3 text-center text-5xl font-bold">
            {queueNumber}
          </p>

          <div className="my-5 border-t border-gray-700" />

          <div className="grid grid-cols-2 gap-5">

            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500">
                Student
              </p>

              <p className="mt-1 text-sm font-semibold">
                {selectedStudents.map((student) => student.name).join(", ")}





              </p>

              <p className="mt-4 text-[10px] uppercase tracking-widest text-gray-500">
                Gate
              </p>

              <p className="mt-1 text-xs">
                Main Gate
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500">
                Class
              </p>

              <p className="mt-1 text-sm font-semibold">
                {selectedStudents.map((student) => student.className).join(", ")}
              </p>

              <p className="mt-4 text-[10px] uppercase tracking-widest text-gray-500">
                Estimated Wait
              </p>

              <p className="mt-1 text-xs">
                ~2 minutes
              </p>
            </div>

          </div>
        </div>

        <div className="mt-5 rounded-xl border border-gray-200 p-5">

          <h2 className="text-xs font-semibold uppercase tracking-wider">
            What happens next?
          </h2>

          <div className="mt-5 space-y-4 text-xs text-gray-600">

            <div className="flex gap-3">
              <CircleCheck size={17} />
              <p>Teacher on duty has been notified.</p>
            </div>

            <div className="flex gap-3">
              <CircleCheck size={17} />
              <p>
                Staff will begin preparing the student.
              </p>
            </div>

            <div className="flex gap-3">
              <CircleCheck size={17} />
              <p>
                Your queue status will update automatically.
              </p>
            </div>

            <div className="flex gap-3">
              <CircleCheck size={17} />
              <p>
                Proceed to the gate when the student is ready.
              </p>
            </div>

          </div>
        </div>

        <Link
          href={`/parent/status?student=${studentIds.join(",")}&queue=${queueNumber}`}
          className="mt-6 block w-full rounded-xl bg-black py-4 text-center text-sm font-semibold text-white"
        >
          Done
        </Link>

      </div>
    </main>
  );
}
export default function ConfirmationPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ConfirmationContent />
    </Suspense>
  );
}