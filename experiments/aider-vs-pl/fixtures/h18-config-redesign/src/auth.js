// Auth module — reads JWT_SECRET and TOKEN_EXPIRY from env
const jwtSecret = process.env.JWT_SECRET || 'dev-secret-key';
const tokenExpiry = process.env.TOKEN_EXPIRY || '24h';
const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);

function createToken(payload) {
  // Simplified token creation (no real JWT)
  const data = JSON.stringify({ ...payload, exp: tokenExpiry });
  const token = Buffer.from(data).toString('base64');
  return token;
}

function verifyToken(token) {
  try {
    const data = JSON.parse(Buffer.from(token, 'base64').toString());
    return { valid: true, payload: data };
  } catch {
    return { valid: false, payload: null };
  }
}

function getSecret() {
  return jwtSecret;
}

module.exports = { createToken, verifyToken, getSecret };
