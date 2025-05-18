const express = require('express');
const app = express(); // ✅ Move this to the top

const pool = require('./db');

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

app.post('/admin/delete-slot', async (req, res) => {
  try {
    const { date, time } = req.body;
    if (!date || !time) {
      return res.status(400).json({ message: 'Missing date or time' });
    }

    await pool.query(
      'UPDATE time_slots_v2 SET booked = false WHERE date = $1 AND time = $2',
      [date, time]
    );

    res.status(200).json({ message: 'Slot marked as unavailable' });
  } catch (err) {
    console.error('Error deleting slot:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});