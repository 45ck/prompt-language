// Bug: missing null check on token.

function verifyToken(token) {
  return token.length > 0 && token.startsWith('Bearer ');
}

module.exports = { verifyToken };
