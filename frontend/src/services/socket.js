import { io } from "socket.io-client";
import { getSocketBaseUrl } from "./runtimeConfig";

let socket;

export function getSocket() {
  if (!socket) {
    socket = io(getSocketBaseUrl(), {
      transports: ["websocket", "polling"]
    });
  }

  return socket;
}
