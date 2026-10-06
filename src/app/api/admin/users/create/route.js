
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

import db from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["PARENT", "TEACHER", "ADMIN"];

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request) {
  let connection;

  try {
    const body = await request.json();

    const firstName = cleanText(body.first_name);
    const lastName = cleanText(body.last_name);
    const email = cleanText(body.email).toLowerCase();
    const phone = cleanText(body.phone_number);

    const roles = Array.isArray(body.roles)
      ? [...new Set(
          body.roles.map((role) =>
            cleanText(role).toUpperCase()
          )
        )]
      : [];

    // ----------------------------------
    // INPUT VALIDATION
    // ----------------------------------

    if (
      !firstName ||
      !lastName ||
      !email ||
      firstName.length > 100 ||
      lastName.length > 100 ||
      email.length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Please provide valid name and email details.",
        },
        { status: 400 }
      );
    }

    if (
      roles.length === 0 ||
      roles.some((role) => !ALLOWED_ROLES.includes(role))
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Select at least one valid account role.",
        },
        { status: 400 }
      );
    }

    if (phone.length > 30) {
      return NextResponse.json(
        {
          success: false,
          message: "Phone number is too long.",
        },
        { status: 400 }
      );
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    // ----------------------------------
    // ADMIN PERMISSION
    // ----------------------------------

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

   

    // ----------------------------------
    // CHECK EXISTING EMAIL
    // ----------------------------------

    const [existingUsers] = await connection.query(
      `
      SELECT user_id
      FROM users
      WHERE email = ?
      LIMIT 1
      `,
      [email]
    );

    if (existingUsers.length > 0) {
      await connection.rollback();

      return NextResponse.json(
        {
          success: false,
          message: "An account with this email already exists.",
        },
        { status: 409 }
      );
    }

    // ----------------------------------
    // RESOLVE DATABASE ROLE IDs
    // ----------------------------------

    const [roleRows] = await connection.query(
      `
      SELECT role_id, UPPER(role_name) AS role_name
      FROM roles
      WHERE UPPER(role_name) IN (?)
      `,
      [roles]
    );

    if (roleRows.length !== roles.length) {
      throw new Error(
        "One or more selected roles are missing from the roles table."
      );
    }

    // ----------------------------------
    // GENERATE TEMPORARY PASSWORD
    // ----------------------------------

    const temporaryPassword = randomBytes(18)
      .toString("base64url");

    const passwordHash = await bcrypt.hash(
      temporaryPassword,
      12
    );

    // ----------------------------------
    // CREATE USER ACCOUNT
    // ----------------------------------

    const [userResult] = await connection.query(
      `
      INSERT INTO users (
        email,
        password_hash,
        first_name,
        last_name,
        is_active,
        created_by
      )
      VALUES (?, ?, ?, ?, 1, ?)
      `,
      [
        email,
        passwordHash,
        firstName,
        lastName,
        auth.user.user_id,
      ]
    );

    const userId = userResult.insertId;

    // ----------------------------------
    // ASSIGN ROLES
    // ----------------------------------

    for (const role of roleRows) {
      await connection.query(
        `
        INSERT INTO user_roles (
          user_id,
          role_id,
          created_by
        )
        VALUES (?, ?, ?)
        `,
        [
          userId,
          role.role_id,
          auth.user.user_id,
        ]
      );
    }

    // ----------------------------------
    // CREATE PARENT PROFILE IF REQUIRED
    // ----------------------------------

    if (roles.includes("PARENT")) {
      await connection.query(
        `
        INSERT INTO parents (
          user_id,
          phone_number
        )
        VALUES (?, ?)
        `,
        [userId, phone || null]
      );
    }

    // ----------------------------------
    // CREATE TEACHER PROFILE IF REQUIRED
    // ----------------------------------

    if (roles.includes("TEACHER")) {
      await connection.query(
        `
        INSERT INTO teachers (
          user_id
          phone_number
        )
        VALUES (?)
        `,
        [userId, phone || null ]
      );
    }

    await connection.commit();

    return NextResponse.json(
      {
        success: true,
        message: "User created successfully.",
        user: {
          user_id: userId,
          first_name: firstName,
          last_name: lastName,
          email,
          roles,
          is_active: true,
        },

        // Display once. Never persist in client storage.
        temporary_password: temporaryPassword,
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    console.error("ADMIN CREATE USER ERROR:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        {
          success: false,
          message: "An account or role assignment already exists.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create user.",
      },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}
