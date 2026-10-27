export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
  };
};
export type PublicUser = {
  id: string;
  username: string;
  avatar: string;
  elo: number;
  stats: {
    wins: number;
    losses: number;
  };
};
export type AuthResponse = {
  user: PublicUser;
  token: string;
};
export type HealthResponse = {
  status: 'ok';
};
