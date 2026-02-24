import api from "./api";

export async function login(credentials) {
  const { data } = await api.post("/auth/login", credentials);
  return data;
}

export async function getUsers() {
  const { data } = await api.get("/auth/users");
  return data;
}

export async function createUser(payload) {
  const { data } = await api.post("/auth/users", payload);
  return data;
}

export async function updateUser(userId, payload) {
  const { data } = await api.put(`/auth/users/${userId}`, payload);
  return data;
}

export async function deleteUser(userId) {
  await api.delete(`/auth/users/${userId}`);
}
