import Cliente from "../models/cliente.js";
import Usuario from "../models/usuario.js";
import Ruta from "../models/ruta.js";
// Socket handler para clientes
export const cliente_socket = (io) => {
  // Evento cuando un cliente se conecta
  io.on("connection", (socket) => {
    console.log("Cliente conectado:", socket.id);
    // Enviar todos los clientes al cliente que se conecta
    socket.on("client:getclientes", async () => {
      const clientes = await Cliente.find();
      socket.emit("server:clientes", clientes);
    });
    // Crear cliente y agregar cliente a usuario
    socket.on("client:crear_cliente", async (data) => {
      try {
        // 1. Crear el cliente
        const nuevoCliente = await Cliente.create(data);
        // 2. Agregar el cliente a la lista del usuario
        if (data.cobrador) {
          const usuario = await Usuario.findById(data.cobrador);
          if (usuario) {
            const lista_clientes = [...usuario.listaClientes, nuevoCliente._id];
            await Usuario.findByIdAndUpdate(
              data.cobrador,
              { listaClientes: lista_clientes },
              { new: true }
            );
            console.log(
              `✅ Cliente ${nuevoCliente._id} agregado al usuario ${data.cobrador}`
            );
          }
        }
        // 3. Emitir actualizaciones
        const clientes = await Cliente.find();
        io.emit("server:clientes", clientes);
        const usuarios = await Usuario.find();
        io.emit("server:usuarios", usuarios);
      } catch (error) {
        console.error("🚨 Error al crear cliente:", error);
        socket.emit("server:error", "Error al crear el cliente");
      }
    });
    // Eliminar un cliente
    socket.on("client:eliminar_cliente", async (clienteId) => {
      try {
        // 1. Buscar el cliente antes de eliminarlo para obtener el cobradorId
        const cliente = await Cliente.findById(clienteId);
        if (!cliente) {
          console.warn(`⚠️ Cliente ${clienteId} no encontrado`);
          socket.emit("server:error", "Cliente no encontrado");
          return;
        }
        const cobradorId = cliente.cobrador;
        // 2. Eliminar el cliente de la base de datos
        await Cliente.findByIdAndDelete(clienteId);
        console.log(`✅ Cliente ${clienteId} eliminado de la BD`);
        // 3. Remover el clienteId de la lista del usuario (cobrador)
        if (cobradorId) {
          const usuario = await Usuario.findById(cobradorId);
          if (usuario) {
            // Filtrar el clienteId de la lista
            const listaActualizada = usuario.listaClientes.filter(
              (id) => id.toString() !== clienteId.toString()
            );
            // Actualizar el usuario
            await Usuario.findByIdAndUpdate(
              cobradorId,
              { listaClientes: listaActualizada },
              { new: true }
            );
            console.log(
              `✅ Cliente ${clienteId} removido de la lista del usuario ${cobradorId}`
            );
          } else {
            console.warn(`⚠️ Usuario ${cobradorId} no encontrado`);
          }
        }
        // 4. Remover cliente de rutas si está asignado
        if (cliente.ruta) {
          const ruta = await Ruta.findById(cliente.ruta);
          if (ruta) {
            ruta.clientes = ruta.clientes.filter(
              (c) => c.cliente_id.toString() !== clienteId.toString()
            );
            await ruta.save();
            console.log(`✅ Cliente removido de la ruta ${cliente.ruta}`);
          }
        }
        // 5. Emitir listas actualizadas a todos los clientes conectados
        const clientes = await Cliente.find();
        io.emit("server:clientes", clientes);
        const usuarios = await Usuario.find();
        io.emit("server:usuarios", usuarios);
        console.log(`🎉 Cliente eliminado completamente`);
      } catch (error) {
        console.error("🚨 Error al eliminar cliente:", error);
        socket.emit("server:error", "Error al eliminar el cliente");
      }
    });
    // Actualizar un cliente
    socket.on(
      "client:actualizar_cliente",
      async (clienteId, datosActualizados) => {
        try {
          const clienteActualizado = await Cliente.findByIdAndUpdate(
            clienteId,
            { $set: datosActualizados },
            { new: true, runValidators: true }
          );
          // Emitir a todos los clientes conectados
          io.emit("server:cliente_actualizado", clienteActualizado);
          // Emitir lista actualizada
          const clientes = await Cliente.find();
          io.emit("server:clientes", clientes);
          console.log(`✅ Cliente ${clienteId} actualizado`);
        } catch (error) {
          console.error("🚨 Error al actualizar cliente:", error);
          socket.emit("server:error", {
            message: "Error al actualizar cliente",
          });
        }
      }
    );

    // Actualizar orden global de clientes (Ruta Simple)
    socket.on("client:actualizar_orden_global", async (clientesOrdenados) => {
      try {
        // clientesOrdenados es un array de { id: "...", orden: 1 }
        const promesas = clientesOrdenados.map((item) =>
          Cliente.findByIdAndUpdate(item.id, { orden_en_ruta: item.orden })
        );

        await Promise.all(promesas);

        // Emitir lista actualizada
        const clientes = await Cliente.find();
        io.emit("server:clientes", clientes);
        console.log("✅ Orden global actualizado");
      } catch (error) {
        console.error("🚨 Error al actualizar orden global:", error);
        socket.emit("server:error", {
          message: "Error al actualizar el orden",
        });
      }
    });
    socket.on("disconnect", () => {
      console.log("Cliente desconectado:", socket.id);
    });
  });
};
