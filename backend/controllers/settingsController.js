import {
  getCustomerPortalTheme,
  isAllowedCustomerTheme,
  setCustomerPortalTheme
} from "../models/settingsModel.js";

export async function getPublicSettings(_req, res, next) {
  try {
    const customerPortalTheme = await getCustomerPortalTheme();
    return res.json({ customerPortalTheme });
  } catch (error) {
    return next(error);
  }
}

export async function updateCustomerTheme(req, res, next) {
  try {
    const theme = String(req.body?.theme || "").trim().toLowerCase();

    if (!isAllowedCustomerTheme(theme)) {
      return res.status(400).json({ message: "Theme must be 'dark' or 'light'" });
    }

    const updated = await setCustomerPortalTheme(theme);

    const io = req.app.get("io");
    io.emit("settings:customerTheme", { theme: updated.customerPortalTheme });

    return res.json({
      customerPortalTheme: updated.customerPortalTheme,
      updatedAt: updated.updatedAt
    });
  } catch (error) {
    return next(error);
  }
}
