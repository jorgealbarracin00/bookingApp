const express = require('express');
const router = express.Router();
const pool = require('../db'); // assuming db.js is in the root
const admin = require('../firebase');
const cookieParser = require('cookie-parser'); // Make sure app.js uses this

router.get('/', (req, res) => {
  res.redirect('/admin/login');
});

async function verifyFirebaseToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const idToken = authHeader?.startsWith('Bearer ')
    ? authHeader.split('Bearer ')[1]
    : req.cookies.token; // fallback to token from cookie

  if (!idToken) {
    return res.status(401).send('Unauthorized: No token provided');
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(403).send('Forbidden: Invalid token');
  }
}

router.get('/login', (req, res) => {
  res.render('admin-login'); // Public login screen
});

router.get('/dashboard', verifyFirebaseToken, async (req, res) => {
  const offset = parseInt(req.query.weekOffset || 0);
  const start = new Date();
  start.setDate(start.getDate() - start.getDay() + 1 + offset * 7); // Monday of the target week

  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const isoDate = date.toISOString().split('T')[0];
    const label = date.toLocaleDateString('en-AU', { weekday: 'short' });
    weekDays.push({ date: isoDate, label });
  }

  const timeLabels = [];
  for (let h = 9; h < 21; h++) {
    timeLabels.push(`${h.toString().padStart(2, '0')}:00`);
    timeLabels.push(`${h.toString().padStart(2, '0')}:30`);
  }

  let slotMap = {};
  try {
    const result = await pool.query(
      'SELECT date, time FROM available_time_slots WHERE date >= $1 AND date <= $2',
      [weekDays[0].date, weekDays[6].date]
    );
    result.rows.forEach(row => {
      if (!slotMap[row.date]) slotMap[row.date] = {};
      slotMap[row.date][row.time] = true;
    });
  } catch (err) {
    console.error('Error fetching slots for admin view:', err);
  }

  res.render('admin', {
    weekDays,
    timeLabels,
    slotMap,
    currentOffset: offset,
    success: req.query.success,
    error: req.query.error
  });
});

// Updated /save route for graphical weekly slot saving
router.post('/save', verifyFirebaseToken, async (req, res) => {
  const selected = req.body.slots || [];
  const weekOffset = parseInt(req.body.weekOffset || 0);
  const slots = Array.isArray(selected) ? selected : [selected];

  // Parse selected slots into date/time pairs
  const selectedMap = {};
  for (const slot of slots) {
    const [date, time] = slot.split('_');
    if (!selectedMap[date]) selectedMap[date] = new Set();
    selectedMap[date].add(time);
  }

  const start = new Date();
  start.setDate(start.getDate() - start.getDay() + 1 + weekOffset * 7);
  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    weekDates.push(d.toISOString().split('T')[0]);
  }

  try {
    await pool.query(
      'DELETE FROM available_time_slots WHERE date = ANY($1::date[])',
      [weekDates]
    );

    for (const date in selectedMap) {
      for (const time of selectedMap[date]) {
        await pool.query(
          'INSERT INTO available_time_slots (date, time, booked) VALUES ($1, $2, false)',
          [date, time]
        );
      }
    }

    res.redirect(`/admin/dashboard?weekOffset=${weekOffset}&success=1`);
  } catch (err) {
    console.error('❌ Error saving slots:', err);
    res.redirect(`/admin/dashboard?weekOffset=${weekOffset}&error=1`);
  }
});

module.exports = router;