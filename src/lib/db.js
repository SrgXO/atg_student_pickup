import mysql from "mysql2/promise"; //promise-based MySQL client for Node.js

const pool = mysql.createPool({  //reusable connection pool for MySQL database
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 3306),

  waitForConnections: true,
  connectionLimit: 10, //maximum number of connections in the pool
  queueLimit: 0,
});

export default pool;