// Mailer module — reads SMTP_HOST, SMTP_PORT, MAIL_FROM from env
const smtpHost = process.env.SMTP_HOST || 'localhost';
const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
const mailFrom = process.env.MAIL_FROM || 'noreply@example.com';

function sendMail(to, subject, body) {
  console.log(`Sending mail via ${smtpHost}:${smtpPort} from ${mailFrom} to ${to}`);
  return {
    sent: true,
    from: mailFrom,
    to,
    subject,
    server: `${smtpHost}:${smtpPort}`,
  };
}

module.exports = { sendMail };
