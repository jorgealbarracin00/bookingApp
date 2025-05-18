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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});