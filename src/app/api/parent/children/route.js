import { NextResponse } from "next/server";
import db from "@/lib/db";

import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Temporary: Sarah is our logged-in parent during development.
    const auth = await requireUser("PARENT");
    
    if (!auth.user) {
      return NextResponse.json(
        {
          success: false,
          message: auth.error,
        },
        { status: auth.status }
      );
    }

    const parentUserId = auth.user.user_id;



    const [rows] = await db.query(
  `
  SELECT
    s.student_id,
    s.first_name,
    s.last_name,

    c.classroom_id,
    c.classroom_name,
    c.grade_level,
    c.building,

    ps.relationship,

    pq.pickup_queue_id,
    pq.pickup_request_id,
    pq.queue_number,
    pq.status AS pickup_status,
    pq.arrival_time,
    pq.preparation_start_time,
    pq.ready_time,
    pq.pickup_time

  FROM parents p

  JOIN parent_students ps
    ON ps.parent_id = p.parent_id

  JOIN students s
    ON s.student_id = ps.student_id

  JOIN classrooms c
    ON c.classroom_id = s.classroom_id

  LEFT JOIN pickup_queue pq
    ON pq.pickup_queue_id = (
      SELECT pq2.pickup_queue_id
      FROM pickup_queue pq2

      JOIN pickup_requests pr2
        ON pr2.pickup_request_id = pq2.pickup_request_id

      WHERE pq2.student_id = s.student_id
        AND pr2.parent_id = p.parent_id
      AND (
          pq2.status IN ('REQUESTED', 'ARRIVED', 'PREPARING', 'READY')

      OR (
          pq2.status = 'PICKED_UP'
          AND pq2.pickup_time >= CURDATE()
          AND pq2.pickup_time < CURDATE() + INTERVAL 1 DAY
        )
)

      ORDER BY pq2.pickup_queue_id DESC
      LIMIT 1
    )

  WHERE p.user_id = ?
    AND s.is_active = TRUE

  ORDER BY s.first_name
  `,
  [parentUserId]
);

    return NextResponse.json({
      success: true,
      children: rows,
    },
    {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
  );

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load children",
        error: error.message,
      },
      { status: 500 }
    );
  }
}