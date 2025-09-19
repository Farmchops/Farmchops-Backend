
// utils/session.ts
import { Request } from 'express';
import { Session } from 'express-session';

export function ensureSession(req: Request): asserts req is Request & { session: Session } {
  if (!req.session) {
    throw new Error('Session is not available');
  }
}