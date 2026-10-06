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

    // Get current teacher account
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

    // Check today's Gate A/B assignment
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

    /*
     * Lock every selected queue row.
     *
     * We intentionally validate ALL selected rows before updating
     * anything. If even one is no longer ARRIVED, the entire
     * operation rolls back.
     */
    const placeholders = queueIds.map(() => "?").join(",");

    const [pickups] = await connection.query(
      `
      SELECT
        pickup_queue_id,
        pickup_request_id,
        status,
        arrival_time
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

    // Every selected student must still be ARRIVED.
    const invalidPickup = pickups.find(
      (pickup) => pickup.status !== "ARRIVED"
    );

    if (invalidPickup) {
      await connection.rollback();

      return NextResponse.json(
        {
          success: false,
          message:
            "One or more selected students have already been assigned. Refresh the queue.",
        },
        { status: 409 }
      );
    }

    // Every selected arrival must belong to today.
    const invalidDate = pickups.find((pickup) => {
      if (!pickup.arrival_time) return true;

      const arrival = new Date(pickup.arrival_time);
      const now = new Date();

      return (
        arrival.getFullYear() !== now.getFullYear() ||
        arrival.getMonth() !== now.getMonth() ||
        arrival.getDate() !== now.getDate()
      );
    });

    if (invalidDate) {
      await connection.rollback();

      return NextResponse.json(
        {
          success: false,
          message: "Only today's arrived students can be prepared.",
        },
        { status: 409 }
      );
    }

    // ARRIVED -> PREPARING
    const [result] = await connection.query(
      `
      UPDATE pickup_queue
      SET
        status = 'PREPARING',
        preparation_start_time = NOW(),
        handled_by_teacher_id = ?,
        updated_by = ?
      WHERE pickup_queue_id IN (${placeholders})
        AND status = 'ARRIVED'
      `,
      [
        teacher.teacher_id,
        teacher.user_id,
        ...queueIds,
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

    // Audit every student individually.
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
          "START_PREPARING",
          "ARRIVED",
          "PREPARING",
          teacher.user_id,
          `Gate ${duty.gate_slot}: ${teacher.first_name} ${teacher.last_name} started preparing the student.`,
        ]
      );
    }

    await connection.commit();

    return NextResponse.json({
      success: true,
      message:
        queueIds.length === 1
          ? "Student moved to preparing."
          : `${queueIds.length} students moved to preparing.`,
      updated: queueIds.length,
      queueIds,
      status: "PREPARING",
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

    console.error("PREPARE PICKUPS ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to start preparing students.",
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
}