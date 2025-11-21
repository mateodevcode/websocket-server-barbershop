import { cliente_socket } from "./cliente_socket.js";
import { usuario_socket } from "./usuario_socket.js";

export const Socket = (io) => {
  usuario_socket(io);
  cliente_socket(io);
};
