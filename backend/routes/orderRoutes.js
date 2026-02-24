import express from "express";

import {
  createNewOrder,
  generateEndOfDayReport,
  getOrderStatus,
  listPublicOrders,
  listOrders,
  updateStatus
} from "../controllers/orderController.js";
import { authRequired } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.post("/", createNewOrder);
router.get("/public", listPublicOrders);
router.get("/", authRequired, allowRoles("admin", "kitchen"), listOrders);
router.get("/end-of-day/report", authRequired, allowRoles("admin", "kitchen"), generateEndOfDayReport);
router.get("/:id", getOrderStatus);
router.put("/:id/status", authRequired, allowRoles("admin", "kitchen"), updateStatus);

export default router;
