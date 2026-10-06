
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { parse } from "csv-parse/sync";
import bcrypt from "bcryptjs";

import db from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const HEADERS = [
  "first_name",
  "last_name",
  "email",
  "phone_number",
  "roles",
];

const VALID_ROLES = ["PARENT", "TEACHER", "ADMIN"];

function clean(value) {
  return String(value ?? "").trim();
}

function validateRow(row) {
  const firstName = clean(row.first_name);
  const lastName = clean(row.last_name);
  const email = clean(row.email).toLowerCase();
  const phone = clean(row.phone_number);

  const roles = [
    ...new Set(
      clean(row.roles)
        .split("|")
        .map((role) => role.trim().toUpperCase())
        .filter(Boolean)
    ),
  ];

  if (
    !firstName ||
    !lastName ||
    firstName.length > 100 ||
    lastName.length > 100
  ) {
    throw new Error("Invalid first or last name.");
  }

  if (
    !email ||
    email.length > 255 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error("Invalid email address.");
  }

  if (phone.length > 30) {
    throw new Error("Phone exceeds 30 characters.");
  }

  if (
    roles.length === 0 ||
    roles.some((role) => !VALID_ROLES.includes(role))
  ) {
    throw new Error(
      "Invalid roles. Use PARENT, TEACHER or ADMIN."
    );
  }

  return {
    firstName,
    lastName,
    email,
    phone,
    roles,
  };
}

export async function POST(request) {
  try {
    // ----------------------------------
    // 1. Verify active Administrator
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
    // 2. Retrieve uploaded CSV
    // ----------------------------------

    const formData = await request.formData();
    const file = formData.get("file");

    if (
      !file ||
      typeof file === "string" ||
      !file.name.toLowerCase().endsWith(".csv")
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Please select a valid .csv file.",
        },
        { status: 400 }
      );
    }

    if (file.size === 0 || file.size > 100 * 1024) {
      return NextResponse.json(
        {
          success: false,
          message: "CSV file must be between 1 byte and 100 KB.",
        },
        { status: 400 }
      );
    }

    const csvText = await file.text();

    // ----------------------------------
    // 3. Parse and validate headers
    // ----------------------------------

    let records;

    try {
      records = parse(csvText, {
        bom: true,
        columns: (columns) => {
          const normalized = columns.map((column) =>
            clean(column).toLowerCase()
          );

          if (
            normalized.length !== HEADERS.length ||
            HEADERS.some(
              (header, index) => normalized[index] !== header
            )
          ) {
            throw new Error(
              `Required columns: ${HEADERS.join(", ")}`
            );
          }

          return normalized;
        },
        skip_empty_lines: true,
        trim: true,
        relax_quotes: false,
      });
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          message: `Invalid CSV: ${error.message}`,
        },
        { status: 400 }
      );
    }

    if (records.length < 1 || records.length > 100) {
      return NextResponse.json(
        {
          success: false,
          message: "CSV must contain between 1 and 100 users.",
        },
        { status: 400 }
      );
    }

    // ----------------------------------
    // 4. Resolve database role IDs
    // ----------------------------------

    const [roleRows] = await db.query(
      `
      SELECT
        role_id,
        UPPER(role_name) AS role_name
      FROM roles
      `
    );

    const roleMap = Object.fromEntries(
      roleRows.map((role) => [
        role.role_name,
        role.role_id,
      ])
    );

    // ----------------------------------
    // 5. Process each account separately
    // ----------------------------------

    const results = [];
    const credentials = [];

    const seenEmails = new Set();

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNumber = i + 2;

      let connection = null;

      try {
        const user = validateRow(row);

        // Prevent duplicate emails within the same CSV.
        if (seenEmails.has(user.email)) {
          throw new Error("Duplicate email within this CSV file.");
        }

        seenEmails.add(user.email);

        // Check that every requested role exists.
        for (const role of user.roles) {
          if (!roleMap[role]) {
            throw new Error(
              `Database role ${role} was not found.`
            );
          }
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Check email against existing database accounts.
        const [existing] = await connection.query(
          `
          SELECT user_id
          FROM users
          WHERE email = ?
          LIMIT 1
          `,
          [user.email]
        );

        if (existing.length > 0) {
          throw new Error(
            "Email already exists in User Management."
          );
        }

        // Create a random one-time temporary password.
        const temporaryPassword = randomBytes(18)
          .toString("base64url");

        const passwordHash = await bcrypt.hash(
          temporaryPassword,
          12
        );

        // ----------------------------------
        // Insert user
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
            user.email,
            passwordHash,
            user.firstName,
            user.lastName,
            auth.user.user_id,
          ]
        );

        const userId = userResult.insertId;

        // ----------------------------------
        // Insert role assignments
        // ----------------------------------

        for (const role of user.roles) {
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
              roleMap[role],
              auth.user.user_id,
            ]
          );
        }

        // ----------------------------------
        // Parent profile
        // ----------------------------------

        if (user.roles.includes("PARENT")) {
          await connection.query(
            `
            INSERT INTO parents (
              user_id,
              phone_number )
            VALUES (?, ?)
            `,
            [
              userId,
              user.phone || null,
            ]
          );
        }

        // ----------------------------------
        // Teacher profile
        // ----------------------------------

        if (user.roles.includes("TEACHER")) {
          await connection.query(
            `
            INSERT INTO teachers (
              user_id,
              phone_number
            )
            VALUES (?, ?)
            `,
            [
              userId,
              user.phone || null,
            ]
          );
        }

        // Only commit when every related insert succeeds.
        await connection.commit();

        results.push({
          row: rowNumber,
          email: user.email,
          status: "CREATED",
          message: "Account created successfully.",
        });

        // Temporary credentials are returned once.
        // Never save plaintext passwords in the database.
        credentials.push({
          email: user.email,
          temporary_password: temporaryPassword,
        });
      } catch (error) {
        if (connection) {
          await connection.rollback();
        }

        results.push({
          row: rowNumber,
          email: clean(row.email),
          status: "FAILED",
          message:
            error.code === "ER_DUP_ENTRY"
              ? "Email or related record already exists."
              : error.code
                ? "Database operation failed."
                : error.message,
        });

        
          console.error(`CSV IMPORT ROW ${rowNumber} FAILED:`, {
            email: clean(row.email),
            code: error.code,
            errno: error.errno,
            message: error.message,
            sqlMessage: error.sqlMessage,
            sql: error.sql,
          });

      } finally {
        if (connection) {
          connection.release();
        }
      }
    }

    // ----------------------------------
    // 6. Return import summary
    // ----------------------------------

    const created = results.filter(
      (row) => row.status === "CREATED"
    ).length;

    return NextResponse.json(
      {
        success: true,

        summary: {
          total: records.length,
          created,
          failed: records.length - created,
        },

        results,
        credentials,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("ADMIN USERS IMPORT ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to process CSV import.",
      },
      { status: 500 }
    );
  }
}
