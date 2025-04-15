const express = require('express');
const router = express.Router();
const pool = require('../db'); // assuming db.js is in the root
const admin = require('firebase-admin');
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function verifyFirebaseToken(req, res, next) {
  const idToken = req.headers.authorization?.split('Bearer ')[1];

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

router.get('/admin', verifyFirebaseToken, (req, res) => {
  res.render('admin');
});

router.post('/admin/save', verifyFirebaseToken, async (req, res) => {
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