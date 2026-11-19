import { NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import db from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function POST(request) {
  const auth = await requireUser("ADMIN");
  if (!auth.user) return NextResponse.json({ success: false, message: auth.error }, { status: auth.status });
  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file === "string" || !file.name.toLowerCase().endsWith(".csv") || file.size > 1024 * 1024)
    return NextResponse.json({ success: false, message: "Upload a CSV smaller than 1 MB." }, { status: 400 });
  let rows;
  try {
    rows = parse(await file.text(), { columns: true, bom: true, skip_empty_lines: true, trim: true });
    if (!rows.length || rows.length > 500) throw new Error("CSV must contain 1–500 students.");
  } catch (error) { return NextResponse.json({ success: false, message: error.message }, { status: 400 }); }
  const results = [];
  for (const [index, row] of rows.entries()) {
    let conn;
    try {
      const first = String(row.first_name || "").trim();
      const last = String(row.last_name || "").trim();
      const classroom = String(row.classroom_name || "").trim();
      const parentEmail = String(row.parent_email || "").trim().toLowerCase();
      if (!first || !last || !classroom || !parentEmail || first.length > 100 || last.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail))
        throw new Error("Required: first_name, last_name, classroom_name, parent_email.");
      conn = await db.getConnection();
      await conn.beginTransaction();
      const [classes] = await conn.query("SELECT classroom_id FROM classrooms WHERE classroom_name = ?", [classroom]);
      if (classes.length !== 1) throw new Error("Classroom not found or ambiguous: " + classroom);
      const [parents] = await conn.query(`SELECT p.parent_id FROM parents p JOIN users u ON u.user_id = p.user_id WHERE LOWER(u.email) = ? AND u.is_active = TRUE`, [parentEmail]);
      if (parents.length !== 1) throw new Error("Active parent account not found: " + parentEmail);
      const [existing] = await conn.query(`SELECT s.student_id FROM students s JOIN parent_students ps ON ps.student_id = s.student_id WHERE s.first_name = ? AND s.last_name = ? AND s.classroom_id = ? AND ps.parent_id = ? LIMIT 1`, [first, last, classes[0].classroom_id, parents[0].parent_id]);
      if (existing.length) throw new Error("Student already linked to this parent and classroom.");
      const [created] = await conn.query("INSERT INTO students (first_name, last_name, classroom_id, is_active) VALUES (?, ?, ?, TRUE)", [first, last, classes[0].classroom_id]);
      await conn.query("INSERT INTO parent_students (parent_id, student_id, relationship) VALUES (?, ?, ?)", [parents[0].parent_id, created.insertId, String(row.relationship || "Guardian").slice(0, 30)]);
      await conn.commit();
      results.push({ row: index + 2, success: true, student_id: created.insertId });
    } catch (error) {
      if (conn) await conn.rollback();
      results.push({ row: index + 2, success: false, message: error.message });
    } finally { if (conn) conn.release(); }
  }
  return NextResponse.json({ success: true, summary: { total: rows.length, created: results.filter(x => x.success).length, failed: results.filter(x => !x.success).length }, results });
}
