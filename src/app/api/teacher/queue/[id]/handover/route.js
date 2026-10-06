
import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function POST(request, { params }) {
  const { id } = await params;
  const queueId = Number(id);

  if (!Number.isSafeInteger(queueId) || queueId <= 0) {
    return NextResponse.json(
      { success: false, message: "Invalid pickup queue ID." },
      { status: 400 }
    );
  }

  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // 1. Identify the teacher.
    // Temporary development identity; replace with a real session
    // before exposing the application publicly.

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

    // 2. Check today's gate assignment.

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

    // 3. Lock the child's queue record.

    const [rows] = await connection.query(
      `
      SELECT
        pickup_queue_id,
        pickup_request_id,
        status,
        arrival_time,
        ready_time,
        handled_by_teacher_id
      FROM pickup_queue
      WHERE pickup_queue_id = ?
      FOR UPDATE
      `,
      [queueId]
    );

    if (rows.length === 0) {
      await connection.rollback();

      return NextResponse.json(
        { success: false, message: "Pickup record not found." },
        { status: 404 }
      );
    }

    const pickup = rows[0];

    // 4. Validate the transition and pickup date.

    const [validToday] = await connection.query(
      `
      SELECT 1 AS valid
      FROM pickup_queue
      WHERE pickup_queue_id = ?
        AND arrival_time >= CURDATE()
        AND arrival_time < CURDATE() + INTERVAL 1 DAY
      LIMIT 1
      `,
      [queueId]
    );

    if (
      pickup.status !== "READY" ||
      pickup.ready_time == null ||
      validToday.length === 0
    ) {
      await connection.rollback();

      return NextResponse.json(
        {
          success: false,
          message: "Only today's READY pickups can be handed over.",
        },
        { status: 409 }
      );
    }

    // 5. Confirm handover.
    // IMPORTANT: Do not overwrite handled_by_teacher_id.
    // That column identifies the teacher who marked the student READY.

    const [result] = await connection.query(
      `
      UPDATE pickup_queue
      SET
        status = 'PICKED_UP',
        pickup_time = NOW(),
        updated_by = ?
      WHERE pickup_queue_id = ?
        AND status = 'READY'
      `,
      [teacher.user_id, queueId]
    );

    if (result.affectedRows !== 1) {
      await connection.rollback();

      return NextResponse.json(
        {
          success: false,
          message: "Pickup status changed. Please refresh.",
        },
        { status: 409 }
      );
    }

    // 6. Record who actually confirmed the handover.

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
        "CONFIRM_HANDOVER",
        "READY",
        "PICKED_UP",
        teacher.user_id,
        `Gate ${duties[0].gate_slot}: ${teacher.first_name} ${teacher.last_name} confirmed student handover.`,
      ]
    );

    // 7. Commit the status change and audit log together.

    await connection.commit();

    return NextResponse.json({
      success: true,
      message: "Student handover confirmed successfully.",
      pickup_queue_id: queueId,
      status: "PICKED_UP",
      handled_by_teacher_id: pickup.handled_by_teacher_id,
      handover_performed_by: teacher.user_id,
      gate_slot: duties[0].gate_slot,
    });

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error("CONFIRM HANDOVER ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to confirm student handover.",
      },
      { status: 500 }
    );

  } finally {
    if (connection) {
      connection.release();
    }
  }
}
