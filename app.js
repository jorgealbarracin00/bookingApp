const express = require('express');
const app = express(); // ✅ Move this to the top

const pool = require('./db');

async function addUniqueConstraint() {
  try {
    await pool.query(`
      ALTER TABLE time_slots_v2
      ADD CONSTRAINT unique_date_time_v2 UNIQUE (date, time);
    `);
    console.log("✅ UNIQUE constraint added to time_slots_v2.");
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log("⚠️ UNIQUE constraint already exists, skipping...");
    } else {
      console.error("❌ Failed to add UNIQUE constraint:", err);
    }
  }
}

addUniqueConstraint();

app.use('/assets', express.static('assets'));

const bodyParser = require('body-parser');
const path = require('path');
const cookieParser = require('cookie-parser');

app.use(cookieParser());

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

// Routes
const { router: bookingRoutes } = require('./routes/bookings');
app.use('/', bookingRoutes);

const queryTool = require('./routes/queryTool');
app.use('/admin', queryTool);

// Admin
const adminRoutes = require('./routes/admin');
app.use('/admin', adminRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});