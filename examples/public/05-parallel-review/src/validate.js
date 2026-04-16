// Bug: weak email regex accepts "a@b".

function isValidEmail(email) {
  return /^.+@.+$/.test(email);
}

module.exports = { isValidEmail };
