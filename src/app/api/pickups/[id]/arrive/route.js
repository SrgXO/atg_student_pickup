import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function POST(request, { params }) {
  let connection;

  try {
    const { id } = await params;
    const pickupRequestId = Number(id);

    // Temporary until authentication is implemented.
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

    if (
      !Number.isInteger(pickupRequestId) ||
      pickupRequestId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid pickup request.",
        },
        { status: 400 }
      );
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    // Find the parent making this request.
    const [parentRows] = await connection.query(
      `
      SELECT parent_id
      FROM parents
      WHERE user_id = ?
      `,
      [parentUserId]
    );

    if (parentRows.length === 0) {
      await connection.rollback();

      return NextResponse.json(
        {
          success: false,
          message: "Parent account not found.",
        },
        { status: 404 }
      );
    }

    const parentId = parentRows[0].parent_id;

    // Verify this pickup request belongs to this parent.
    // FOR UPDATE also locks it during this transaction.
    const [requestRows] = await connection.query(
      `
      SELECT pickup_request_id
      FROM pickup_requests
      WHERE pickup_request_id = ?
        AND parent_id = ?
      FOR UPDATE
      `,
      [pickupRequestId, parentId]
    );

    if (requestRows.length === 0) {
      await connection.rollback();

      return NextResponse.json(
        {
          success: false,
          message: "Pickup request not found.",
        },
        { status: 404 }
      );
    }

    // Get every REQUESTED child belonging to this pickup.
    const [queueRows] = await connection.query(
      `
      SELECT pickup_queue_id, student_id
      FROM pickup_queue
      WHERE pickup_request_id = ?
        AND status = 'REQUESTED'
      ORDER BY pickup_queue_id
      FOR UPDATE
      `,
      [pickupRequestId]
    );

    if (queueRows.length === 0) {
      await connection.rollback();

      return NextResponse.json(
        {
          success: false,
          message: "This pickup has already been checked in.",
        },
        { status: 409 }
      );
    }

    /*
      Find today's highest queue number.

      Queue numbers are generated only when parents arrive.
    */
    const [maxQueueRows] = await connection.query(
      `
      SELECT COALESCE(MAX(queue_number), 0) AS max_queue
      FROM pickup_queue
      WHERE DATE(arrival_time) = CURDATE()
      FOR UPDATE
      `
    );

    let nextQueueNumber =
      Number(maxQueueRows[0].max_queue) + 1;

    const assignedQueues = [];

    // Give every child their own queue number.
    for (const queueItem of queueRows) {
      const queueNumber = nextQueueNumber;

      await connection.query(
        `
        UPDATE pickup_queue
        SET
          queue_number = ?,
          status = 'ARRIVED',
          arrival_time = NOW(),
          updated_by = ?
        WHERE pickup_queue_id = ?
          AND status = 'REQUESTED'
        `,
        [
          queueNumber,
          parentUserId,
          queueItem.pickup_queue_id,
        ]
      );

      assignedQueues.push({
        studentId: queueItem.student_id,
        queueNumber,
      });

      nextQueueNumber++;
    }

    await connection.commit();

    return NextResponse.json({
      success: true,
      message: "Arrival confirmed.",
      pickupRequestId,
      queues: assignedQueues,
    });

  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
    }

    console.error("ARRIVAL ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to confirm arrival.",
        error: error.message,
      },
      { status: 500 }
    );

  } finally {
    if (connection) {
      connection.release();
    }
  }
}