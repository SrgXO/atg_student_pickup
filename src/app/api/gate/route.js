
import { NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [rows] = await db.query(
      `
      SELECT
        pq.queue_number,
        pq.status

      FROM pickup_queue pq

      WHERE
        (
          pq.status IN ('PREPARING', 'READY')
          AND pq.arrival_time >= CURDATE()
          AND pq.arrival_time < CURDATE() + INTERVAL 1 DAY
        )
        OR
        (
          pq.status = 'PICKED_UP'
          AND pq.pickup_time >= CURDATE()
          AND pq.pickup_time < CURDATE() + INTERVAL 1 DAY
        )

      ORDER BY
        CASE pq.status
          WHEN 'PREPARING' THEN 1
          WHEN 'READY' THEN 2
          WHEN 'PICKED_UP' THEN 3
        END,
        pq.queue_number ASC
      `
    );

    // Explicitly construct the public response.
    // Never return SELECT * or spread the database rows.
    const queues = rows.map((row) => ({
      queue_number: row.queue_number,
      status: row.status,
    }));

    return NextResponse.json(
      {
        success: true,
        queues,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("PUBLIC GATE QUEUE ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to retrieve gate queue.",
      },
      { status: 500 }
    );
  }
}
