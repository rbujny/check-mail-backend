import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export const getDashboardCredentials = (): { username: string; password: string } => {
  const username = process.env.DASHBOARD_USERNAME || "admin";
  const password = process.env.DASHBOARD_PASSWORD || "admin123";
  return { username, password };
};

export const safeCompare = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
};

export const computeSessionToken = (username: string, password: string): string => {
  return createHmac("sha256", password).update(`checkmail_admin_session:${username}`).digest("hex");
};

const setSessionCookie = (res: Response, sessionToken: string): void => {
  const isProd = process.env.NODE_ENV === "production" || Boolean(process.env.K_SERVICE);
  const secureFlag = isProd ? "; Secure" : "";
  const cookieVal = `dashboard_session=${encodeURIComponent(sessionToken)}; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax${secureFlag}`;
  res.setHeader("Set-Cookie", cookieVal);
};

type RateLimitRecord = {
  count: number;
  resetTime: number;
};

const ipRateLimits = new Map<string, RateLimitRecord>();

export const checkRateLimit = (ip: string, limit = 60, windowMs = 60000): boolean => {
  const now = Date.now();
  const record = ipRateLimits.get(ip);
  if (!record || now > record.resetTime) {
    ipRateLimits.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }
  record.count += 1;
  return record.count <= limit;
};

export const clearRateLimits = (): void => {
  ipRateLimits.clear();
};

export const dashboardAuthMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const clientIp =
    (typeof req.header("x-forwarded-for") === "string"
      ? req.header("x-forwarded-for")?.split(",")[0].trim()
      : undefined) ||
    req.ip ||
    "unknown";

  if (!checkRateLimit(clientIp, 60, 60000)) {
    res.setHeader("Retry-After", "60");
    res.status(429).json({
      error: "Too many requests. Rate limit exceeded. Please wait 60 seconds.",
    });
    return;
  }

  const { username: expectedUser, password: expectedPass } = getDashboardCredentials();
  const expectedSessionToken = computeSessionToken(expectedUser, expectedPass);

  // 1. Check existing opaque session cookie
  const cookieHeader = req.header("cookie") || "";
  const cookieMatch = cookieHeader.match(/(?:^|;\s*)dashboard_session=([^;]+)/u);
  if (cookieMatch) {
    const candidateSession = decodeURIComponent(cookieMatch[1]);
    if (safeCompare(candidateSession, expectedSessionToken)) {
      next();
      return;
    }
  }

  // 2. Check query parameter ?key=... or header x-dashboard-key
  const queryKey = typeof req.query.key === "string" ? req.query.key : undefined;
  const headerKey = req.header("x-dashboard-key");
  const candidateKey = queryKey || headerKey;

  if (candidateKey && safeCompare(candidateKey, expectedPass)) {
    setSessionCookie(res, expectedSessionToken);
    next();
    return;
  }

  // 3. Check HTTP Basic Authentication
  const authHeader = req.header("authorization");
  if (authHeader && authHeader.startsWith("Basic ")) {
    try {
      const base64Credentials = authHeader.slice(6).trim();
      const decoded = Buffer.from(base64Credentials, "base64").toString("utf-8");
      const colonIndex = decoded.indexOf(":");
      if (colonIndex !== -1) {
        const user = decoded.substring(0, colonIndex);
        const pass = decoded.substring(colonIndex + 1);
        if (safeCompare(user, expectedUser) && safeCompare(pass, expectedPass)) {
          setSessionCookie(res, expectedSessionToken);
          next();
          return;
        }
      }
    } catch {
      // Invalid base64, fall through to 401
    }
  }

  // 4. Challenge with HTTP Basic Auth
  res.setHeader("WWW-Authenticate", 'Basic realm="CheckMail Admin Dashboard", charset="UTF-8"');
  if (req.path.startsWith("/api/")) {
    res.status(401).json({
      error: "Authentication required for admin dashboard.",
    });
    return;
  }

  res.status(401).send(
    `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>401 Unauthorized - CheckMail Admin</title>
      <style>
        body { background: #09090b; color: #f4f4f5; font-family: monospace; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .box { text-align: center; padding: 2rem; background: #121215; border-radius: 4px; border: 1px solid #27272a; max-width: 420px; }
        h1 { color: #dc2626; font-size: 1rem; margin-bottom: 0.5rem; letter-spacing: 0.05em; }
        p { color: #a1a1aa; font-size: 0.8rem; margin-bottom: 1.5rem; line-height: 1.4; }
      </style>
    </head>
    <body>
      <div class="box">
        <h1>[401 UNAUTHORIZED]</h1>
        <p>This console is restricted to authorized administrators. Provide valid credentials in the browser prompt or pass ?key=&lt;token&gt;.</p>
      </div>
    </body>
    </html>`
  );
};
