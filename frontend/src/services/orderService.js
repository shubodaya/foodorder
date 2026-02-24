import api from "./api";

export async function placeOrder(payload) {
  const { data } = await api.post("/orders", payload);
  return data;
}

export async function getOrder(orderId) {
  const { data } = await api.get(`/orders/${orderId}`);
  return data;
}

export async function getAllOrders(cafeSlug) {
  const { data } = await api.get("/orders", {
    params: cafeSlug ? { cafeSlug } : undefined
  });
  return data;
}

export async function getPublicOrders(cafeSlug) {
  const { data } = await api.get("/orders/public", {
    params: cafeSlug ? { cafeSlug } : undefined
  });
  return data;
}

export async function setOrderStatus(orderId, status, options = {}) {
  const requestConfig = options?.token
    ? {
      headers: {
        Authorization: `Bearer ${options.token}`
      }
    }
    : undefined;

  const { data } = await api.put(`/orders/${orderId}/status`, { status }, requestConfig);
  return data;
}

export async function getEndOfDayReport(params) {
  const { data } = await api.get("/orders/end-of-day/report", {
    params
  });
  return data;
}
