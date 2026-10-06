import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
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

    const [users] = await db.query(
      `
      SELECT
        u.user_id,
        u.first_name,
        u.last_name,
        u.email,
        t.teacher_id,
        t.phone_number

      FROM users u

      JOIN teachers t
        ON t.user_id = u.user_id

      WHERE u.user_id = ?
        AND u.is_active = TRUE

      LIMIT 1
      `,
      [auth.user.user_id]
    );

    if (users.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Teacher profile not found.",
        },
        { status: 404 }
      );
    }

    const user = users[0];

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
      [user.teacher_id]
    );

    return NextResponse.json(
      {
        success: true,

        user: {
          ...user,
          roles: auth.user.roles,
        },

        duty: duties[0] ?? null,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );

  } catch (error) {
    console.error("TEACHER PROFILE ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load teacher profile.",
      },
      { status: 500 }
    );
  }
}