
import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(request, { params }) {
  let connection;

  try {
    const { id } = await params;
    const targetUserId = Number(id);
    const body = await request.json();
    const isActive = body.is_active;

    if (
      !Number.isSafeInteger(targetUserId) ||
      targetUserId <= 0 ||
      typeof isActive !== "boolean"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Valid user ID and boolean is_active are required.",
        },
        { status: 400 }
      );
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    // 1. Verify the acting administrator.
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

    

    // 2. Lock the target account.
    const [users] = await connection.query(
      `
      SELECT user_id, first_name, last_name, is_active
      FROM users
      WHERE user_id = ?
      FOR UPDATE
      `,
      [targetUserId]
    );

    if (users.length === 0) {
      await connection.rollback();

      return NextResponse.json(
        { success: false, message: "User not found." },
        { status: 404 }
      );
    }

    const target = users[0];

    if (Boolean(target.is_active) === isActive) {
      await connection.rollback();

      return NextResponse.json({
        success: true,
        message: "Account already has the requested status.",
        user_id: targetUserId,
        is_active: isActive,
      });
    }

    // 3. Safeguards for deactivation.
    if (!isActive) {
      if (targetUserId === auth.user.user_id) {
        await connection.rollback();

        return NextResponse.json(
          {
            success: false,
            message: "You cannot deactivate your own Admin account.",
          },
          { status: 409 }
        );
      }

      const [targetAdmin] = await connection.query(
        `
        SELECT 1
        FROM user_roles ur
        JOIN roles r ON r.role_id = ur.role_id
        WHERE ur.user_id = ?
          AND UPPER(r.role_name) = 'ADMIN'
        LIMIT 1
        `,
        [targetUserId]
      );

      if (targetAdmin.length > 0) {
        // Serialize Admin status changes while counting administrators.
        // Lock the roles' Admin row first.
        const [activeAdmins] = await connection.query(
          `
          SELECT COUNT(DISTINCT u.user_id) AS total
          FROM users u
          JOIN user_roles ur ON ur.user_id = u.user_id
          JOIN roles r ON r.role_id = ur.role_id
          WHERE UPPER(r.role_name) = 'ADMIN'
            AND u.is_active = TRUE
          `
        );

        if (Number(activeAdmins[0].total) <= 1) {
          await connection.rollback();

          return NextResponse.json(
            {
              success: false,
              message: "The last active Administrator cannot be deactivated.",
            },
            { status: 409 }
          );
        }
      }

      // Do not disable teachers who have current/future duties.
      const [duties] = await connection.query(
        `
        SELECT ds.duty_id
        FROM teachers t
        JOIN duty_schedule ds
          ON ds.teacher_id = t.teacher_id
        WHERE t.user_id = ?
          AND ds.duty_date >= CURDATE()
        LIMIT 1
        `,
        [targetUserId]
      );

      if (duties.length > 0) {
        await connection.rollback();

        return NextResponse.json(
          {
            success: false,
            message:
              "Remove this teacher's current or future duty assignments before deactivating the account.",
          },
          { status: 409 }
        );
      }

      // Do not interrupt a teacher's active pickup processing.
      const [teacherPickups] = await connection.query(
        `
        SELECT pq.pickup_queue_id
        FROM teachers t
        JOIN pickup_queue pq
          ON pq.handled_by_teacher_id = t.teacher_id
        WHERE t.user_id = ?
          AND pq.status IN ('PREPARING', 'READY')
        LIMIT 1
        `,
        [targetUserId]
      );

      if (teacherPickups.length > 0) {
        await connection.rollback();

        return NextResponse.json(
          {
            success: false,
            message:
              "This teacher still has active pickups to complete.",
          },
          { status: 409 }
        );
      }

      // Parents must finish any ongoing pickup before deactivation.
      const [parentPickups] = await connection.query(
        `
        SELECT pq.pickup_queue_id
        FROM parents p
        JOIN pickup_requests pr
          ON pr.parent_id = p.parent_id
        JOIN pickup_queue pq
          ON pq.pickup_request_id = pr.pickup_request_id
        WHERE p.user_id = ?
          AND pq.status IN (
            'REQUESTED', 'ARRIVED', 'PREPARING', 'READY'
          )
        LIMIT 1
        `,
        [targetUserId]
      );

      if (parentPickups.length > 0) {
        await connection.rollback();

        return NextResponse.json(
          {
            success: false,
            message:
              "This parent has an active pickup. Complete or cancel it first.",
          },
          { status: 409 }
        );
      }
    }

    // 4. Apply the account status change.
    await connection.query(
      `
      UPDATE users
      SET is_active = ?
      WHERE user_id = ?
      `,
      [isActive ? 1 : 0, targetUserId]
    );

    await connection.commit();

    return NextResponse.json({
      success: true,
      message: isActive
        ? "Account activated successfully."
        : "Account deactivated successfully.",
      user_id: targetUserId,
      is_active: isActive,
    });
  } catch (error) {
    if (connection) await connection.rollback();

    console.error("ADMIN ACCOUNT STATUS ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update account status.",
      },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}
