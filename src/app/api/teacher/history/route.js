
import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requireUser} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Verify the current development user is an active teacher.
    const auth = await requireUser("TEACHER");
       if (!auth.user) {
      return NextResponse.json(
        {
          success: false,
          message: auth.error,
        },
        { status: auth.status }
      );
    }

    const [teachers] = await db.query(
      `
      SELECT t.teacher_id
      FROM teachers t
      JOIN users u ON u.user_id = t.user_id
      JOIN user_roles ur ON ur.user_id = u.user_id
      JOIN roles r ON r.role_id = ur.role_id
      WHERE u.user_id = ?
        AND u.is_active = TRUE
        AND LOWER(r.role_name) = 'teacher'
      LIMIT 1
      `,
      [auth.user.user_id]
    );

    if (teachers.length === 0) {
      return NextResponse.json(
        { success: false, message: "Teacher access required." },
        { status: 403 }
      );
    }

    const [history] = await db.query(
      `
      SELECT
        pq.pickup_queue_id,
        pq.pickup_request_id,
        pq.queue_number,
        pq.status,

        s.first_name AS student_first_name,
        s.last_name AS student_last_name,
        c.classroom_name,

        pr.request_time,
        pq.arrival_time,
        pq.ready_time,
        pq.pickup_time,

        ht.first_name AS handler_first_name,
        ht.last_name AS handler_last_name,
        hd.gate_slot AS handler_gate_slot,

        hu.first_name AS handover_first_name,
        hu.last_name AS handover_last_name,

        TIMESTAMPDIFF(
          SECOND,
          pq.arrival_time,
          pq.pickup_time
        ) AS dismissal_seconds

      FROM pickup_queue pq

      JOIN pickup_requests pr
        ON pr.pickup_request_id = pq.pickup_request_id

      JOIN students s
        ON s.student_id = pq.student_id

      JOIN classrooms c
        ON c.classroom_id = s.classroom_id

      LEFT JOIN teachers handler
        ON handler.teacher_id = pq.handled_by_teacher_id

      LEFT JOIN users ht
        ON ht.user_id = handler.user_id

      LEFT JOIN duty_schedule hd
        ON hd.teacher_id = handler.teacher_id
        AND hd.duty_date = DATE(pq.arrival_time)

      LEFT JOIN pickup_logs pl
        ON pl.pickup_log_id = (
          SELECT MAX(pl2.pickup_log_id)
          FROM pickup_logs pl2
          WHERE pl2.pickup_queue_id = pq.pickup_queue_id
            AND pl2.action = 'CONFIRM_HANDOVER'
        )

      LEFT JOIN users hu
        ON hu.user_id = pl.performed_by

      WHERE pq.status = 'PICKED_UP'
        AND pq.pickup_time >= CURDATE()
        AND pq.pickup_time < CURDATE() + INTERVAL 1 DAY

      ORDER BY pq.pickup_time DESC
      `
    );

    return NextResponse.json({
      success: true,
      history,
      total: history.length,
    },
  {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );

  } catch (error) {
    console.error("TEACHER HISTORY ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Failed to load pickup history." },
      { status: 500 }
    );
  }
}
