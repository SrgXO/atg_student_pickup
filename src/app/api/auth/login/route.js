import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import db from "@/lib/db";
import { createSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          message: "Email and password are required.",
        },
        { status: 400 }
      );
    }

    const [rows] = await db.query(
      `
      SELECT
        user_id,
        first_name,
        last_name,
        email,
        password_hash,
        is_active
      FROM users
      WHERE LOWER(email) = ?
      LIMIT 1
      `,
      [email]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid email or password.",
        },
        { status: 401 }
      );
    }

    const user = rows[0];

    if (!user.is_active) {
      return NextResponse.json(
        {
          success: false,
          message: "This account is inactive.",
        },
        { status: 403 }
      );
    }

    const passwordValid = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordValid) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid email or password.",
        },
        { status: 401 }
      );
    }

    const [roleRows] = await db.query(
      `
      SELECT UPPER(r.role_name) AS role_name
      FROM user_roles ur
      JOIN roles r
        ON r.role_id = ur.role_id
      WHERE ur.user_id = ?
      ORDER BY r.role_name
      `,
      [user.user_id]
    );

    const roles = roleRows.map(
      (row) => row.role_name
    );

    if (roles.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "No role assigned to this account.",
        },
        { status: 403 }
      );
    }

    await createSession(user.user_id);

    return NextResponse.json({
      success: true,

      user: {
        user_id: user.user_id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        roles,
      },
    });

  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to sign in.",
      },
      { status: 500 }
    );
  }
}