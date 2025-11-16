import Usuario from "../models/usuario.js";

export const usuario_socket = (io) => {
  // Evento cuando un cliente se conecta
  io.on("connection", (socket) => {
    console.log("Cliente conectado:", socket.id);

    // Enviar todos los usuarios al cliente que se conecta
    socket.on("client:getusuarios", async () => {
      const usuarios = await Usuario.find();
      socket.emit("server:usuarios", usuarios); // Solo a ese cliente
    });

    // Crear un nuevo usuario
    socket.on("client:crear_usuario", async (data) => {
      const nuevoUsuario = new User(data);
      await nuevoUsuario.save(); // Guardar el usuario en la base de datos
      const usuarios = await Usuario.find(); // Obtener todos los usuarios
      io.emit("server:usuarios", usuarios); // Emitir a todos
    });

    // Eliminar un usuario
    socket.on("client:eliminar_usuario", async (id) => {
      await Usuario.findByIdAndDelete(id);
      const usuarios = await Usuario.find(); // Obtener todos los usuarios actualizados
      io.emit("server:usuarios", usuarios); // Emitir a todos
    });

    // Actualizar un usuario
    socket.on("client:actualizar_usuario", async (id, data) => {
      const usuario = await Usuario.findByIdAndUpdate(id, data, {
        new: true,
      });
      if (!usuario) {
        return socket.emit("server:error", "Usuario no encontrado");
      }
      io.emit("server:actualizar_usuario", usuario); // Emitir a todos los clientes conectados
      const usuarios = await Usuario.find(); // Obtener todos los usuarios actualizados
      io.emit("server:usuarios", usuarios); // Emitir a todos
    });

    socket.on("disconnect", () => {
      console.log("Cliente desconectado:", socket.id);
    });
  });
};
