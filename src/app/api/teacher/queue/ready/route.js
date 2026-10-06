import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requireUser } from "@/lib/auth";


export async function POST(request) {
  let connection;

  try {
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
    const body = await request.json();

    const queueIds = [...new Set(body.queueIds || [])]
      .map(Number)
      .filter((id) => Number.isSafeInteger(id) && id > 0);

    if (queueIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Select at least one student.",
        },
        { status: 400 }
      );
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    // ------------------------------------
    // CURRENT TEACHER
    // ------------------------------------

    const [teachers] = await connection.query(
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
      [auth.user.user_id]
    );

    if (teachers.length === 0) {
      await connection.rollback();

      return NextResponse.json(
        {
          success: false,
          message: "Teacher access required.",
        },
        { status: 403 }
      );
    }

    const teacher = teachers[0];

    // ------------------------------------
    // TODAY'S DUTY
    // ------------------------------------

    const [duties] = await connection.query(
      `
      SELECT
        duty_id,
        gate_slot,
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
      await connection.rollback();

      return NextResponse.json(
        {
          success: false,
          message: "You are not assigned to gate duty today.",
        },
        { status: 403 }
      );
    }

    const duty = duties[0];

    // ------------------------------------
    // LOCK SELECTED QUEUE ROWS
    // ------------------------------------

    const placeholders = queueIds.map(() => "?").join(",");

    const [pickups] = await connection.query(
      `
      SELECT
        pickup_queue_id,
        pickup_request_id,
        status,
        handled_by_teacher_id,
        preparation_start_time
      FROM pickup_queue
      WHERE pickup_queue_id IN (${placeholders})
      FOR UPDATE
      `,
      queueIds
    );

    if (pickups.length !== queueIds.length) {
      await connection.rollback();

      return NextResponse.json(
        {
          success: false,
          message: "One or more selected pickups no longer exist.",
        },
        { status: 404 }
      );
    }

    // ------------------------------------
    // VALIDATE PREPARING STATUS
    // ------------------------------------

    const invalidStatus = pickups.find(
      (pickup) => pickup.status !== "PREPARING"
    );

    if (invalidStatus) {
      await connection.rollback();

      return NextResponse.json(
        {
          success: false,
          message:
            "One or more selected students are no longer preparing. Refresh the queue.",
        },
        { status: 409 }
      );
    }

    // ------------------------------------
    // ONLY ASSIGNED TEACHER CAN BULK READY
    // ------------------------------------

    const wrongTeacher = pickups.find(
      (pickup) =>
        Number(pickup.handled_by_teacher_id) !==
        Number(teacher.teacher_id)
    );

    if (wrongTeacher) {
      await connection.rollback();

      return NextResponse.json(
        {
          success: false,
          message:
            "You can only mark students assigned to your gate as ready.",
        },
        { status: 403 }
      );
    }

    // ------------------------------------
    // PREPARING -> READY
    // ------------------------------------

    const [result] = await connection.query(
      `
      UPDATE pickup_queue
      SET
        status = 'READY',
        ready_time = NOW(),
        updated_by = ?
      WHERE pickup_queue_id IN (${placeholders})
        AND status = 'PREPARING'
        AND handled_by_teacher_id = ?
      `,
      [
        teacher.user_id,
        ...queueIds,
        teacher.teacher_id,
      ]
    );

    if (result.affectedRows !== queueIds.length) {
      await connection.rollback();

      return NextResponse.json(
        {
          success: false,
          message:
            "The queue changed while processing your request. Please refresh.",
        },
        { status: 409 }
      );
    }

    // ------------------------------------
    // AUDIT LOGS
    // ------------------------------------

    for (const pickup of pickups) {
      await connection.query(
        `
        INSERT INTO pickup_logs (
          pickup_request_id,
          pickup_queue_id,
          action,
          old_status,
          new_status,
          performed_by,
          details
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          pickup.pickup_request_id,
          pickup.pickup_queue_id,
          "MARK_READY",
          "PREPARING",
          "READY",
          teacher.user_id,
          `Gate ${duty.gate_slot}: ${teacher.first_name} ${teacher.last_name} marked the student ready.`,
        ]
      );
    }

    await connection.commit();

    return NextResponse.json({
      success: true,

      message:
        queueIds.length === 1
          ? "Student marked ready."
          : `${queueIds.length} students marked ready.`,

      updated: queueIds.length,
      queueIds,
      status: "READY",

      teacher: {
        teacher_id: teacher.teacher_id,
        name: `${teacher.first_name} ${teacher.last_name}`,
        gate_slot: duty.gate_slot,
      },
    });

  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
    }

    console.error("BULK READY ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to mark students ready.",
      },
      { status: 500 }
    );

  } finally {
    if (connection) {
      connection.release();
    }
  }
}