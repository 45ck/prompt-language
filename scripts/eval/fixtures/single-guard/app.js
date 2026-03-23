/**
 * Validates an email address. Returns true if valid, false otherwise.
 */
function validateEmail(email) {
  if (typeof email !== 'string') return false;
  // Bug: regex doesn't allow dots in the local part (before @)
  const re = /^[a-zA-Z0-9_+-]+@[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/;
  return re.test(email);
}

module.exports = { validateEmail };
