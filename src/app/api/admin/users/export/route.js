
import { NextResponse } from "next/server";

import db from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Prevent CSV formatting errors and spreadsheet formula injection.
function csvCell(value) {
  let text = String(value ?? "");

  if (/^\s*[=+\-@\t\r]/.test(text)) {
    text = "'" + text;
  }

  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET() {
  try {
    // Verify active Administrator.
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

  
    // Retrieve accounts and their assigned roles.
    const [rows] = await db.query(
      `
      SELECT
        u.first_name,
        u.last_name,
        u.email,

        COALESCE(
          NULLIF(p.phone_number, ''),
          NULLIF(t.phone_number, ''),
          ''
        ) AS phone_number,

        GROUP_CONCAT(
          DISTINCT UPPER(r.role_name)
          ORDER BY r.role_name
          SEPARATOR '|'
        ) AS roles

      FROM users u

      LEFT JOIN user_roles ur
        ON ur.user_id = u.user_id

      LEFT JOIN roles r
        ON r.role_id = ur.role_id

      LEFT JOIN parents p
        ON p.user_id = u.user_id

      LEFT JOIN teachers t
        ON t.user_id = u.user_id

      GROUP BY
        u.user_id,
        u.first_name,
        u.last_name,
        u.email,
        p.phone_number,
        t.phone_number

      ORDER BY u.first_name, u.last_name
      `
    );

    const headers = [
      "first_name",
      "last_name",
      "email",
      "phone_number",
      "roles",
    ];

    const lines = [
      headers.join(","),

      ...rows.map((user) =>
        [
          user.first_name,
          user.last_name,
          user.email,
          user.phone_number,
          user.roles,
        ]
          .map(csvCell)
          .join(",")
      ),
    ];

    // BOM ensures better UTF-8 compatibility with Excel.
    const csv = "\uFEFF" + lines.join("\r\n") + "\r\n";

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="ATG_Users_Export.csv"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("ADMIN EXPORT USERS ERROR:", {
  code: error.code,
  message: error.message,
  sqlMessage: error.sqlMessage,
  sql: error.sql,
});

    return NextResponse.json(
      {
        success: false,
        message: "Failed to export users.",
      },
      { status: 500 }
    );
  }
}
