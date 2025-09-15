import mysql from "mysql2";

const db = mysql.createConnection({
  host: "localhost",
  // port: 3307,          // change to 3306 if that's your MySQL port
  user: "root",
  password: "root",
  database: "premove",
});

db.connect((err) => {
  if (err) {
    console.error("❌ Database connect error:", err);
  } else {
    console.log("✅ MySQL Connected...");
  }
});

export default db;
