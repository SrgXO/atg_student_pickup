
import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Verify Admin role.
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

   

    // Retrieve today's gate assignments.
    const [rows] = await db.query(
      `
      SELECT
        ds.duty_id,
        ds.duty_date,
        ds.gate_slot,
        ds.start_time,
        ds.end_time,

        t.teacher_id,

        CONCAT(u.first_name, ' ', u.last_name)
          AS teacher_name

      FROM duty_schedule ds

      JOIN teachers t
        ON t.teacher_id = ds.teacher_id

      JOIN users u
        ON u.user_id = t.user_id


      WHERE ds.duty_date = CURDATE()
        AND u.is_active = TRUE

      ORDER BY ds.gate_slot ASC, teacher_name ASC
      `
    );

    return NextResponse.json({
      success: true,
      total: rows.length,
      teachers: rows.map((row) => ({
        ...row,
        gate_label: `Gate ${row.gate_slot}`,
      })),
    });
  } catch (error) {
  console.error("ADMIN ON DUTY ERROR:", {
    code: error.code,
    message: error.message,
    sqlMessage: error.sqlMessage,
    sql: error.sql,
  });

  return NextResponse.json(
    {
      success: false,
      message: "Failed to retrieve today's duty assignments.",
      debug: {
        code: error.code,
        sqlMessage: error.sqlMessage || error.message,
      },
    },
    { status: 500 }
  );
}
}
