import axios from "axios";
import { getApiBaseUrl } from "./runtimeConfig";

const api = axios.create({
  baseURL: getApiBaseUrl()
});

api.interceptors.request.use((config) => {
  try {
    const auth = JSON.parse(localStorage.getItem("rays_auth") || "{}");
    if (!config.headers) {
      config.headers = {};
    }

    if (!config.headers.Authorization && auth.token) {
      config.headers.Authorization = `Bearer ${auth.token}`;
    }
  } catch (_error) {
    // ignore malformed localStorage state
  }

  return config;
});

export default api;
