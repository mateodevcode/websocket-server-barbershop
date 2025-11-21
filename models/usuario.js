import mongoose from "mongoose";
const { models, Schema, model } = mongoose;

const usuarioSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    cedula: {
      type: String,
      default: "",
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    telefono: {
      type: String,
      default: "",
    },
    password: {
      type: String,
      default: "",
    },
    imageUrl: {
      type: String,
      default: "",
    },
    ubicacion: {
      type: String,
      default: "",
    },
    publicId: {
      type: String,
      default: "",
    },
    cargo: {
      type: String,
      default: "cobrador",
    },
    ruta: {
      type: String,
      default: "ruta-1",
    },
    estado: {
      type: String,
      default: "activo",
      enum: ["activo", "inactivo", "suspendido"],
    },

    // ===== LÍNEA DE CRÉDITO =====
    linea_credito_total: {
      type: Number,
      default: 10000000,
    },
    linea_credito_usada: {
      type: Number,
      default: 0,
    },

    // ===== REFERENCIAS =====
    listaClientes: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Cliente",
      default: [],
    },
    rutas: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Ruta",
      default: [],
    },

    // ===== CONTROL DE ACCESO =====
    intentosFallidos: {
      type: Number,
      default: 0,
    },
    bloqueado: {
      type: Boolean,
      default: false,
    },
    codigoVerificacion: {
      type: String,
      default: "",
    },
    dateCodigoVerificacion: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const Usuario = models.Usuario || mongoose.model("Usuario", usuarioSchema);
export default Usuario;
