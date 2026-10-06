
import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
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

   

    const [rows] = await db.query(
      `
      SELECT
        pq.pickup_queue_id,
        pq.pickup_request_id,
        pq.queue_number,
        pq.status,
        pq.arrival_time,
        pq.preparation_start_time,
        pq.ready_time,
        pq.pickup_time,

        CONCAT(s.first_name, ' ', s.last_name)
          AS student_name,

        c.classroom_name,

        CASE
          WHEN tu.user_id IS NULL THEN NULL
          ELSE CONCAT(tu.first_name, ' ', tu.last_name)
        END AS teacher_name,

        hd.gate_slot

      FROM pickup_queue pq

      JOIN students s
        ON s.student_id = pq.student_id

      LEFT JOIN classrooms c
        ON c.classroom_id = s.classroom_id

      LEFT JOIN teachers t
        ON t.teacher_id = pq.handled_by_teacher_id

      LEFT JOIN users tu
        ON tu.user_id = t.user_id

      LEFT JOIN duty_schedule hd
        ON hd.teacher_id = t.teacher_id
        AND hd.duty_date = DATE(pq.arrival_time)

      WHERE (
        pq.status IN ('ARRIVED', 'PREPARING', 'READY')
        AND pq.arrival_time >= CURDATE()
        AND pq.arrival_time < CURDATE() + INTERVAL 1 DAY
      )
      OR (
        pq.status = 'PICKED_UP'
        AND pq.pickup_time >= CURDATE()
        AND pq.pickup_time < CURDATE() + INTERVAL 1 DAY
      )

      ORDER BY
        CASE pq.status
          WHEN 'ARRIVED' THEN 1
          WHEN 'PREPARING' THEN 2
          WHEN 'READY' THEN 3
          WHEN 'PICKED_UP' THEN 4
        END,
        pq.queue_number ASC
      `
    );

    const counts = {
      arrived: 0,
      preparing: 0,
      ready: 0,
      picked_up: 0,
    };

    for (const row of rows) {
      const key = row.status.toLowerCase();

      if (Object.hasOwn(counts, key)) {
        counts[key]++;
      }
    }

    return NextResponse.json({
      success: true,
      counts,
      total: rows.length,
      queue: rows,
    });
  } catch (error) {
    console.error("ADMIN QUEUE ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to retrieve Admin Queue Monitor.",
      },
      { status: 500 }
    );
  }
}
