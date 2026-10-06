
import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. Check Admin permission.
    // Development-only identity; replace with session auth later.
    const auth = await requireUser("ADMIN");

if (!auth.user) {
  return NextResponse.json(
    {
      success: false,
      message: auth.error,
    },
    { status: auth.status }
  );
}


    // 2. Count today's pickup records by status.
    // Use arrival_time for arrival-stage metrics, but
    // request_time to determine today's pickup cohort.
    const [statusRows] = await db.query(
      `
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(pq.status = 'REQUESTED'), 0) AS requested,
        COALESCE(SUM(pq.status = 'ARRIVED'), 0) AS arrived,
        COALESCE(SUM(pq.status = 'PREPARING'), 0) AS preparing,
        COALESCE(SUM(pq.status = 'READY'), 0) AS ready,
        COALESCE(SUM(pq.status = 'PICKED_UP'), 0) AS completed,
        COALESCE(SUM(pq.status = 'CANCELLED'), 0) AS cancelled
      FROM pickup_queue pq
      JOIN pickup_requests pr
        ON pr.pickup_request_id = pq.pickup_request_id
      WHERE pr.request_time >= CURDATE()
        AND pr.request_time < CURDATE() + INTERVAL 1 DAY
      `
    );

    // 3. Average durations in seconds.
    // Only calculate a stage when both timestamps exist.
    const [durationRows] = await db.query(
      `
      SELECT
        ROUND(AVG(
          CASE
            WHEN pq.arrival_time IS NOT NULL
            THEN TIMESTAMPDIFF(
              SECOND, pr.request_time, pq.arrival_time
            )
          END
        )) AS request_to_arrival_seconds,

        ROUND(AVG(
          CASE
            WHEN pq.arrival_time IS NOT NULL
            AND pq.preparation_start_time IS NOT NULL
            THEN TIMESTAMPDIFF(
              SECOND,
              pq.arrival_time,
              pq.preparation_start_time
            )
          END
        )) AS arrival_to_preparation_seconds,

        ROUND(AVG(
          CASE
            WHEN pq.preparation_start_time IS NOT NULL
            AND pq.ready_time IS NOT NULL
            THEN TIMESTAMPDIFF(
              SECOND,
              pq.preparation_start_time,
              pq.ready_time
            )
          END
        )) AS preparation_to_ready_seconds,

        ROUND(AVG(
          CASE
            WHEN pq.ready_time IS NOT NULL
            AND pq.pickup_time IS NOT NULL
            THEN TIMESTAMPDIFF(
              SECOND, pq.ready_time, pq.pickup_time
            )
          END
        )) AS ready_to_pickup_seconds,

        ROUND(AVG(
          CASE
            WHEN pq.arrival_time IS NOT NULL
            AND pq.pickup_time IS NOT NULL
            AND pq.status = 'PICKED_UP'
            THEN TIMESTAMPDIFF(
              SECOND, pq.arrival_time, pq.pickup_time
            )
          END
        )) AS arrival_to_pickup_seconds

      FROM pickup_queue pq
      JOIN pickup_requests pr
        ON pr.pickup_request_id = pq.pickup_request_id
      WHERE pr.request_time >= CURDATE()
        AND pr.request_time < CURDATE() + INTERVAL 1 DAY
      `
    );

    // 4. Return dashboard-ready JSON.
    const counts = statusRows[0];
    const durations = durationRows[0];
    const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

    return NextResponse.json({
      success: true,
      date: today,

      counts: {
        total: Number(counts.total),
        requested: Number(counts.requested),
        arrived: Number(counts.arrived),
        preparing: Number(counts.preparing),
        ready: Number(counts.ready),
        completed: Number(counts.completed),
        cancelled: Number(counts.cancelled),
      },

      average_durations_seconds: {
        request_to_arrival:
          durations.request_to_arrival_seconds,
        arrival_to_preparation:
          durations.arrival_to_preparation_seconds,
        preparation_to_ready:
          durations.preparation_to_ready_seconds,
        ready_to_pickup:
          durations.ready_to_pickup_seconds,
        arrival_to_pickup:
          durations.arrival_to_pickup_seconds,
      },
    });
  } catch (error) {
    console.error("ADMIN OVERVIEW ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load admin overview.",
      },
      { status: 500 }
    );
  }
}
