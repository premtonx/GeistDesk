export {};

declare global {
  namespace Express {
    interface UserContext {
      id: string;
      name: string;
      email: string;
      role: string;
      is_admin: boolean;
      /** Session-bound tenant — derived from DB user record, never from client params. */
      tenantId: string;
      dbRecord?: Record<string, unknown>;
    }

    interface Request {
      user?: UserContext;
    }
  }
}
