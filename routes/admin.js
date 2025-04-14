const express = require('express');
const router = express.Router();
const pool = require('../db'); // assuming db.js is in the root

router.get('/admin', (req, res) => {
  res.render('admin');
});

router.post('/admin/save', async (req, res) => {
  const { date, times } = req.body;
  const timeArray = times.split(',').map(t => t.trim());

  try {
    for (const time of timeArray) {
      await pool.query(
        'INSERT INTO available_time_slots (date, time) VALUES ($1, $2)',
        [date, time]
      );
    }
    res.send('✅ Slots saved to database!');
  } catch (error) {
    console.error('Error saving slots:', error);
    res.status(500).send('❌ Failed to save slots');
  }
});

module.exports = router;