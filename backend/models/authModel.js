import pool from "../config/db.js";

export async function findUserByEmail(email) {
  const { rows } = await pool.query("SELECT id, name, email, password, role FROM users WHERE email = $1", [email]);
  return rows[0] || null;
}

export async function findUserById(id) {
  const { rows } = await pool.query("SELECT id, name, email, password, role FROM users WHERE id = $1", [id]);
  return rows[0] || null;
}

export async function listUsers() {
  const { rows } = await pool.query(
    `SELECT id, name, email, role
     FROM users
     WHERE role IN ('admin', 'kitchen')
     ORDER BY role ASC, name ASC, email ASC`
  );

  return rows;
}

export async function createUser({ name, email, passwordHash, role }) {
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role`,
    [name, email, passwordHash, role]
  );

  return rows[0] || null;
}

export async function updateUserById(id, {
  name,
  email,
  role,
  passwordHash
}) {
  const hasPassword = Boolean(passwordHash);
  const { rows } = await pool.query(
    `UPDATE users
     SET
       name = COALESCE($2, name),
       email = COALESCE($3, email),
       role = COALESCE($4, role),
       password = CASE WHEN $5::boolean THEN $6 ELSE password END
     WHERE id = $1
     RETURNING id, name, email, role`,
    [id, name, email, role, hasPassword, hasPassword ? passwordHash : null]
  );

  return rows[0] || null;
}

export async function deleteUserById(id) {
  const { rows } = await pool.query(
    `DELETE FROM users
     WHERE id = $1
     RETURNING id, name, email, role`,
    [id]
  );

  return rows[0] || null;
}

export async function countUsersByRole(role) {
  const { rows } = await pool.query(
    "SELECT COUNT(*)::int AS count FROM users WHERE role = $1",
    [role]
  );

  return rows[0]?.count || 0;
}
