import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // ---------------------------------------
    // 1. VERIFY AUTHENTICATED TEACHER
    // ---------------------------------------

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

    const teacherUserId = auth.user.user_id;

    const [teachers] = await db.query(
      `
      SELECT
        t.teacher_id,
        u.user_id,
        u.first_name,
        u.last_name

      FROM teachers t

      JOIN users u
        ON u.user_id = t.user_id

      WHERE u.user_id = ?
        AND u.is_active = TRUE

      LIMIT 1
      `,
      [teacherUserId]
    );

    if (teachers.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Teacher profile not found.",
        },
        { status: 403 }
      );
    }

    const teacher = teachers[0];

    // ---------------------------------------
    // 2. VERIFY TODAY'S GATE DUTY
    // ---------------------------------------

    const [duties] = await db.query(
      `
      SELECT
        duty_id,
        gate_slot,
        duty_date,
        start_time,
        end_time

      FROM duty_schedule

      WHERE teacher_id = ?
        AND duty_date = CURDATE()

      LIMIT 1
      `,
      [teacher.teacher_id]
    );

    if (duties.length === 0) {
      return NextResponse.json({
        success: true,
        teacher,
        onDuty: false,
        duty: null,
        queue: [],
        total: 0,
        message: "No gate duty assigned for today.",
      });
    }

    const duty = duties[0];

    // ---------------------------------------
    // 3. RETRIEVE SHARED GATE QUEUE
    // ---------------------------------------

    const [queue] = await db.query(
      `
      SELECT
        pq.pickup_queue_id,
        pq.pickup_request_id,
        pq.student_id,
        pq.queue_number,
        pq.status,
        pq.arrival_time,
        pq.ready_time,
        pq.preparation_start_time,

        pq.handled_by_teacher_id,

        s.first_name AS student_first_name,
        s.last_name AS student_last_name,

        c.classroom_name,
        c.grade_level,
        c.building,

        ht.first_name AS handler_first_name,
        ht.last_name AS handler_last_name,

        hd.gate_slot AS handler_gate_slot

      FROM pickup_queue pq

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

      WHERE pq.status IN (
        'ARRIVED',
        'PREPARING',
        'READY'
      )

        AND pq.arrival_time >= CURDATE()
        AND pq.arrival_time < CURDATE() + INTERVAL 1 DAY

      ORDER BY pq.queue_number ASC
      `
    );

    return NextResponse.json({
      success: true,

      teacher,
      onDuty: true,
      duty,

      queue,
      total: queue.length,

      arrived: queue.filter(
        (item) => item.status === "ARRIVED"
      ).length,

      preparing: queue.filter(
        (item) => item.status === "PREPARING"
      ).length,

      ready: queue.filter(
        (item) => item.status === "READY"
      ).length,
    });

  } catch (error) {
    console.error("TEACHER QUEUE ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to retrieve teacher queue.",
      },
      { status: 500 }
    );
  }
}