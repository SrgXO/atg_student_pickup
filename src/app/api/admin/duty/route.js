
import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;



function validDate(value) {
  if (!DATE_PATTERN.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}

// ------------------------------------
// GET — Assignments + eligible teachers
// ------------------------------------

export async function GET(request) {
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

    const { searchParams } = new URL(request.url);
    let date = searchParams.get("date");

    if (!date) {
      const [todayRows] = await db.query(
        "SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today"
      );

      date = todayRows[0].today;
    }

    if (!validDate(date)) {
      return NextResponse.json(
        { success: false, message: "Invalid date. Use YYYY-MM-DD." },
        { status: 400 }
      );
    }

    const [assignments] = await db.query(
      `
      SELECT
        ds.duty_id,
        DATE_FORMAT(ds.duty_date, '%Y-%m-%d') AS duty_date,
        ds.gate_slot,
        TIME_FORMAT(ds.start_time, '%H:%i') AS start_time,
        TIME_FORMAT(ds.end_time, '%H:%i') AS end_time,
        t.teacher_id,
        CONCAT(u.first_name, ' ', u.last_name) AS teacher_name

      FROM duty_schedule ds
      JOIN teachers t ON t.teacher_id = ds.teacher_id
      JOIN users u ON u.user_id = t.user_id

      WHERE ds.duty_date = ?
      ORDER BY ds.gate_slot ASC
      `,
      [date]
    );

    // Teacher options for the Add Assignment form.
    const [teachers] = await db.query(
      `
      SELECT
        t.teacher_id,
        CONCAT(u.first_name, ' ', u.last_name) AS teacher_name
      FROM teachers t
      JOIN users u ON u.user_id = t.user_id
      WHERE u.is_active = TRUE
      ORDER BY u.first_name, u.last_name
      `
    );

    return NextResponse.json({
      success: true,
      date,
      assignments,
      teachers,
    });
  } catch (error) {
    console.error("ADMIN DUTY GET ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Failed to load duty schedule." },
      { status: 500 }
    );
  }
}

// ------------------------------------
// POST — Create duty assignment
// ------------------------------------

export async function POST(request) {
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

    const body = await request.json();

    const teacherId = Number(body.teacher_id);
    const date = body.duty_date;
    const gate = body.gate_slot;
    const startTime = body.start_time;
    const endTime = body.end_time;

    if (
      !Number.isSafeInteger(teacherId) ||
      teacherId <= 0 ||
      typeof date !== "string" ||
      !validDate(date) ||
      !["A", "B"].includes(gate) ||
      typeof startTime !== "string" ||
      typeof endTime !== "string" ||
      !TIME_PATTERN.test(startTime) ||
      !TIME_PATTERN.test(endTime) ||
      startTime >= endTime
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid assignment details or duty time.",
        },
        { status: 400 }
      );
    }

    // Only active teacher accounts can receive new assignments.
    const [teacherRows] = await db.query(
      `
      SELECT t.teacher_id
      FROM teachers t
      JOIN users u ON u.user_id = t.user_id
      WHERE t.teacher_id = ?
        AND u.is_active = TRUE
      LIMIT 1
      `,
      [teacherId]
    );

    if (teacherRows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Teacher does not exist or is inactive.",
        },
        { status: 404 }
      );
    }

    // Friendly error messages before insertion.
    const [conflicts] = await db.query(
      `
      SELECT teacher_id, gate_slot
      FROM duty_schedule
      WHERE duty_date = ?
        AND (gate_slot = ? OR teacher_id = ?)
      `,
      [date, gate, teacherId]
    );

    if (conflicts.some((row) => row.gate_slot === gate)) {
      return NextResponse.json(
        {
          success: false,
          message: `Gate ${gate} already has a teacher assigned on this date.`,
        },
        { status: 409 }
      );
    }

    if (conflicts.some((row) => row.teacher_id === teacherId)) {
      return NextResponse.json(
        {
          success: false,
          message: "This teacher is already assigned on this date.",
        },
        { status: 409 }
      );
    }

    // The DB UNIQUE constraints provide the final protection
    // if two admins submit conflicting assignments simultaneously.
    const [result] = await db.query(
      `
      INSERT INTO duty_schedule (
        teacher_id,
        duty_date,
        gate_slot,
        start_time,
        end_time
      )
      VALUES (?, ?, ?, ?, ?)
      `,
      [teacherId, date, gate, startTime, endTime]
    );

    return NextResponse.json(
      {
        success: true,
        message: `Gate ${gate} assignment created.`,
        duty_id: result.insertId,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        {
          success: false,
          message: "Teacher or gate is already assigned on this date.",
        },
        { status: 409 }
      );
    }

    console.error("ADMIN DUTY POST ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create duty assignment.",
      },
      { status: 500 }
    );
  }
}
