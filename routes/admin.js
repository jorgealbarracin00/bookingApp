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

  weekDays.forEach(day => {
    slotMap[day.date] = {};
    timeLabels.forEach(time => {
      slotMap[day.date][time] = "unavailable"; // default
    });
  });

  try {
    // Fetch available slots
    const availableResult = await pool.query(
      'SELECT date, time FROM time_slots_v2 WHERE date >= $1 AND date <= $2',
      [weekDays[0].date, weekDays[6].date]
    );
    availableResult.rows.forEach(row => {
      // console.log('Available slot raw time:', row.time);
      const cleanDate = new Date(row.date).toISOString().split('T')[0];
      if (!slotMap[cleanDate]) slotMap[cleanDate] = {};
      const cleanTime = row.time.slice(0, 5).trim();
      slotMap[cleanDate][cleanTime] = "available";
    });

    // Fetch booked slots
    const bookedResult = await pool.query(
      'SELECT date, time FROM bookings WHERE date >= $1 AND date <= $2',
      [weekDays[0].date, weekDays[6].date]
    );
    bookedResult.rows.forEach(row => {
      // console.log('Booked slot raw time:', row.time);
      const cleanDate = new Date(row.date).toISOString().split('T')[0];
      if (!slotMap[cleanDate]) slotMap[cleanDate] = {};
      const cleanTime = row.time.slice(0, 5).trim();
      // Always set to "booked" if there is a booking, so bookings take precedence
      slotMap[cleanDate][cleanTime] = "booked";
    });
  } catch (err) {
    console.error('Error fetching slots for admin view:', err);
  }

  console.log('slotMap after fetching slots:', JSON.stringify(slotMap, null, 2));

  const today = new Date().toISOString().split('T')[0];

  res.render('admin', {
    weekDays,
    timeLabels,
    slotMap,
    currentOffset: offset,
    success: req.query.success,
    error: req.query.error,
    today
  });
});


// Updated /save route for graphical weekly slot saving with new input format
router.post('/save', verifyFirebaseToken, async (req, res) => {
  const weekOffset = parseInt(req.body.weekOffset || 0);

  const start = new Date();
  start.setDate(start.getDate() - start.getDay() + 1 + weekOffset * 7);
  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    weekDates.push(d.toISOString().split('T')[0]);
  }

  try {
    // Clear existing available slots for the week
    await pool.query(
      'DELETE FROM time_slots_v2 WHERE date = ANY($1::date[])',
      [weekDates]
    );

    // Parse slots from req.body keys starting with "slots_"
    for (const key in req.body) {
      if (key.startsWith('slots_')) {
        const value = req.body[key];
        if (value !== 'available') {
          // Skip unavailable slots
          continue;
        }
        // key format: slots_YYYY-MM-DD_HH:MM
        const slotPart = key.slice(6);
        const [date, time] = slotPart.split('_');
        if (date && time) {
          await pool.query(
            'INSERT INTO time_slots_v2 (date, time, booked) VALUES ($1, $2, false)',
            [date, time]
          );
        }
      }
    }

    res.redirect(`/admin/dashboard?weekOffset=${weekOffset}&success=1`);
  } catch (err) {
    console.error('❌ Error saving slots:', err);
    res.redirect(`/admin/dashboard?weekOffset=${weekOffset}&error=1`);
  }
});

router.post('/delete-slot', verifyFirebaseToken, async (req, res) => {
  console.log('DELETE-SLOT req.body:', req.body);
  const { date, time, weekOffset } = req.body || {};
  if (!date || !time) {
    console.error('❌ Missing date or time in request body:', req.body);
    return res.status(400).send('Missing date or time');
  }
  const offset = parseInt(weekOffset || 0);

  try {
    // Add console log for debugging
    console.log('Trying to delete:', date, time);

    // Check if booking exists before deletion
    const bookingCheck = await pool.query('SELECT * FROM bookings WHERE date = $1 AND time = $2', [date, time]);
    console.log('Booking found:', bookingCheck.rows.length > 0);

    // Delete from bookings
    await pool.query('DELETE FROM bookings WHERE date = $1 AND time = $2', [date, time]);

    // Set slot as available
    await pool.query(
      `INSERT INTO time_slots_v2 (date, time, booked)
       VALUES ($1, $2, false)
       ON CONFLICT (date, time) DO UPDATE SET booked = false`,
      [date, time]
    );

    console.log(`Deleted booking for ${date} ${time} and set as available.`);

    res.redirect(`/admin/dashboard?weekOffset=${offset}&success=1`);
  } catch (err) {
    console.error('❌ Error deleting slot:', err);
    res.redirect(`/admin/dashboard?weekOffset=${offset}&error=1`);
  }
});

module.exports = router;