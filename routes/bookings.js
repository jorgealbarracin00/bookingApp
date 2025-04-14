const pool = require('../db'); // adjust the path if needed

const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM available_time_slots WHERE booked = false ORDER BY date, time'
    );
    res.render('index', { slots: result.rows });
  } catch (error) {
    console.error('Error loading available slots:', error);
    res.status(500).send('❌ Failed to load booking form');
  }
});

router.post('/book', async (req, res) => {
  const { name, email, phone, date, time, slot_id } = req.body;

  try {
    // 1. Save booking to database
    await pool.query(
      'INSERT INTO bookings (name, email, phone, date, time, slot_id) VALUES ($1, $2, $3, $4, $5, $6)',
      [name, email, phone, date, time, slot_id]
    );

    // 2. Mark time slot as booked
    await pool.query(
      'UPDATE available_time_slots SET booked = true WHERE id = $1',
      [slot_id]
    );

    console.log(`📅 Booking confirmed for ${name} at ${date} ${time}`);
    res.send('✅ Booking confirmed!');
  } catch (error) {
    console.error('❌ Booking error:', error);
    res.status(500).send('❌ Failed to book time slot');
  }
});

module.exports = router;