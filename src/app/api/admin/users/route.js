
import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Verify Admin access.
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

  
    // Each login account appears ONCE, even if it
    // has both Parent and Teacher roles.
    
    const [userRows] = await db.query(
    `
    SELECT
        u.user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.is_active,

        COALESCE(
        NULLIF(p.phone_number, ''),
        NULLIF(t.phone_number, '')
        ) AS phone,

        GROUP_CONCAT(
        DISTINCT UPPER(r.role_name)
        ORDER BY r.role_name
        SEPARATOR ','
        ) AS role_list

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
        u.is_active,
        p.phone_number,
        t.phone_number

    ORDER BY u.first_name, u.last_name
    `
    );


    // Student records are separate from user accounts.
    
const [studentRows] = await db.query(
  `
  SELECT
    s.student_id,
    s.first_name,
    s.last_name,
    c.classroom_name,

    GROUP_CONCAT(
      DISTINCT CONCAT(pu.first_name, ' ', pu.last_name)
      ORDER BY pu.first_name, pu.last_name
      SEPARATOR ', '
    ) AS parent_names

  FROM students s

  LEFT JOIN classrooms c
    ON c.classroom_id = s.classroom_id

  LEFT JOIN parent_students ps
    ON ps.student_id = s.student_id

  LEFT JOIN parents p
    ON p.parent_id = ps.parent_id

  LEFT JOIN users pu
    ON pu.user_id = p.user_id

  GROUP BY
    s.student_id,
    s.first_name,
    s.last_name,
    c.classroom_name

  ORDER BY s.first_name, s.last_name
  `
);


    return NextResponse.json({
      success: true,

      users: userRows.map((row) => ({
        user_id: row.user_id,
        name: `${row.first_name} ${row.last_name}`,
        email: row.email,
        phone: row.phone || null,
        is_active: Boolean(row.is_active),

        roles: row.role_list
          ? row.role_list.split(",")
          : [],
      })),

      students: studentRows.map((row) => ({
        student_id: row.student_id,
        name: `${row.first_name} ${row.last_name}`,
        classroom_name: row.classroom_name,
        parent_names: row.parent_names || null,
      })),
    });
  } catch (error) {
    console.error("ADMIN USERS ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to retrieve user management records.",
      },
      { status: 500 }
    );
  }
}
