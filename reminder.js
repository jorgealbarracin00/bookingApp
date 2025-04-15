require('dotenv').config();
const { sendReminderEmails } = require('./routes/bookings');

(async () => {
  console.log('⏰ Running reminder email check...');
  await sendReminderEmails();
  console.log('✅ Done sending reminders.');
  process.exit();
})();