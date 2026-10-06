
import "server-only";

import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";

import db from "@/lib/db";

export const SESSION_COOKIE = "atg_session";

const SESSION_DAYS = 7;

function hashToken(token) {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

// Create a random session for a successfully authenticated user.
export async function createSession(userId) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);

  const expiresAt = new Date(
    Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  );

  await db.query(
    `
    INSERT INTO user_sessions (
      user_id,
      token_hash,
      expires_at
    )
    VALUES (?, ?, ?)
    `,
    [userId, tokenHash, expiresAt]
  );

  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

// Resolve the signed-in user from the session cookie.
// Returns null if the session is missing, expired,
// revoked, or belongs to a deactivated account.
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return null;
  }

  const tokenHash = hashToken(token);

  const [users] = await db.query(
    `
    SELECT
      u.user_id,
      u.first_name,
      u.last_name,
      u.email

    FROM user_sessions s

    JOIN users u
      ON u.user_id = s.user_id

    WHERE s.token_hash = ?
      AND s.expires_at > NOW()
      AND u.is_active = TRUE

    LIMIT 1
    `,
    [tokenHash]
  );

  if (users.length === 0) return null;

  const user = users[0];

  const [roleRows] = await db.query(
    `
    SELECT UPPER(r.role_name) AS role_name
    FROM user_roles ur
    JOIN roles r
      ON r.role_id = ur.role_id
    WHERE ur.user_id = ?
    `,
    [user.user_id]
  );

  return {
    ...user,
    roles: roleRows.map((row) => row.role_name),
  };
}

// Use this helper in protected API routes.
// It NEVER falls back to auth.user.user_id.
export async function requireUser(requiredRole = null) {
  const user = await getCurrentUser();

  if (!user) {
    return {
      user: null,
      error: "Authentication required.",
      status: 401,
    };
  }

  if (
    requiredRole &&
    !user.roles.includes(requiredRole.toUpperCase())
  ) {
    return {
      user: null,
      error: "You do not have permission to perform this action.",
      status: 403,
    };
  }

  return {
    user,
    error: null,
    status: 200,
  };
}

// Revoke the current session during logout.
export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token && /^[a-f0-9]{64}$/.test(token)) {
    await db.query(
      `
      DELETE FROM user_sessions
      WHERE token_hash = ?
      `,
      [hashToken(token)]
    );
  }

  cookieStore.delete(SESSION_COOKIE);
}
