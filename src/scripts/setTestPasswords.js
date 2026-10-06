const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "atg_student_pickup",
  });

  const accounts = [
    {
      email: "sarah@atg.parent",
      password: "Parent123!"
    },
    {
      email: "emily@atg.teacher",
      password: "Teacher123!"
    },
    {
      email: "jack@atg.one",
      password: "Jack123!"
    },
    {
      email: "lewis@atg.admin",
      password: "Admin123!"
    }
  ];

  for (const account of accounts) {
    const hash = await bcrypt.hash(account.password, 12);

    const [result] = await connection.query(
      `
      UPDATE users
      SET password_hash = ?
      WHERE email = ?
      `,
      [hash, account.email]
    );

    console.log(
      `${account.email}: ${result.affectedRows === 1 ? "UPDATED" : "NOT FOUND"}`
    );
  }

  await connection.end();

  console.log("\nTest credentials:");
  for (const account of accounts) {
    console.log(`${account.email} / ${account.password}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});