import { SignJWT, jwtVerify } from "jose";

import { jsonError } from "./utils";

export async function signAuthToken(user, secret) {
  return new SignJWT({
    id: user.id,
    name: user.name,
    role: user.role,
    email: user.email
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(new TextEncoder().encode(secret));
}

export async function verifyAuthToken(token, secret) {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
    algorithms: ["HS256"]
  });
  return payload;
}

export async function authRequired(c, next) {
  const header = c.req.header("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return jsonError(c, 401, "Authentication token missing");
  }

  try {
    const payload = await verifyAuthToken(token, c.env.JWT_SECRET);
    c.set("user", payload);
    await next();
    return undefined;
  } catch (_error) {
    return jsonError(c, 401, "Invalid or expired token");
  }
}

export function allowRoles(...roles) {
  return async (c, next) => {
    const user = c.get("user");
    if (!user || !roles.includes(user.role)) {
      return jsonError(c, 403, "Forbidden");
    }

    await next();
    return undefined;
  };
}
