
import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function DELETE(request, { params }) {
  let connection;

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
    const { id } = await params;
    const dutyId = Number(id);

    if (!Number.isSafeInteger(dutyId) || dutyId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid duty ID." },
        { status: 400 }
      );
    }

    connection = await db.getConnection();
    await connection.beginTransaction();


    // Lock the selected duty assignment.
    const [duties] = await connection.query(
      `
      SELECT
        duty_id,
        teacher_id,
        duty_date,
        gate_slot
      FROM duty_schedule
      WHERE duty_id = ?
      FOR UPDATE
      `,
      [dutyId]
    );

    if (duties.length === 0) {
      await connection.rollback();

      return NextResponse.json(
        {
          success: false,
          message: "Duty assignment not found.",
        },
        { status: 404 }
      );
    }

    const duty = duties[0];

    // Do not remove an assignment if the teacher is
    // already handling active pickups on that date.
    const [activePickups] = await connection.query(
      `
      SELECT pq.pickup_queue_id
      FROM pickup_queue pq
      WHERE pq.handled_by_teacher_id = ?
        AND pq.status IN ('PREPARING', 'READY')
        AND pq.arrival_time >= DATE(?)
        AND pq.arrival_time < DATE(?) + INTERVAL 1 DAY
      LIMIT 1
      `,
      [
        duty.teacher_id,
        duty.duty_date,
        duty.duty_date,
      ]
    );

    if (activePickups.length > 0) {
      await connection.rollback();

      return NextResponse.json(
        {
          success: false,
          message:
            "Cannot delete this assignment while the teacher has active pickups.",
        },
        { status: 409 }
      );
    }

    await connection.query(
      `
      DELETE FROM duty_schedule
      WHERE duty_id = ?
      `,
      [dutyId]
    );

    await connection.commit();

    return NextResponse.json({
      success: true,
      message: `Gate ${duty.gate_slot} assignment deleted.`,
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error("DELETE DUTY ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete duty assignment.",
      },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}
