
import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Verify Admin permission.
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

        CONCAT(s.first_name, ' ', s.last_name)
          AS student_name,

        c.classroom_name,

        CONCAT(
          COALESCE(tu.first_name, ''),
          ' ',
          COALESCE(tu.last_name, '')
        ) AS teacher_name,

        pr.request_time,
        pq.arrival_time,
        pq.preparation_start_time,
        pq.ready_time,
        pq.pickup_time,

        ds.gate_slot

      FROM pickup_queue pq

      JOIN pickup_requests pr
        ON pr.pickup_request_id = pq.pickup_request_id

      JOIN students s
        ON s.student_id = pq.student_id

      LEFT JOIN classrooms c
        ON c.classroom_id = s.classroom_id

      LEFT JOIN teachers t
        ON t.teacher_id = pq.handled_by_teacher_id

      LEFT JOIN users tu
        ON tu.user_id = t.user_id

      LEFT JOIN duty_schedule ds
        ON ds.teacher_id = t.teacher_id
        AND ds.duty_date = DATE(pq.arrival_time)

      WHERE pr.request_time >= CURDATE()
        AND pr.request_time < CURDATE() + INTERVAL 1 DAY

      ORDER BY pr.request_time DESC, pq.pickup_queue_id DESC

      LIMIT 10
      `
    );

    return NextResponse.json({
      success: true,
      pickups: rows.map((row) => ({
        ...row,
        teacher_name: row.teacher_name?.trim() || null,
      })),
    });
  } catch (error) {
    console.error("ADMIN RECENT PICKUPS ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load recent pickups.",
      },
      { status: 500 }
    );
  }
}
