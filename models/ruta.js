import mongoose from "mongoose";
const { models, Schema, model } = mongoose;

// ===== models/Ruta.js =====
const rutaSchema = new Schema(
  {
    nombre: {
      type: String,
      required: true,
    },
    descripcion: {
      type: String,
      default: "",
    },
    cobrador: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      required: true,
    },

    // ===== CLIENTES EN LA RUTA =====
    clientes: [
      {
        cliente_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Cliente",
        },
        orden: {
          type: Number,
        },
        fecha_agregado: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // ===== CONFIGURACIÓN =====
    dia_programado: {
      type: String,
      enum: [
        "Lunes",
        "Martes",
        "Miércoles",
        "Jueves",
        "Viernes",
        "Sábado",
        "Domingo",
      ],
      default: "Lunes",
    },
    horario_inicio: {
      type: String,
      default: "09:00",
    },
    horario_fin: {
      type: String,
      default: "17:00",
    },
    estado: {
      type: String,
      enum: ["Activa", "Inactiva", "Completada", "Suspendida"],
      default: "Activa",
    },

    // ===== ESTADÍSTICAS =====
    total_clientes: {
      type: Number,
      default: 0,
    },
    total_deuda: {
      type: Number,
      default: 0,
    },
    abonos_del_dia: {
      type: Number,
      default: 0,
    },
    fecha_creacion_prestamo: {
      type: Date,
      default: Date.now,
    },
    efectivo_recogido_hoy: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Middleware para actualizar estadísticas
rutaSchema.pre("save", async function (next) {
  try {
    const Cliente = mongoose.model("Cliente");
    if (this.clientes && this.clientes.length > 0) {
      this.total_clientes = this.clientes.length;

      const deudas = await Cliente.aggregate([
        {
          $match: {
            _id: {
              $in: this.clientes.map((c) => c.cliente_id),
            },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$deuda" },
          },
        },
      ]);

      this.total_deuda = deudas[0]?.total || 0;
    }
    next();
  } catch (error) {
    next(error);
  }
});

const Ruta = models.Ruta || mongoose.model("Ruta", rutaSchema);
export default Ruta;
