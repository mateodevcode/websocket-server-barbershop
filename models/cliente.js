import mongoose from "mongoose";
const { models, Schema, model } = mongoose;

const clienteSchema = new Schema(
  {
    nombre: {
      type: String,
      required: true,
    },
    numero_cedula: {
      type: String,
      required: true,
    },
    foto_cedula: {
      type: String,
      default: "",
    },
    publicId_cedula: {
      type: String,
      default: "",
    },
    telefono: {
      type: String,
      required: true,
    },

    // ===== COBRO =====
    cobrador: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      required: true,
    },
    ruta: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ruta",
      default: null,
    },
    orden_en_ruta: {
      type: Number,
      default: null,
    },

    // ===== DEUDA =====
    monto: {
      type: Number,
      default: 0,
    },
    deuda: {
      type: Number,
      default: 0,
    },
    intereses: {
      type: Number,
      default: 0,
    },
    plazo_cuota: {
      type: Number,
      default: 0,
    },
    cuota_actual: {
      type: Number,
      default: 0,
    },

    // ===== INFORMACIÓN =====
    imageUrl: {
      type: String,
      default: "",
    },
    publicId: {
      type: String,
      default: "",
    },
    barrio: {
      type: String,
      default: "",
    },
    direccion: {
      type: String,
      required: true,
    },
    ciudad: {
      type: String,
      default: "",
    },
    genero: {
      type: String,
      default: "",
    },
    recomendado_por: {
      type: String,
      default: "",
    },
    estado: {
      type: String,
      enum: ["Activo", "Pagado", "Vencido", "Suspendido"],
      default: "Activo",
    },
  },
  {
    timestamps: true,
  }
);

const Cliente = models.Cliente || mongoose.model("Cliente", clienteSchema);
export default Cliente;
