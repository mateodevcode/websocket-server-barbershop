import { usuario_socket } from "./usuario_socket.js";

export const Socket = (io) => {
  usuario_socket(io);
};
