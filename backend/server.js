import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import http from "http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { Server } from "socket.io";

import authRoutes from "./routes/authRoutes.js";
import menuRoutes from "./routes/menuRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import { notFoundHandler, errorHandler } from "./middleware/errorMiddleware.js";

dotenv.config();

const app = express();
const server = http.createServer(app);

const allowedOrigins = (process.env.CLIENT_URL || "").split(",").map((origin) => origin.trim()).filter(Boolean);

function parseOriginHost(origin) {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch (_error) {
    return "";
  }
}

function isPrivateNetworkHost(host) {
  if (!host) {
    return false;
  }

  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return true;
  }

  if (host.startsWith("10.") || host.startsWith("192.168.")) {
    return true;
  }

  const octets = host.split(".");
  if (octets.length === 4 && octets.every((part) => /^\d+$/.test(part))) {
    const first = Number(octets[0]);
    const second = Number(octets[1]);
    if (first === 172 && second >= 16 && second <= 31) {
      return true;
    }
  }

  return false;
}

function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  if (!allowedOrigins.length) {
    return true;
  }

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  return isPrivateNetworkHost(parseOriginHost(origin));
}

function resolveAssetDirectory() {
  const serverDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(serverDir, "asset"),
    path.join(serverDir, "../asset"),
    "/app/asset"
  ];

  for (const candidate of candidates) {
    try {
      if (candidate && candidate.length && path.isAbsolute(candidate)) {
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
    } catch (_error) {
      // Ignore and continue to next candidate.
    }
  }

  return null;
}

function corsOrigin(origin, callback) {
  callback(null, isAllowedOrigin(origin));
}

function setStaticContentType(res, filePath) {
  const lowerPath = String(filePath || "").toLowerCase();

  if (lowerPath.endsWith(".avif")) {
    res.setHeader("Content-Type", "image/avif");
    return;
  }

  if (lowerPath.endsWith(".jfif")) {
    res.setHeader("Content-Type", "image/jpeg");
  }
}

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    credentials: true
  }
});

io.on("connection", (socket) => {
  socket.on("kitchen:join", () => {
    socket.join("kitchen");
  });

  socket.on("admin:join", () => {
    socket.join("admin");
  });

  socket.on("order:watch", (orderId) => {
    if (!orderId) {
      return;
    }

    socket.join(`order_${orderId}`);
  });
});

app.set("io", io);

app.use(cors({
  origin: corsOrigin,
  credentials: true
}));
app.use(express.json());
app.use("/uploads", express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), "uploads"), { setHeaders: setStaticContentType }));
const assetDirectory = resolveAssetDirectory();
if (assetDirectory) {
  app.use("/asset", express.static(assetDirectory, { setHeaders: setStaticContentType }));
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/settings", settingsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = Number(process.env.PORT || 5000);
server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API running on port ${PORT}`);
});
