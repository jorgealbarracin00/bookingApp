// scripts/runQuery.js
const pool = require('../db');

async function runQuery() {
  try {
    await pool.query(`
      ALTER TABLE available_time_slots
      ADD CONSTRAINT unique_date_time UNIQUE (date, time)
    `);
    console.log("✅ Constraint added: UNIQUE(date, time)");
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log("ℹ️ Constraint already exists. Nothing to change.");
    } else {
      console.error("❌ Failed to add constraint:", err);
    }
  } finally {
    await pool.end();
  }
}

module.exports = runQuery;