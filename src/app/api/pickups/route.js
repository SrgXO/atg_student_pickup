import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function POST(request) {
  let connection;

  try {
    const body = await request.json();
    const { studentIds } = body;

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

    // -------------------------
    // 1. Validate input
    // -------------------------

    if (!Array.isArray(studentIds) || studentIds.length === 0) {  
      return NextResponse.json(
        {
          success: false,
          message: "Select at least one child.",
        },
        { status: 400 }
      );
    }

    // Remove accidental duplicates.
    const uniqueStudentIds = [...new Set(studentIds.map(Number))]; //

    if (uniqueStudentIds.some((id) => !Number.isInteger(id) || id <= 0)) { //
      return NextResponse.json(
        {
          success: false,
          message: "Invalid student selection.",
        },
        { status: 400 }
      );
    }

    // -------------------------
    // 2. Get dedicated DB connection
    // -------------------------

    connection = await db.getConnection(); // Get a dedicated database connection from the connection pool

    await connection.beginTransaction();// Start a new database transaction to ensure atomicity of the following operations

    // -------------------------
    // 3. Find parent
    // -------------------------

    const [parentRows] = await connection.query( // Execute a SQL query to find the parent_id associated with the logged-in user
      `
      SELECT parent_id
      FROM parents
      WHERE user_id = ?
      `,
      [parentUserId] // Query the "parents" table to find the parent_id associated with the logged-in user
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

    // -------------------------
    // 4. Verify children belong to parent
    // -------------------------

    const placeholders = uniqueStudentIds.map(() => "?").join(","); // 

    const [authorizedStudents] = await connection.query(//
      `
      SELECT student_id
      FROM parent_students
      WHERE parent_id = ?
        AND student_id IN (${placeholders}) 
      `,
      [parentId, ...uniqueStudentIds]
    );

    if (authorizedStudents.length !== uniqueStudentIds.length) { 
      await connection.rollback();

      return NextResponse.json(
        {
          success: false,
          message: "One or more selected students are not authorized.",
        },
        { status: 403 }
      );
    }

    // -------------------------
    // 5. Prevent duplicate active pickups
    // -------------------------

    // -------------------------
// 5. Prevent duplicate pickups
// -------------------------

const [blockedRows] = await connection.query(
  `
  SELECT
    pq.student_id,
    pq.status
  FROM pickup_queue pq

  JOIN pickup_requests pr
    ON pr.pickup_request_id = pq.pickup_request_id

  WHERE pq.student_id IN (${placeholders})
    AND (
      pq.status IN (
        'REQUESTED',
        'ARRIVED',
        'PREPARING',
        'READY'
      )

      OR (
        pq.status = 'PICKED_UP'
        AND pq.pickup_time >= CURDATE()
        AND pq.pickup_time < CURDATE() + INTERVAL 1 DAY
      )
    )
  `,
  [...uniqueStudentIds]
);

if (blockedRows.length > 0) {
  await connection.rollback();

  const completedToday = blockedRows.some(
    (row) => row.status === "PICKED_UP"
  );

  return NextResponse.json(
    {
      success: false,
      message: completedToday
        ? "One or more selected children have already been picked up today."
        : "One or more selected children already have an active pickup.",
      blockedStudents: blockedRows,
    },
    { status: 409 }
  );
}

    // -------------------------
    // 6. Create parent-level request
    // -------------------------

    const [requestResult] = await connection.query(
      `
      INSERT INTO pickup_requests (
        parent_id,
        created_by,
        updated_by
      )
      VALUES (?, ?, ?)
      `,
      [parentId, parentUserId, parentUserId]
    );

    const pickupRequestId = requestResult.insertId;

    // -------------------------
    // 7. Create one queue row per child
    // -------------------------

    for (const studentId of uniqueStudentIds) {
      await connection.query(
        `
        INSERT INTO pickup_queue (
          pickup_request_id,
          student_id,
          status,
          created_by,
          updated_by
        )
        VALUES (?, ?, 'REQUESTED', ?, ?)
        `,
        [
          pickupRequestId,
          studentId,
          parentUserId,
          parentUserId,
        ]
      );
    }

    // -------------------------
    // 8. Save everything
    // -------------------------

    await connection.commit();

    return NextResponse.json(
      {
        success: true,
        message: "Pickup request created successfully.",
        pickupRequestId,
        childrenRequested: uniqueStudentIds.length,
      },
      { status: 201 }
    );

  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
    }

    console.error("CREATE PICKUP ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create pickup request.",
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