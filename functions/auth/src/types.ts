export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type TokenRequestBody = {
  audience?: string;
  claims?: Record<string, JsonValue>;
  expiresIn?: number | string;
  issuer?: string;
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
