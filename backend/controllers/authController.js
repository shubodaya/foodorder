import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import {
  countUsersByRole,
  createUser,
  deleteUserById,
  findUserByEmail,
  findUserById,
  listUsers,
  updateUserById
} from "../models/authModel.js";

const ALLOWED_MANAGED_ROLES = new Set(["admin", "kitchen"]);

function normalizeRole(role) {
  const normalized = String(role || "").trim().toLowerCase();
  return ALLOWED_MANAGED_ROLES.has(normalized) ? normalized : null;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export async function login(req, res, next) {
  try {
    const email = normalizeEmail(req.body?.email);
    const { password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        role: user.role,
        email: user.email
      },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    return next(error);
  }
}

export async function getUsers(_req, res, next) {
  try {
    const users = await listUsers();
    return res.json(users);
  } catch (error) {
    return next(error);
  }
}

export async function addUser(req, res, next) {
  try {
    const name = String(req.body?.name || "").trim();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const role = normalizeRole(req.body?.role);

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "Name, email, password, and role are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ message: "Email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const created = await createUser({
      name,
      email,
      passwordHash,
      role
    });

    return res.status(201).json(created);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Email already exists" });
    }

    return next(error);
  }
}

export async function editUser(req, res, next) {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const existing = await findUserById(userId);
    if (!existing) {
      return res.status(404).json({ message: "User not found" });
    }

    const nameProvided = Object.prototype.hasOwnProperty.call(req.body, "name");
    const emailProvided = Object.prototype.hasOwnProperty.call(req.body, "email");
    const roleProvided = Object.prototype.hasOwnProperty.call(req.body, "role");
    const passwordProvided = Object.prototype.hasOwnProperty.call(req.body, "password");

    const name = nameProvided ? String(req.body?.name || "").trim() : undefined;
    const email = emailProvided ? normalizeEmail(req.body?.email) : undefined;
    const role = roleProvided ? normalizeRole(req.body?.role) : undefined;
    const password = passwordProvided ? String(req.body?.password || "") : "";

    if (nameProvided && !name) {
      return res.status(400).json({ message: "Name cannot be empty" });
    }

    if (emailProvided && !email) {
      return res.status(400).json({ message: "Email cannot be empty" });
    }

    if (roleProvided && !role) {
      return res.status(400).json({ message: "Role must be admin or kitchen" });
    }

    if (passwordProvided && password && password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    if (emailProvided && email !== existing.email) {
      const alreadyUsed = await findUserByEmail(email);
      if (alreadyUsed && alreadyUsed.id !== existing.id) {
        return res.status(409).json({ message: "Email already exists" });
      }
    }

    if (existing.role === "admin" && roleProvided && role !== "admin") {
      const adminCount = await countUsersByRole("admin");
      if (adminCount <= 1) {
        return res.status(400).json({ message: "At least one admin account is required" });
      }
    }

    const updated = await updateUserById(userId, {
      name: nameProvided ? name : undefined,
      email: emailProvided ? email : undefined,
      role: roleProvided ? role : undefined,
      passwordHash: password ? await bcrypt.hash(password, 10) : null
    });

    return res.json(updated);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Email already exists" });
    }

    return next(error);
  }
}

export async function removeUser(req, res, next) {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    if (req.user?.id === userId) {
      return res.status(400).json({ message: "You cannot delete your own account" });
    }

    const existing = await findUserById(userId);
    if (!existing) {
      return res.status(404).json({ message: "User not found" });
    }

    if (existing.role === "admin") {
      const adminCount = await countUsersByRole("admin");
      if (adminCount <= 1) {
        return res.status(400).json({ message: "At least one admin account is required" });
      }
    }

    await deleteUserById(userId);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}
