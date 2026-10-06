import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  try {
    const [rows] = await db.query(` 
      SELECT
        user_id,
        first_name,
        last_name,
        email,
        is_active
      FROM users
      ORDER BY user_id
    `);  //Execute a SQL query to retrieve user data from the "users" table

    return NextResponse.json({
      success: true,
      message: "ATG database connected successfully",
      users: rows,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Database connection failed",
        error: error.message,
      },
      { status: 500 }
    );
  }
}