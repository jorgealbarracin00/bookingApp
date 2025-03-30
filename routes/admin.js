const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const slotsFile = path.join(__dirname, '..', 'slots.json');

router.get('/admin', (req, res) => {
  res.render('admin');
});

router.post('/admin/save', (req, res) => {
  const { date, times } = req.body;

  const timeArray = times.split(',').map(t => t.trim());

  fs.readFile(slotsFile, 'utf-8', (err, data) => {
    const json = data ? JSON.parse(data) : {};
    json[date] = timeArray;

    fs.writeFile(slotsFile, JSON.stringify(json, null, 2), err => {
      if (err) return res.send('Error saving slots');
      res.send('✅ Slots saved!');
    });
  });
});

module.exports = router;