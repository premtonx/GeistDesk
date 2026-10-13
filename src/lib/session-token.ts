import jwt from 'jsonwebtoken';

const SESSION_TTL = '12h';

/** Issue a locally signed HS256 session JWT for cookie-based auth. */
export function issueSessionToken(user: { id: string; email: string }): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is required to issue a session token.');
  }
  return jwt.sign({ uid: user.id, id: user.id, email: user.email }, secret, {
    algorithm: 'HS256',
    expiresIn: SESSION_TTL,
  });
}
