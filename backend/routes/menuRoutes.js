import express from "express";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";

import {
  addCategory,
  addExtra,
  addMenuItem,
  editCategory,
  editMenuItem,
  editExtra,
  listCategories,
  listExtras,
  listMenu,
  removeCategory,
  removeExtra,
  removeMenuItem
} from "../controllers/menuController.js";
import { authRequired } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, "../uploads"));
  },
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname);
    const safeName = path.basename(file.originalname, extension).replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
    cb(null, `${Date.now()}-${safeName}${extension}`);
  }
});

const upload = multer({ storage });

router.get("/", listMenu);
router.get("/categories", listCategories);
router.get("/extras", listExtras);

router.post("/categories", authRequired, allowRoles("admin"), addCategory);
router.put("/categories/:id", authRequired, allowRoles("admin"), editCategory);
router.delete("/categories/:id", authRequired, allowRoles("admin"), removeCategory);

router.post("/extras", authRequired, allowRoles("admin"), addExtra);
router.put("/extras/:id", authRequired, allowRoles("admin"), editExtra);
router.delete("/extras/:id", authRequired, allowRoles("admin"), removeExtra);

router.post("/", authRequired, allowRoles("admin"), upload.single("image"), addMenuItem);
router.put("/:id", authRequired, allowRoles("admin"), upload.single("image"), editMenuItem);
router.delete("/:id", authRequired, allowRoles("admin"), removeMenuItem);

export default router;
