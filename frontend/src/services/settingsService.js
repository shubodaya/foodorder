import api from "./api";

export async function getPublicSettings() {
  const { data } = await api.get("/settings/public");
  return data;
}

export async function updateCustomerPortalTheme(theme) {
  const { data } = await api.put("/settings/customer-theme", { theme });
  return data;
}
