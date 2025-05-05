const pool = require('../db'); // adjust the path if needed

const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  const currentOffset = parseInt(req.query.weekOffset || 0);
  const today = new Date();
  const weekDays = [];

  const start = new Date(today);
  start.setDate(start.getDate() - start.getDay() + 1 + currentOffset * 7); // Monday
  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const isoDate = date.toISOString().split('T')[0];
    const label = date.toLocaleDateString('en-AU', { weekday: 'short' });
    weekDays.push({ date: isoDate, label });
  }

  const timeLabels = [
    '09:00', '09:30', '10:00', '10:30', '11:00',
    '11:30', '12:00', '12:30', '13:00', '13:30',
    '14:00', '14:30', '15:00', '15:30', '16:00'
  ];

  const weeklySlots = {};

  try {
    const result = await pool.query(
      'SELECT id, date, time, booked FROM available_time_slots WHERE date >= $1 AND date <= $2 ORDER BY date, time',
      [weekDays[0].date, weekDays[6].date]
    );

    for (const row of result.rows) {
      if (!weeklySlots[row.date]) weeklySlots[row.date] = [];
      weeklySlots[row.date].push({
        id: row.id,
        time: row.time.slice(0, 5),
        available: !row.booked
      });
    }

    res.render('index', {
      weekDays,
      timeLabels,
      weeklySlots,
      currentOffset,
      formData: {
        name: req.query.name || '',
        email: req.query.email || '',
        phone: req.query.phone || ''
      },
      success: req.query.success,
      error: req.query.error
    });
  } catch (err) {
    console.error('❌ Error fetching weekly slots:', err);
    res.status(500).send('Server error');
  }
});

router.post('/book', async (req, res) => {
  const { name, email, phone, slot_id } = req.body;
  console.log('🧾 Booking Request Body:', req.body);

  try {
    console.log('🔍 Fetching time for slot ID:', slot_id);
    const timeResult = await pool.query(
      'SELECT time FROM available_time_slots WHERE id = $1',
      [slot_id]
    );

    const time = timeResult.rows[0]?.time;

    if (!time) {
      console.error('❌ Invalid time slot selected');
      return res.status(400).send('❌ Invalid time slot selected.');
    }

    console.log('🔍 Fetching date for slot ID:', slot_id);
    const dateResult = await pool.query(
      'SELECT date FROM available_time_slots WHERE id = $1',
      [slot_id]
    );
    const date = dateResult.rows[0]?.date;

    console.log('📥 Inserting booking...');
    await pool.query(
      'INSERT INTO bookings (name, email, phone, date, time, slot_id) VALUES ($1, $2, $3, $4, $5, $6)',
      [name, email, phone, date, time, slot_id]
    );
    console.log('✅ Booking inserted');

    console.log('📦 Updating time slot to booked...');
    await pool.query(
      'UPDATE available_time_slots SET booked = true WHERE id = $1',
      [slot_id]
    );
    console.log('✅ Slot updated');

    console.log('📧 Sending emails...');
    const nodemailer = require('nodemailer');

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const userMailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: '✅ Your meeting is confirmed',
      text: `Hi ${name}, your meeting is booked for ${date} at ${time}.`
    };

    const adminMailOptions = {
      from: process.env.EMAIL_USER,
      to: '12201406@students.koi.edu.au',
      subject: '📅 New Booking Received',
      text: `New booking: ${name}, ${email}, ${phone} at ${date} ${time}.`
    };

    await transporter.sendMail(userMailOptions);
    await transporter.sendMail(adminMailOptions);

    console.log(`📅 Booking confirmed for ${name} at ${date} ${time}`);
    res.redirect(`/?weekOffset=0&name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}&phone=${encodeURIComponent(phone)}&success=1`);
  } catch (error) {
    console.error('❌ Booking error:', error.message);
    res.redirect(`/?weekOffset=0&name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}&phone=${encodeURIComponent(phone)}&error=1`);
  }
});

// Utility: send reminders for bookings 30 mins away
async function sendReminderEmails() {
  const now = new Date();
  const in30Minutes = new Date(now.getTime() + 30 * 60000);

  const currentDate = now.toISOString().split('T')[0];

  try {
    const result = await pool.query(
      'SELECT name, email, phone, date, time FROM bookings WHERE date = $1',
      [currentDate]
    );

    for (const booking of result.rows) {
      const [hour, minute] = booking.time.split(':');
      const bookingTime = new Date(`${booking.date}T${hour}:${minute}:00`);

      const diff = bookingTime - now;
      if (diff > 0 && diff <= 30 * 60000) {
        const transporter = require('nodemailer').createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          }
        });

        const userReminder = {
          from: process.env.EMAIL_USER,
          to: booking.email,
          subject: '⏰ Reminder: Your meeting starts soon',
          text: `Hi ${booking.name}, this is a reminder that your meeting starts at ${booking.time} today.`
        };

        const adminReminder = {
          from: process.env.EMAIL_USER,
          to: '12201406@students.koi.edu.au',
          subject: '⏰ Reminder: Upcoming Meeting',
          text: `Reminder: ${booking.name} has a meeting today at ${booking.time}. Phone: ${booking.phone}`
        };

        await transporter.sendMail(userReminder);
        await transporter.sendMail(adminReminder);

        console.log(`📧 Reminder sent for ${booking.name} at ${booking.time}`);
      }
    }
  } catch (err) {
    console.error('❌ Failed to send reminders:', err.message);
  }
}

module.exports = {
  router,
  sendReminderEmails
};