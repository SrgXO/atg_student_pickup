
"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Users,
  CheckCircle2,
  RotateCw,
  School,
  Circle,
} from "lucide-react";

const REFRESH_INTERVAL = 5000;

export default function GatePage() {
  const [queue, setQueue] = useState([]);
  const [currentTime, setCurrentTime] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // ---------------------------
  // FETCH PUBLIC QUEUE
  // ---------------------------

  const fetchQueue = useCallback(async () => {
    try {
      const response = await fetch("/api/gate", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to retrieve queue."
        );
      }

      setQueue(data.queues || []);
      setLastUpdated(new Date());
      setError("");
    } catch (err) {
      console.error("GATE DISPLAY ERROR:", err);
      setError("Waiting for connection...");
    } finally {
      setLoading(false);
    }
  }, []);

  // ---------------------------
  // LIVE CLOCK + AUTO REFRESH
  // ---------------------------

  useEffect(() => {
    setCurrentTime(new Date());

    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    fetchQueue();

    const queueInterval = setInterval(() => {
      fetchQueue();
    }, REFRESH_INTERVAL);

    return () => {
      clearInterval(clockInterval);
      clearInterval(queueInterval);
    };
  }, [fetchQueue]);

  // ---------------------------
  // STATUS GROUPS
  // ---------------------------

  const preparing = queue.filter(
    (item) => item.status === "PREPARING"
  );

  const ready = queue.filter(
    (item) => item.status === "READY"
  );

  const pickedUp = queue.filter(
    (item) => item.status === "PICKED_UP"
  );

  return (
    <main className="min-h-screen bg-[#eeeeee] text-black">
      <div className="flex min-h-screen flex-col">

        {/* HEADER */}
        <header className="flex items-center justify-between bg-white px-8 py-5">

          <div className="flex items-center gap-4">

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100">
              <School size={22} />
            </div>

            <div>
              <h1 className="text-xl font-black tracking-tight">
                ATG STUDENT PICKUP MANAGEMENT SYSTEM
              </h1>

              <p className="mt-1 text-xs text-gray-400">
                Main Gate · Public Pickup Display
              </p>
            </div>

          </div>

          <div className="text-right">

            <p className="font-mono text-xl font-bold tabular-nums">
              {currentTime
                ? currentTime.toLocaleTimeString("en-GB", {
                    timeZone: "Asia/Bangkok",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: false,
                  })
                : "--:--:--"}
            </p>

            <p className="mt-1 text-xs text-gray-400">
              {currentTime
                ? currentTime.toLocaleDateString("en-US", {
                    timeZone: "Asia/Bangkok",
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "Loading..."}
            </p>

          </div>
        </header>

        {/* BLACK STATUS BAR */}
        <section className="flex items-center justify-between bg-[#111111] px-8 py-3 text-white">

          <div className="flex items-center gap-10">

            <Summary
              label="Preparing"
              value={preparing.length}
            />

            <Summary
              label="Ready for Pickup"
              value={ready.length}
            />

            <Summary
              label="Picked Up Today"
              value={pickedUp.length}
            />

            <Summary
              label="Total Displayed"
              value={queue.length}
            />

          </div>

          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">

            <Circle
              size={7}
              fill="currentColor"
              className={
                error ? "text-red-400" : "text-green-400"
              }
            />

            {error ? "Connection issue" : "Live · Refreshes every 5s"}

          </div>
        </section>

        {/* THREE QUEUE COLUMNS */}
        <section className="grid flex-1 grid-cols-3 divide-x divide-gray-300">

          {/* PREPARING */}
          <QueueColumn
            title="Preparing"
            subtitle="Teacher is fetching your child"
            count={preparing.length}
            icon={<RotateCw size={18} />}
            loading={loading}
          >
            {preparing.map((item, index) => (
              <PreparingCard
                key={`${item.queue_number}-${index}`}
                queueNumber={item.queue_number}
              />
            ))}
          </QueueColumn>

          {/* READY */}
          <QueueColumn
            title="Ready for Pickup"
            subtitle="Please proceed to the gate now"
            count={ready.length}
            icon={<Users size={18} />}
            loading={loading}
          >
            {ready.map((item, index) => (
              <ReadyCard
                key={`${item.queue_number}-${index}`}
                queueNumber={item.queue_number}
              />
            ))}
          </QueueColumn>

          {/* PICKED UP */}
          <QueueColumn
            title="Picked Up"
            subtitle="Successfully collected today"
            count={pickedUp.length}
            icon={<CheckCircle2 size={18} />}
            loading={loading}
          >
            {pickedUp.map((item, index) => (
              <PickedUpCard
                key={`${item.queue_number}-${index}`}
                queueNumber={item.queue_number}
              />
            ))}
          </QueueColumn>

        </section>

        {/* FOOTER */}
        <footer className="flex items-center justify-between border-t border-gray-200 bg-white px-8 py-3 text-[10px] text-gray-400">

          <p>
            {error
              ? error
              : "Please wait for your queue number. This display refreshes automatically every 5 seconds."}
          </p>

          <p>
            {lastUpdated
              ? `Updated ${lastUpdated.toLocaleTimeString(
                  "en-GB",
                  { timeZone: "Asia/Bangkok" }
                )}`
              : "ATG Gate Display"}
          </p>

        </footer>

      </div>
    </main>
  );
}

/* -----------------------------------
   QUEUE COLUMN
----------------------------------- */

function QueueColumn({
  title,
  subtitle,
  count,
  icon,
  children,
  loading,
}) {
  return (
    <div className="flex min-w-0 flex-col bg-[#f3f3f3]">

      <div className="flex items-start justify-between border-b border-gray-300 px-5 py-4">

        <div>
          <div className="flex items-center gap-2">
            {icon}

            <h2 className="text-sm font-black uppercase tracking-wide">
              {title}
            </h2>
          </div>

          <p className="mt-1 text-[10px] text-gray-400">
            {subtitle}
          </p>
        </div>

        <p className="text-lg font-bold tabular-nums">
          {count}
        </p>

      </div>

      <div className="grid max-h-[calc(100vh-230px)] grid-cols-2 content-start gap-3 overflow-y-auto p-4 2xl:grid-cols-3">

        {count === 0 ? (
          <p className="col-span-full py-10 text-center text-xs text-gray-400">
            {loading ? "Loading..." : "No queue numbers"}
          </p>
        ) : (
          children
        )}

      </div>
    </div>
  );
}

/* -----------------------------------
   PREPARING CARD
----------------------------------- */

function PreparingCard({ queueNumber }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-5 text-center shadow-sm">

      <p className="font-mono text-3xl font-black tabular-nums">
        {queueNumber}
      </p>

      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
        Preparing
      </p>

    </div>
  );
}

/* -----------------------------------
   READY CARD
----------------------------------- */

function ReadyCard({ queueNumber }) {
  return (
    <div className="rounded-md bg-[#111111] p-5 text-center text-white shadow-sm">

      <p className="font-mono text-4xl font-black tabular-nums">
        {queueNumber}
      </p>

      <div className="mt-2 flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-wide">

        <Circle size={7} fill="currentColor" />

        Ready

      </div>

    </div>
  );
}

/* -----------------------------------
   PICKED UP CARD
----------------------------------- */

function PickedUpCard({ queueNumber }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-5 text-center opacity-55">

      <p className="font-mono text-3xl font-black tabular-nums line-through">
        {queueNumber}
      </p>

      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        ✓ Picked Up
      </p>

    </div>
  );
}

/* -----------------------------------
   TOP SUMMARY
----------------------------------- */

function Summary({ label, value }) {
  return (
    <div className="flex items-center gap-2">

      <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-500">
        {label}
      </p>

      <p className="text-lg font-bold tabular-nums">
        {value}
      </p>

    </div>
  );
}
