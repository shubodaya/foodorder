import express from "express";
import {
  addUser,
  editUser,
  getUsers,
  login,
  removeUser
} from "../controllers/authController.js";
import { authRequired } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.post("/login", login);
router.get("/users", authRequired, allowRoles("admin"), getUsers);
router.post("/users", authRequired, allowRoles("admin"), addUser);
router.put("/users/:id", authRequired, allowRoles("admin"), editUser);
router.delete("/users/:id", authRequired, allowRoles("admin"), removeUser);

export default router;
