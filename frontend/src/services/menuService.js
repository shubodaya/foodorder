import api from "./api";

export async function fetchMenu(cafeSlug) {
  const { data } = await api.get("/menu", {
    params: cafeSlug ? { cafeSlug } : undefined
  });
  return data;
}

export async function fetchCategories() {
  const { data } = await api.get("/menu/categories");
  return data;
}

export async function createCategory(payload) {
  const { data } = await api.post("/menu/categories", payload);
  return data;
}

export async function updateCategory(id, payload) {
  const { data } = await api.put(`/menu/categories/${id}`, payload);
  return data;
}

export async function deleteCategory(id) {
  await api.delete(`/menu/categories/${id}`);
}

export async function fetchExtras() {
  const { data } = await api.get("/menu/extras");
  return data;
}

export async function createExtra(payload) {
  const { data } = await api.post("/menu/extras", payload);
  return data;
}

export async function updateExtra(id, payload) {
  const { data } = await api.put(`/menu/extras/${id}`, payload);
  return data;
}

export async function deleteExtra(id) {
  await api.delete(`/menu/extras/${id}`);
}

export async function createMenuItem(formData) {
  const { data } = await api.post("/menu", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });
  return data;
}

export async function updateMenuItem(id, formData) {
  const { data } = await api.put(`/menu/${id}`, formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });
  return data;
}

export async function deleteMenuItem(id) {
  await api.delete(`/menu/${id}`);
}
