const pool = require('../db'); // adjust the path if needed

const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  const selectedDate = req.query.date;
  let timeSlots = [];

  if (selectedDate) {
    try {
      const result = await pool.query(
      'SELECT id, time FROM available_time_slots WHERE date = $1 AND (booked = false OR booked IS NULL) ORDER BY time',        [selectedDate]
      );
      timeSlots = result.rows;
    } catch (err) {
      console.error('Error fetching slots:', err);
    }
  }

  res.render('index', { timeSlots, selectedDate });
});

router.post('/book', async (req, res) => {
  const { name, email, phone, date, slot_id } = req.body;

  try {
    // Lookup the time for the selected slot
    const timeResult = await pool.query(
      'SELECT time FROM available_time_slots WHERE id = $1',
      [slot_id]
    );

    const time = timeResult.rows[0]?.time;

    if (!time) {
      return res.status(400).send('❌ Invalid time slot selected.');
    }

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

    // 3. Send confirmation emails
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
    res.send('✅ Booking confirmed!');
  } catch (error) {
    console.error('❌ Booking error:', error.message);
    res.status(500).send('❌ Failed to book time slot');
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

module.exports = { router, sendReminderEmails };