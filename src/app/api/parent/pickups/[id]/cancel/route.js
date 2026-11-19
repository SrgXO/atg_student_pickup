import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function POST(request, { params }) {
  const auth = await requireUser("PARENT");
  if (!auth.user) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
  const { id } = await params;
  const queueId = Number(id);
  if (!Number.isSafeInteger(queueId) || queueId < 1) return NextResponse.json({ success: false, message: "Invalid queue ID." }, { status: 400 });
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.query(`
      SELECT pq.pickup_queue_id, pq.status, pq.pickup_request_id
      FROM pickup_queue pq
      JOIN pickup_requests pr ON pr.pickup_request_id = pq.pickup_request_id
      JOIN parents p ON p.parent_id = pr.parent_id
      JOIN parent_students ps ON ps.parent_id = p.parent_id AND ps.student_id = pq.student_id
      WHERE pq.pickup_queue_id = ? AND p.user_id = ? FOR UPDATE
    `, [queueId, auth.user.user_id]);
    if (!rows.length) { await connection.rollback(); return NextResponse.json({ success: false, message: "Queue not found or not yours." }, { status: 404 }); }
    if (!["REQUESTED", "ARRIVED"].includes(rows[0].status)) {
      await connection.rollback();
      return NextResponse.json({ success: false, message: "Cannot cancel after a teacher starts preparing the student." }, { status: 409 });
    }
    await connection.query("UPDATE pickup_queue SET status = 'CANCELLED' WHERE pickup_queue_id = ?", [queueId]);
    await connection.query(`INSERT INTO pickup_logs (pickup_request_id, pickup_queue_id, action, old_status, new_status, performed_by, details)
      VALUES (?, ?, 'CANCEL_PICKUP', ?, 'CANCELLED', ?, ?)`, [rows[0].pickup_request_id, queueId, rows[0].status, auth.user.user_id, `Parent cancelled queue from ${rows[0].status}`]);
    await connection.commit();
    return NextResponse.json({ success: true, message: "Pickup queue cancelled." });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("CANCEL PICKUP ERROR", error);
    return NextResponse.json({ success: false, message: "Unable to cancel pickup." }, { status: 500 });
  } finally { if (connection) connection.release(); }
}
