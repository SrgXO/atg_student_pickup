
import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value) {
  if (!DATE_PATTERN.test(value)) return false;

  const [y, m, d] = value.split("-").map(Number);
  const check = new Date(Date.UTC(y, m - 1, d));

  return (
    check.getUTCFullYear() === y &&
    check.getUTCMonth() + 1 === m &&
    check.getUTCDate() === d
  );
}

export async function GET(request) {
  try {
    // 1. Verify active Admin access.
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


    // 2. Resolve the selected school date.
    const { searchParams } = new URL(request.url);

    let date = searchParams.get("date");

    if (!date) {
      const [todayRows] = await db.query(
        "SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today"
      );

      date = todayRows[0].today;
    }

    if (!isValidDate(date)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid date. Use YYYY-MM-DD.",
        },
        { status: 400 }
      );
    }

    // 3. One row per child pickup, not per parent request.
    const [rows] = await db.query(
      `
      SELECT
        pq.pickup_queue_id,
        pq.pickup_request_id,
        pq.queue_number,
        pq.status,

        CONCAT(s.first_name, ' ', s.last_name)
          AS student_name,

        c.classroom_name,

        CONCAT(pu.first_name, ' ', pu.last_name)
          AS parent_name,

        CASE
          WHEN tu.user_id IS NULL THEN NULL
          ELSE CONCAT(tu.first_name, ' ', tu.last_name)
        END AS teacher_name,

        ds.gate_slot,

        DATE_FORMAT(
          pr.request_time, '%Y-%m-%d %H:%i:%s'
        ) AS request_time,

        DATE_FORMAT(
          pq.arrival_time, '%Y-%m-%d %H:%i:%s'
        ) AS arrival_time,

        DATE_FORMAT(
          pq.preparation_start_time, '%Y-%m-%d %H:%i:%s'
        ) AS preparation_start_time,

        DATE_FORMAT(
          pq.ready_time, '%Y-%m-%d %H:%i:%s'
        ) AS ready_time,

        DATE_FORMAT(
          pq.pickup_time, '%Y-%m-%d %H:%i:%s'
        ) AS pickup_time,

        CASE
          WHEN pq.arrival_time IS NOT NULL
          AND pq.preparation_start_time IS NOT NULL
          THEN TIMESTAMPDIFF(
            SECOND,
            pq.arrival_time,
            pq.preparation_start_time
          )
          ELSE NULL
        END AS waiting_seconds,

        CASE
          WHEN pq.preparation_start_time IS NOT NULL
          AND pq.ready_time IS NOT NULL
          THEN TIMESTAMPDIFF(
            SECOND,
            pq.preparation_start_time,
            pq.ready_time
          )
          ELSE NULL
        END AS preparation_seconds,

        CASE
          WHEN pq.ready_time IS NOT NULL
          AND pq.pickup_time IS NOT NULL
          THEN TIMESTAMPDIFF(
            SECOND,
            pq.ready_time,
            pq.pickup_time
          )
          ELSE NULL
        END AS handover_seconds,

        CASE
          WHEN pq.arrival_time IS NOT NULL
          AND pq.pickup_time IS NOT NULL
          AND pq.status = 'PICKED_UP'
          THEN TIMESTAMPDIFF(
            SECOND,
            pq.arrival_time,
            pq.pickup_time
          )
          ELSE NULL
        END AS dismissal_seconds

      FROM pickup_queue pq

      JOIN pickup_requests pr
        ON pr.pickup_request_id = pq.pickup_request_id

      JOIN students s
        ON s.student_id = pq.student_id

      LEFT JOIN classrooms c
        ON c.classroom_id = s.classroom_id

      JOIN parents p
        ON p.parent_id = pr.parent_id

      JOIN users pu
        ON pu.user_id = p.user_id

      LEFT JOIN teachers t
        ON t.teacher_id = pq.handled_by_teacher_id

      LEFT JOIN users tu
        ON tu.user_id = t.user_id

      LEFT JOIN duty_schedule ds
        ON ds.teacher_id = t.teacher_id
        AND ds.duty_date = DATE(pq.arrival_time)

      WHERE pr.request_time >= ?
        AND pr.request_time < DATE(?) + INTERVAL 1 DAY

      ORDER BY
        pr.request_time DESC,
        pq.pickup_queue_id DESC

      LIMIT 200
      `,
      [date, date]
    );

    return NextResponse.json({
      success: true,
      date,
      total: rows.length,
      logs: rows,
    });
  } catch (error) {
    console.error("ADMIN PICKUP LOGS ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to retrieve pickup logs.",
      },
      { status: 500 }
    );
  }
}
