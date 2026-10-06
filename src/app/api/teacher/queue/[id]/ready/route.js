
import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function POST(request, { params }) {
  const { id } = await params;
  const queueId = Number(id);

  if (!Number.isSafeInteger(queueId) || queueId <= 0) {
    return NextResponse.json(
      { success: false, message: "Invalid queue ID." },
      { status: 400 }
    );
  }

  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // 1. Identify the teacher using our temporary development user.

    const [teachers] = await connection.query(
      `
      SELECT
        t.teacher_id,
        u.user_id,
        u.first_name,
        u.last_name
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
      await connection.rollback();

      return NextResponse.json(
        { success: false, message: "Teacher access required." },
        { status: 403 }
      );
    }

    const teacher = teachers[0];

    // 2. Verify today's gate duty.

    const [duties] = await connection.query(
      `
      SELECT duty_id, gate_slot
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

    // 3. Lock the specific student's pickup queue record.

    const [rows] = await connection.query(
      `
      SELECT
        pickup_queue_id,
        pickup_request_id,
        status,
        arrival_time
      FROM pickup_queue
      WHERE pickup_queue_id = ?
      FOR UPDATE
      `,
      [queueId]
    );

    if (rows.length === 0) {
      await connection.rollback();

      return NextResponse.json(
        { success: false, message: "Pickup not found." },
        { status: 404 }
      );
    }

    const pickup = rows[0];

    // 4. Validate PREPARING -> READY and today's arrival.

    const [validToday] = await connection.query(
      `
      SELECT 1
      FROM pickup_queue
      WHERE pickup_queue_id = ?
        AND arrival_time >= CURDATE()
        AND arrival_time < CURDATE() + INTERVAL 1 DAY
      LIMIT 1
      `,
      [queueId]
    );

    if (
      pickup.status !== "PREPARING" ||
      validToday.length === 0
    ) {
      await connection.rollback();

      return NextResponse.json(
        {
          success: false,
          message: "Only today's PREPARING pickups can be marked ready.",
        },
        { status: 409 }
      );
    }

    // 5. Update status, timestamp and handling teacher.

    const [result] = await connection.query(
      `
      UPDATE pickup_queue
      SET
        status = 'READY',
        ready_time = NOW(),
        handled_by_teacher_id = ?,
        updated_by = ?
      WHERE pickup_queue_id = ?
        AND status = 'PREPARING'
      `,
      [
        teacher.teacher_id,
        teacher.user_id,
        queueId,
      ]
    );

    if (result.affectedRows !== 1) {
      await connection.rollback();

      return NextResponse.json(
        {
          success: false,
          message: "Pickup status has changed. Please refresh.",
        },
        { status: 409 }
      );
    }

    // 6. Insert the audit log in the same transaction.

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
        `Gate ${duties[0].gate_slot}: ${teacher.first_name} ${teacher.last_name} marked the student ready.`,
      ]
    );

    // 7. Commit both changes.

    await connection.commit();

    return NextResponse.json({
      success: true,
      message: "Student marked ready successfully.",
      pickup_queue_id: queueId,
      status: "READY",
      handled_by_teacher_id: teacher.teacher_id,
      gate_slot: duties[0].gate_slot,
    });

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error("MARK READY ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Failed to mark student ready." },
      { status: 500 }
    );

  } finally {
    if (connection) {
      connection.release();
    }
  }
}
