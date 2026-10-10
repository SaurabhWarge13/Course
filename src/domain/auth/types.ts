export type User = {
  id: string;
  email: string;
  name: string;
};

export type Session = {
  userId: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
};

export type SessionStamp = {
  userId: string;
  epoch: number;
};
