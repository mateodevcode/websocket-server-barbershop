import Usuario from "../models/usuario.js";
export const usuario_socket = (io) => {
  // Evento cuando un cliente se conecta
  io.on("connection", (socket) => {
    console.log("Cliente conectado:", socket.id);
    // Enviar todos los usuarios al cliente que se conecta
    socket.on("client:getusuarios", async () => {
      try {
        const usuarios = await Usuario.find();
        socket.emit("server:usuarios", usuarios);
      } catch (error) {
        console.error("❌ Error al obtener usuarios:", error);
        socket.emit("server:error", { message: "Error al obtener usuarios" });
      }
    });
    // Crear un nuevo usuario
    socket.on("client:crear_usuario", async (data) => {
      try {
        const nuevoUsuario = new Usuario(data);
        await nuevoUsuario.save();
        const usuarios = await Usuario.find();
        io.emit("server:usuarios", usuarios);
        console.log("✅ Usuario creado:", nuevoUsuario._id);
      } catch (error) {
        console.error("❌ Error al crear usuario:", error);
        socket.emit("server:error", { message: "Error al crear usuario" });
      }
    });
    // Eliminar un usuario
    socket.on("client:eliminar_usuario", async (id) => {
      try {
        await Usuario.findByIdAndDelete(id);
        const usuarios = await Usuario.find();
        io.emit("server:usuarios", usuarios);
        console.log("✅ Usuario eliminado:", id);
      } catch (error) {
        console.error("❌ Error al eliminar usuario:", error);
        socket.emit("server:error", { message: "Error al eliminar usuario" });
      }
    });
    // Actualizar un usuario
    socket.on("client:actualizar_usuario", async (id, data) => {
      try {
        const usuario = await Usuario.findByIdAndUpdate(id, data, {
          new: true,
          runValidators: true,
        });
        if (!usuario) {
          socket.emit("server:error", { message: "Usuario no encontrado" });
          return;
        }
        io.emit("server:actualizar_usuario", usuario);
        io.emit("server:usuario_actualizado", usuario);
        const usuarios = await Usuario.find();
        io.emit("server:usuarios", usuarios);
        console.log("✅ Usuario actualizado:", id);
      } catch (error) {
        console.error("❌ Error al actualizar usuario:", error);
        socket.emit("server:error", { message: "Error al actualizar usuario" });
      }
    });
    // Actualizar línea de crédito del usuario (para administradores)
    socket.on("client:actualizar_linea_credito", async (datos) => {
      try {
        const { usuario_id, linea_credito_total } = datos;
        if (!usuario_id || !linea_credito_total) {
          socket.emit("server:error", {
            message: "Datos incompletos para actualizar línea de crédito",
          });
          return;
        }
        const usuario = await Usuario.findByIdAndUpdate(
          usuario_id,
          { linea_credito_total },
          { new: true, runValidators: true }
        );
        if (!usuario) {
          socket.emit("server:error", { message: "Usuario no encontrado" });
          return;
        }
        io.emit("server:usuario_actualizado", usuario);
        const usuarios = await Usuario.find();
        io.emit("server:usuarios", usuarios);
        console.log("✅ Línea de crédito actualizada:", {
          usuario: usuario.name,
          nueva_linea: linea_credito_total,
        });
      } catch (error) {
        console.error("❌ Error al actualizar línea de crédito:", error);
        socket.emit("server:error", {
          message: "Error al actualizar línea de crédito",
        });
      }
    });
    // Agregar cliente a la lista del usuario
    socket.on("client:agregar_cliente_a_usuario", async (id, data) => {
      try {
        const usuario = await Usuario.findById(id);
        if (!usuario) {
          socket.emit("server:error", { message: "Usuario no encontrado" });
          return;
        }
        const lista_clientes = [...usuario.listaClientes];
        lista_clientes.push(data);
        const usuarioUpdate = await Usuario.findByIdAndUpdate(
          id,
          { listaClientes: lista_clientes },
          { new: true }
        );
        io.emit("server:agregar_cliente_a_usuario", usuarioUpdate);
        const usuarios = await Usuario.find();
        io.emit("server:usuarios", usuarios);
        console.log("✅ Cliente agregado a usuario:", id);
      } catch (error) {
        console.error("❌ Error al agregar cliente a usuario:", error);
        socket.emit("server:error", {
          message: "Error al agregar cliente a usuario",
        });
      }
    });
    socket.on("disconnect", () => {
      console.log("Cliente desconectado:", socket.id);
    });
  });
};
