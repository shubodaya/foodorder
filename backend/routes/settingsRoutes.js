import express from "express";

import { getPublicSettings, updateCustomerTheme } from "../controllers/settingsController.js";
import { authRequired } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/public", getPublicSettings);
router.put("/customer-theme", authRequired, allowRoles("admin"), updateCustomerTheme);

export default router;
