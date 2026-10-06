import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function POST(request, { params }) {
  const { id } = await params;
  const queueId = Number(id);
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

  if (!Number.isSafeInteger(queueId) || queueId <= 0) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid pickup queue ID.",
      },
      { status: 400 }
    );
  }

  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // ------------------------------------
    // CURRENT PARENT
    // ------------------------------------

    const [parents] = await connection.query(
      `
      SELECT
        p.parent_id,
        u.user_id,
        u.first_name,
        u.last_name
      FROM parents p
      JOIN users u
        ON u.user_id = p.user_id
      JOIN user_roles ur
        ON ur.user_id = u.user_id
      JOIN roles r
        ON r.role_id = ur.role_id
      WHERE u.user_id = ?
        AND u.is_active = TRUE
        AND LOWER(r.role_name) = 'parent'
      LIMIT 1
      `,
      [auth.user.user_id]
    );

    if (parents.length === 0) {
      await connection.rollback();

      return NextResponse.json(
        {
          success: false,
          message: "Parent access required.",
        },
        { status: 403 }
      );
    }

    const parent = parents[0];

    // ------------------------------------
    // LOCK + VERIFY CHILD OWNERSHIP
    // ------------------------------------

    const [pickups] = await connection.query(
      `
      SELECT
        pq.pickup_queue_id,
        pq.pickup_request_id,
        pq.student_id,
        pq.status,
        pq.ready_time,

        s.first_name AS student_first_name,
        s.last_name AS student_last_name

      FROM pickup_queue pq

      JOIN pickup_requests pr
        ON pr.pickup_request_id = pq.pickup_request_id

      JOIN students s
        ON s.student_id = pq.student_id

      JOIN parent_students ps
        ON ps.student_id = pq.student_id
        AND ps.parent_id = ?

      WHERE pq.pickup_queue_id = ?
        AND pr.parent_id = ?

      FOR UPDATE
      `,
      [
        parent.parent_id,
        queueId,
        parent.parent_id,
      ]
    );

    if (pickups.length === 0) {
      await connection.rollback();

      return NextResponse.json(
        {
          success: false,
          message:
            "Pickup not found or you are not authorized for this student.",
        },
        { status: 404 }
      );
    }

    const pickup = pickups[0];

    // ------------------------------------
    // MUST BE READY
    // ------------------------------------

    if (pickup.status !== "READY") {
      await connection.rollback();

      return NextResponse.json(
        {
          success: false,
          message:
            "This student is not ready for handover.",
        },
        { status: 409 }
      );
    }

    if (!pickup.ready_time) {
      await connection.rollback();

      return NextResponse.json(
        {
          success: false,
          message:
            "Ready timestamp is missing for this pickup.",
        },
        { status: 409 }
      );
    }

    // ------------------------------------
    // READY -> PICKED_UP
    // ------------------------------------

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
      [
        parent.user_id,
        queueId,
      ]
    );

    if (result.affectedRows !== 1) {
      await connection.rollback();

      return NextResponse.json(
        {
          success: false,
          message:
            "Pickup status changed. Please refresh.",
        },
        { status: 409 }
      );
    }

    // ------------------------------------
    // AUDIT LOG
    // ------------------------------------

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
        parent.user_id,
        `${parent.first_name} ${parent.last_name} confirmed handover for ${pickup.student_first_name} ${pickup.student_last_name}.`,
      ]
    );

    await connection.commit();

    return NextResponse.json({
      success: true,
      message: "Handover confirmed.",
      pickup_queue_id: pickup.pickup_queue_id,
      status: "PICKED_UP",
    });

  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
    }

    console.error(
      "PARENT CONFIRM HANDOVER ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Failed to confirm handover.",
      },
      { status: 500 }
    );

  } finally {
    if (connection) {
      connection.release();
    }
  }
}