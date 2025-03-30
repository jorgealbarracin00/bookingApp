const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('index'); // render the booking form
});

router.post('/book', (req, res) => {
  const { name, email, phone, date, time } = req.body;

  console.log(`📅 Booking received: ${name}, ${email}, ${phone}, ${date}, ${time}`);
  res.send('✅ Booking confirmed!');
});

module.exports = router;