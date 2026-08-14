export type TokenRequestBody = {
  expiresIn?: number | string;
  subject?: string;
};

export type AuthSuccessResponse = {
  audience: string;
  expiresAt: number;
  issuedAt: number;
  issuer: string;
  subject: string;
  token: string;
  tokenType: "Bearer";
};

export type AuthErrorResponse = {
  error: string;
};
