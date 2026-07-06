export {};

declare global {
  namespace Express {
    interface UserContext {
      id: string;
      name: string;
      email: string;
      role: string;
      is_admin: boolean;
      dbRecord?: Record<string, unknown>;
    }

    interface Request {
      user?: UserContext;
    }
  }
}
