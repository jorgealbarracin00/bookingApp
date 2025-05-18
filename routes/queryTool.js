const express = require('express');
const router = express.Router();
const db = require('../db'); // Adjust the path if your DB connection file is elsewhere

// Route to fetch all booked time slots from the available_time_slots table
router.get('/run-manual-query', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM available_time_slots WHERE booked = true');
    res.json(result.rows);
  } catch (err) {
    console.error('Error running manual query:', err);
    res.status(500).json({ error: 'Query failed' });
  }
});

module.exports = router;