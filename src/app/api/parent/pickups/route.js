import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireUser("PARENT");

    if (!auth.user) {
      return NextResponse.json(
        {
          success: false,
          message: auth.error,
        },
        { status: auth.status }
      );
    }

    const parentUserId = auth.user.user_id;

    const [rows] = await db.query(
      `
      SELECT
        pq.pickup_queue_id,
        pq.pickup_request_id,
        pq.student_id,
        pq.queue_number,
        pq.status AS pickup_status,

        pq.arrival_time,
        pq.preparation_start_time,
        pq.ready_time,
        pq.pickup_time,

        pr.request_time,

        s.first_name,
        s.last_name,

        c.classroom_name,
        c.grade_level

      FROM pickup_queue pq

      JOIN pickup_requests pr
        ON pr.pickup_request_id = pq.pickup_request_id

      JOIN parents p
        ON p.parent_id = pr.parent_id

      JOIN students s
        ON s.student_id = pq.student_id

      JOIN classrooms c
        ON c.classroom_id = s.classroom_id

      WHERE p.user_id = ?
        AND (
          pq.status IN (
            'REQUESTED',
            'ARRIVED',
            'PREPARING',
            'READY'
          )

          OR (
            pq.status = 'PICKED_UP'
            AND pq.pickup_time >= CURDATE()
            AND pq.pickup_time < CURDATE() + INTERVAL 1 DAY
          )
        )

      ORDER BY
        CASE
          WHEN pq.status = 'READY' THEN 1
          WHEN pq.status = 'PREPARING' THEN 2
          WHEN pq.status = 'ARRIVED' THEN 3
          WHEN pq.status = 'REQUESTED' THEN 4
          ELSE 5
        END,
        pq.pickup_queue_id DESC
      `,
      [parentUserId]
    );

    const active = rows.filter((pickup) =>
      [
        "REQUESTED",
        "ARRIVED",
        "PREPARING",
        "READY",
      ].includes(pickup.pickup_status)
    );

    const completed = rows.filter(
      (pickup) => pickup.pickup_status === "PICKED_UP"
    );

    return NextResponse.json(
      {
        success: true,
        active,
        completed,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("PARENT PICKUPS ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load parent pickups.",
      },
      { status: 500 }
    );
  }
}