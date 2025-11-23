import Transferencia from "../models/transferencia.js";
import Usuario from "../models/usuario.js";
import Cliente from "../models/cliente.js";
import Ruta from "../models/ruta.js";
export const transferencia_socket = (io) => {
  // Evento cuando un cliente se conecta
  io.on("connection", (socket) => {
    console.log("Cliente conectado:", socket.id);
    // ===== CREAR PRÉSTAMO COMPLETO (ATÓMICO) =====
    socket.on("client:crear_prestamo_completo", async (datos) => {
      try {
        const {
          cliente,
          cobrador,
          monto_prestamo,
          intereses,
          plazo_cuota,
          cuota_diaria,
          deuda_total,
          descripcion_prestamo,
          descripcion_interes,
        } = datos;

        // ===== VALIDACIONES =====
        if (!cliente || !cobrador || !monto_prestamo) {
          console.error("❌ Datos incompletos para crear préstamo");
          socket.emit("server:error", {
            message: "Faltan datos requeridos para crear el préstamo",
          });
          return;
        }

        // 1. Validar línea de crédito disponible
        const usuarioCobrador = await Usuario.findById(cobrador);
        if (!usuarioCobrador) {
          console.error("❌ Cobrador no encontrado");
          socket.emit("server:error", { message: "Cobrador no encontrado" });
          return;
        }

        const lineaDisponible =
          usuarioCobrador.linea_credito_total -
          usuarioCobrador.linea_credito_usada;

        if (monto_prestamo > lineaDisponible) {
          console.error("❌ Línea de crédito insuficiente");
          socket.emit("error:linea_credito_insuficiente", {
            disponible: lineaDisponible,
            solicitado: monto_prestamo,
          });
          return;
        }

        // 2. Calcular montos
        const montoInteresRetorno = monto_prestamo * 0.1; // 10% retorno
        const saldoAnterior = lineaDisponible;
        const saldoDespuesPrestamo = saldoAnterior - monto_prestamo;
        const saldoFinal = saldoDespuesPrestamo + montoInteresRetorno;

        // 3. Actualizar cobrador (ATÓMICO)
        // Aumenta usada por préstamo, disminuye por retorno
        usuarioCobrador.linea_credito_usada =
          usuarioCobrador.linea_credito_usada +
          monto_prestamo -
          montoInteresRetorno;
        // Aumenta efectivo en mano por el retorno del 10%
        usuarioCobrador.efectivo_en_mano =
          (usuarioCobrador.efectivo_en_mano || 0) + montoInteresRetorno;
        await usuarioCobrador.save();

        // 4. Buscar o crear ruta del día
        let rutaActual = await Ruta.findOne({
          cobrador: cobrador,
          estado: "Activa",
        });

        if (!rutaActual) {
          rutaActual = new Ruta({
            nombre: `Ruta ${new Date().toLocaleDateString()}`,
            descripcion: "Ruta diaria de cobros",
            cobrador: cobrador,
            estado: "Activa",
            fecha_creacion_prestamo: new Date(),
          });
          await rutaActual.save();
          usuarioCobrador.rutas.push(rutaActual._id);
          await usuarioCobrador.save();
        }

        // 5. Actualizar cliente
        await Cliente.findByIdAndUpdate(cliente, {
          monto: monto_prestamo,
          deuda: deuda_total,
          intereses: intereses || 0,
          plazo_cuota: plazo_cuota || 0,
          cuota_diaria: cuota_diaria,
          ruta: rutaActual._id,
          orden_en_ruta: rutaActual.clientes.length + 1,
        });

        // 6. Asignar cliente a ruta si no está
        const clienteEnRuta = rutaActual.clientes.find(
          (c) => c.cliente_id.toString() === cliente.toString()
        );
        if (!clienteEnRuta) {
          rutaActual.clientes.push({
            cliente_id: cliente,
            orden: rutaActual.clientes.length + 1,
            fecha_agregado: new Date(),
          });
          await rutaActual.save();
        }

        // 7. Crear Transferencia 1: DÉBITO (Préstamo)
        const transferenciaPrestamo = new Transferencia({
          tipo: "DÉBITO",
          cliente,
          cobrador,
          ruta: rutaActual._id,
          monto: monto_prestamo,
          descripcion: descripcion_prestamo,
          deuda_anterior: 0, // Asumimos 0 si es nuevo préstamo validado
          deuda_nueva: deuda_total,
          saldo_anterior_cobrador: saldoAnterior,
          saldo_nuevo_cobrador: saldoDespuesPrestamo,
          estado: "Completado",
        });
        await transferenciaPrestamo.save();

        // 8. Crear Transferencia 2: ABONO (Retorno 10%)
        const transferenciaInteres = new Transferencia({
          tipo: "ABONO",
          cliente,
          cobrador,
          ruta: rutaActual._id,
          monto: montoInteresRetorno,
          descripcion: descripcion_interes,
          deuda_anterior: deuda_total,
          deuda_nueva: deuda_total, // No reduce deuda
          saldo_anterior_cobrador: saldoDespuesPrestamo,
          saldo_nuevo_cobrador: saldoFinal,
          estado: "Completado",
        });
        await transferenciaInteres.save();

        // 9. Emitir eventos
        await transferenciaPrestamo.populate("cliente cobrador ruta");
        await transferenciaInteres.populate("cliente cobrador ruta");

        io.emit("server:transferencia_creada", transferenciaPrestamo);
        // Pequeño delay para asegurar orden en frontend
        setTimeout(() => {
          io.emit("server:transferencia_creada", transferenciaInteres);
        }, 100);

        // Recargar usuario para asegurar datos frescos antes de emitir
        const usuarioActualizado = await Usuario.findById(cobrador);
        io.emit("server:usuario_actualizado", usuarioActualizado);

        const transferencias = await Transferencia.find()
          .populate("cliente cobrador ruta")
          .sort({ createdAt: -1 });
        io.emit("server:transferencias", transferencias);

        const usuarios = await Usuario.find();
        io.emit("server:usuarios", usuarios);

        const clientes = await Cliente.find();
        io.emit("server:clientes", clientes);

        console.log("✅ Préstamo completo creado exitosamente");
      } catch (error) {
        console.error("❌ Error al crear préstamo completo:", error);
        socket.emit("server:error", {
          message: "Error al crear el préstamo",
          error: error.message,
        });
      }
    });

    // ===== CREAR TRANSFERENCIA (LEGACY/MANUAL) =====
    socket.on("client:crear_transferencia", async (datos) => {
      try {
        const {
          tipo,
          cliente,
          cobrador,
          ruta,
          monto,
          descripcion,
          deuda_anterior,
          deuda_nueva,
          saldo_anterior_cobrador,
          saldo_nuevo_cobrador,
        } = datos;
        // ===== VALIDACIONES =====
        if (!tipo || !cliente || !cobrador || !monto) {
          console.error("❌ Datos incompletos para crear transferencia");
          socket.emit("server:error", {
            message: "Faltan datos requeridos para crear la transferencia",
          });
          return;
        }
        // ===== LÓGICA SEGÚN TIPO DE TRANSFERENCIA =====
        if (tipo === "DÉBITO") {
          // ===== PRÉSTAMO: Dinero sale del cobrador hacia el cliente =====
          // 1. Validar línea de crédito disponible
          const usuarioCobrador = await Usuario.findById(cobrador);
          if (!usuarioCobrador) {
            console.error("❌ Cobrador no encontrado");
            socket.emit("server:error", { message: "Cobrador no encontrado" });
            return;
          }
          const lineaDisponible =
            usuarioCobrador.linea_credito_total -
            usuarioCobrador.linea_credito_usada;
          if (monto > lineaDisponible) {
            console.error("❌ Línea de crédito insuficiente");
            socket.emit("error:linea_credito_insuficiente", {
              disponible: lineaDisponible,
              solicitado: monto,
            });
            return;
          }
          // 2. Actualizar línea de crédito del cobrador
          usuarioCobrador.linea_credito_usada += monto;
          await usuarioCobrador.save();
          // 3. Buscar o crear ruta del día
          let rutaActual = await Ruta.findOne({
            cobrador: cobrador,
            estado: "Activa",
          });
          if (!rutaActual) {
            // Crear nueva ruta para el día
            rutaActual = new Ruta({
              nombre: `Ruta ${new Date().toLocaleDateString()}`,
              descripcion: "Ruta diaria de cobros",
              cobrador: cobrador,
              estado: "Activa",
              fecha_creacion_prestamo: new Date(),
            });
            await rutaActual.save();
            // Agregar ruta al usuario
            usuarioCobrador.rutas.push(rutaActual._id);
            await usuarioCobrador.save();
            console.log(`✅ Ruta creada: ${rutaActual._id}`);
          }
          // 4. Actualizar cliente con los datos del préstamo
          const cuota_diaria =
            datos.cuota_diaria || deuda_nueva / datos.plazo_cuota;
          await Cliente.findByIdAndUpdate(cliente, {
            monto: datos.monto_prestamo || monto,
            deuda: deuda_nueva,
            intereses: datos.intereses || 0,
            plazo_cuota: datos.plazo_cuota || 0,
            cuota_diaria: cuota_diaria,
          });
          // 5. Asignar cliente a la ruta si no está ya
          const clienteEnRuta = rutaActual.clientes.find(
            (c) => c.cliente_id.toString() === cliente.toString()
          );
          if (!clienteEnRuta) {
            rutaActual.clientes.push({
              cliente_id: cliente,
              orden: rutaActual.clientes.length + 1,
              fecha_agregado: new Date(),
            });
            await rutaActual.save();
            console.log(`✅ Cliente agregado a ruta: ${rutaActual._id}`);
          }
          // 6. Actualizar cliente con la ruta
          await Cliente.findByIdAndUpdate(cliente, {
            ruta: rutaActual._id,
            orden_en_ruta: rutaActual.clientes.length,
          });
          // 6. Crear transferencia con ruta asignada
          const nuevaTransferencia = new Transferencia({
            tipo,
            cliente,
            cobrador,
            ruta: rutaActual._id,
            monto,
            descripcion: descripcion || "",
            deuda_anterior: deuda_anterior || 0,
            deuda_nueva: deuda_nueva || 0,
            saldo_anterior_cobrador: saldo_anterior_cobrador || 0,
            saldo_nuevo_cobrador: saldo_nuevo_cobrador || 0,
            estado: "Completado",
          });
          await nuevaTransferencia.save();
          await nuevaTransferencia.populate("cliente cobrador ruta");
          console.log(
            "✅ Transferencia DÉBITO creada:",
            nuevaTransferencia._id
          );
          // Emitir eventos de actualización
          io.emit("server:transferencia_creada", nuevaTransferencia);
          io.emit("server:usuario_actualizado", usuarioCobrador);
          // Enviar listas actualizadas
          const transferencias = await Transferencia.find()
            .populate("cliente cobrador ruta")
            .sort({ createdAt: -1 });
          io.emit("server:transferencias", transferencias);
          const usuarios = await Usuario.find();
          io.emit("server:usuarios", usuarios);
          const clientes = await Cliente.find();
          io.emit("server:clientes", clientes);
        } else if (tipo === "ABONO") {
          // ===== ABONO: Dinero entra del cliente al cobrador =====
          // Detectar si es un abono de "interés inicial" (no reduce deuda)
          const esInteresInicial =
            descripcion &&
            descripcion.includes("Interés inicial por nuevo préstamo");
          // 1. Actualizar línea de crédito del cobrador (SIEMPRE liberar)
          const usuarioCobrador = await Usuario.findById(cobrador);
          if (!usuarioCobrador) {
            console.error("❌ Cobrador no encontrado");
            socket.emit("server:error", { message: "Cobrador no encontrado" });
            return;
          }
          // SIEMPRE liberar línea de crédito cuando entra dinero
          usuarioCobrador.linea_credito_usada -= monto;
          usuarioCobrador.efectivo_en_mano =
            (usuarioCobrador.efectivo_en_mano || 0) + monto;
          await usuarioCobrador.save();
          // 2. Actualizar deuda del cliente SOLO si NO es interés inicial
          if (!esInteresInicial) {
            const clienteActual = await Cliente.findById(cliente);
            if (clienteActual) {
              clienteActual.deuda = Math.max(0, clienteActual.deuda - monto);
              clienteActual.total_pagado =
                (clienteActual.total_pagado || 0) + monto;
              clienteActual.fecha_ultimo_pago = new Date();
              await clienteActual.save();
            }
          }
          // 3. Actualizar ruta si existe
          if (ruta) {
            const rutaActual = await Ruta.findById(ruta);
            if (rutaActual) {
              rutaActual.efectivo_recogido_hoy =
                (rutaActual.efectivo_recogido_hoy || 0) + monto;
              rutaActual.abonos_del_dia =
                (rutaActual.abonos_del_dia || 0) + monto;
              await rutaActual.save();
            }
          }
          // 4. Crear transferencia
          const nuevaTransferencia = new Transferencia({
            tipo,
            cliente,
            cobrador,
            ruta: ruta || null,
            monto,
            descripcion: descripcion || "",
            deuda_anterior: deuda_anterior || 0,
            deuda_nueva: deuda_nueva || 0,
            saldo_anterior_cobrador: saldo_anterior_cobrador || 0,
            saldo_nuevo_cobrador: saldo_nuevo_cobrador || 0,
            estado: "Completado",
          });
          await nuevaTransferencia.save();
          await nuevaTransferencia.populate("cliente cobrador ruta");
          console.log("✅ Transferencia ABONO creada:", nuevaTransferencia._id);
          // Emitir eventos de actualización
          io.emit("server:transferencia_creada", nuevaTransferencia);
          // Recargar usuario para asegurar datos frescos antes de emitir
          const usuarioActualizado = await Usuario.findById(cobrador);
          io.emit("server:usuario_actualizado", usuarioActualizado);
          // Enviar listas actualizadas
          const transferencias = await Transferencia.find()
            .populate("cliente cobrador ruta")
            .sort({ createdAt: -1 });
          io.emit("server:transferencias", transferencias);
          const usuarios = await Usuario.find();
          io.emit("server:usuarios", usuarios);
          const clientes = await Cliente.find();
          io.emit("server:clientes", clientes);
        }
      } catch (error) {
        console.error("❌ Error al crear transferencia:", error);
        socket.emit("server:error", {
          message: "Error al crear la transferencia",
          error: error.message,
        });
      }
    });
    // ===== OBTENER TRANSFERENCIAS =====
    socket.on("client:get_transferencias", async () => {
      try {
        const transferencias = await Transferencia.find()
          .populate("cliente cobrador ruta")
          .sort({ createdAt: -1 });
        socket.emit("server:transferencias", transferencias);
      } catch (error) {
        console.error("❌ Error al obtener transferencias:", error);
        socket.emit("server:error", {
          message: "Error al obtener transferencias",
          error: error.message,
        });
      }
    });
    // ===== ACTUALIZAR ESTADO DE TRANSFERENCIA =====
    socket.on(
      "client:actualizar_transferencia",
      async ({ transferencia_id, estado }) => {
        try {
          if (!transferencia_id || !estado) {
            socket.emit("server:error", {
              message: "Faltan datos para actualizar la transferencia",
            });
            return;
          }
          const transferencia = await Transferencia.findByIdAndUpdate(
            transferencia_id,
            { estado },
            { new: true }
          ).populate("cliente cobrador ruta");
          if (!transferencia) {
            socket.emit("server:error", {
              message: "Transferencia no encontrada",
            });
            return;
          }
          // Emitir actualización a todos
          io.emit("server:transferencia_actualizada", transferencia);
          // Enviar lista actualizada
          const transferencias = await Transferencia.find()
            .populate("cliente cobrador ruta")
            .sort({ createdAt: -1 });
          io.emit("server:transferencias", transferencias);
          console.log("✅ Transferencia actualizada:", transferencia._id);
        } catch (error) {
          console.error("❌ Error al actualizar transferencia:", error);
          socket.emit("server:error", {
            message: "Error al actualizar la transferencia",
            error: error.message,
          });
        }
      }
    );
    // ===== ELIMINAR TRANSFERENCIA =====
    socket.on("client:eliminar_transferencia", async (transferencia_id) => {
      try {
        if (!transferencia_id) {
          socket.emit("server:error", {
            message: "ID de transferencia requerido",
          });
          return;
        }
        await Transferencia.findByIdAndDelete(transferencia_id);
        // Enviar lista actualizada
        const transferencias = await Transferencia.find()
          .populate("cliente cobrador ruta")
          .sort({ createdAt: -1 });
        io.emit("server:transferencias", transferencias);
        console.log("✅ Transferencia eliminada:", transferencia_id);
      } catch (error) {
        console.error("❌ Error al eliminar transferencia:", error);
        socket.emit("server:error", {
          message: "Error al eliminar la transferencia",
          error: error.message,
        });
      }
    });
    // ===== REALIZAR CUADRE DE CAJA =====
    socket.on("client:realizar_cuadre", async (datos) => {
      try {
        const { cobrador_id, efectivo_declarado, fecha } = datos;
        // Validaciones
        if (!cobrador_id || efectivo_declarado === undefined) {
          console.error("❌ Datos incompletos para realizar cuadre");
          socket.emit("server:error", {
            message: "Datos incompletos para realizar cuadre",
          });
          return;
        }
        // Buscar cobrador
        const cobrador = await Usuario.findById(cobrador_id);
        if (!cobrador) {
          console.error("❌ Cobrador no encontrado");
          socket.emit("server:error", { message: "Cobrador no encontrado" });
          return;
        }
        // Calcular diferencia
        const efectivoEnMano = cobrador.efectivo_en_mano || 0;
        const diferencia = efectivo_declarado - efectivoEnMano;
        // Actualizar cobrador
        cobrador.efectivo_en_mano = 0; // Resetear efectivo
        cobrador.ultima_fecha_cuadre = fecha || new Date();
        await cobrador.save();
        console.log("✅ Cuadre realizado:", {
          cobrador: cobrador.name,
          efectivo_esperado: efectivoEnMano,
          efectivo_declarado: efectivo_declarado,
          diferencia: diferencia,
        });
        // Emitir eventos
        io.emit("server:cuadre_realizado", {
          cobrador_id,
          efectivo_esperado: efectivoEnMano,
          efectivo_declarado: efectivo_declarado,
          diferencia: diferencia,
          fecha: cobrador.ultima_fecha_cuadre,
        });
        io.emit("server:usuario_actualizado", cobrador);
        const usuarios = await Usuario.find();
        io.emit("server:usuarios", usuarios);
      } catch (error) {
        console.error("❌ Error al realizar cuadre:", error);
        socket.emit("error:realizar_cuadre", { message: error.message });
      }
    });
    // ===== OBTENER RESUMEN DEL DÍA =====
    socket.on("client:obtener_resumen_dia", async (datos) => {
      try {
        const { cobrador_id, fecha } = datos;
        if (!cobrador_id) {
          console.error("❌ Cobrador ID requerido");
          socket.emit("server:error", { message: "Cobrador ID requerido" });
          return;
        }
        const fechaBusqueda = fecha ? new Date(fecha) : new Date();
        const inicioDia = new Date(fechaBusqueda.setHours(0, 0, 0, 0));
        const finDia = new Date(fechaBusqueda.setHours(23, 59, 59, 999));
        // Obtener transferencias del día
        const transferencias = await Transferencia.find({
          cobrador: cobrador_id,
          createdAt: { $gte: inicioDia, $lte: finDia },
        });
        // Calcular totales
        const totalPrestado = transferencias
          .filter((t) => t.tipo === "DÉBITO")
          .reduce((sum, t) => sum + t.monto, 0);
        const totalRecogido = transferencias
          .filter((t) => t.tipo === "ABONO")
          .reduce((sum, t) => sum + t.monto, 0);
        // Obtener cobrador
        const cobrador = await Usuario.findById(cobrador_id);
        // Obtener rutas activas
        const rutasActivas = await Ruta.find({
          cobrador: cobrador_id,
          estado: "Activa",
        }).populate("clientes.cliente_id");
        // Clientes pendientes de cobro (con deuda > 0)
        const clientesPendientes = await Cliente.find({
          cobrador: cobrador_id,
          deuda: { $gt: 0 },
        });
        const resumen = {
          fecha: fechaBusqueda,
          total_prestado: totalPrestado,
          total_recogido: totalRecogido,
          efectivo_en_mano: cobrador.efectivo_en_mano || 0,
          linea_credito_disponible:
            cobrador.linea_credito_total - cobrador.linea_credito_usada,
          linea_credito_usada: cobrador.linea_credito_usada,
          clientes_pendientes: clientesPendientes.length,
          rutas_activas: rutasActivas.length,
          transferencias_count: transferencias.length,
        };
        console.log("✅ Resumen del día obtenido:", resumen);
        // Emitir evento
        socket.emit("server:resumen_dia", resumen);
      } catch (error) {
        console.error("❌ Error al obtener resumen del día:", error);
        socket.emit("error:obtener_resumen_dia", { message: error.message });
      }
    });
    socket.on("disconnect", () => {
      console.log("Cliente desconectado:", socket.id);
    });
  });
};
