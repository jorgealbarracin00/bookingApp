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

  const timeLabels = [];
  for (let h = 9; h < 21; h++) {
    timeLabels.push(`${h.toString().padStart(2, '0')}:00`);
    timeLabels.push(`${h.toString().padStart(2, '0')}:30`);
  }

  const weeklySlots = {};

  try {
    const result = await pool.query(
      `SELECT id, date, to_char(time::time, 'HH24:MI') AS time, booked
       FROM time_slots_v2
       WHERE date >= $1 AND date <= $2
       ORDER BY date, time`,
      [weekDays[0].date, weekDays[6].date]
    );

    for (const row of result.rows) {
      const slotDate = new Date(row.date).toISOString().split('T')[0];
      if (!weeklySlots[slotDate]) weeklySlots[slotDate] = [];
      weeklySlots[slotDate].push({
        id: row.id,
        time: row.time,
        available: !row.booked
      });
    }

    // 🧪 DEBUG weeklySlots:
    console.log('🧪 DEBUG weeklySlots:');
    for (const date in weeklySlots) {
      console.log(`📅 ${date}`);
      for (const slot of weeklySlots[date]) {
        console.log(`  ⏰ ${slot.time} → ${slot.available ? '✅' : '❌'}`);
      }
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
      'SELECT time FROM time_slots_v2 WHERE id = $1',
      [slot_id]
    );

    const time = timeResult.rows[0]?.time;

    if (!time) {
      console.error('❌ Invalid time slot selected');
      return res.status(400).send('❌ Invalid time slot selected.');
    }

    console.log('🔍 Fetching date for slot ID:', slot_id);
    const dateResult = await pool.query(
      'SELECT date FROM time_slots_v2 WHERE id = $1',
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
      'UPDATE time_slots_v2 SET booked = true WHERE id = $1',
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

    console.log(`📅 Booking confirmed for ${name} at ${date} ${time}`);
    res.redirect(`/?weekOffset=0&name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}&phone=${encodeURIComponent(phone)}&success=1`);

    try {
      await transporter.sendMail(userMailOptions);
      await transporter.sendMail(adminMailOptions);
      console.log('📧 Emails sent successfully');
    } catch (emailErr) {
      console.warn('⚠️ Email sending failed:', emailErr.message);
    }
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