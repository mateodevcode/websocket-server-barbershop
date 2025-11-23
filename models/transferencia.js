import mongoose from "mongoose";
const { models, Schema, model } = mongoose;

const transferenciaSchema = new Schema(
  {
    tipo: {
      type: String,
      enum: ["DÉBITO", "ABONO"],
      required: true,
    },

    // ===== REFERENCIAS =====
    cliente: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cliente",
      required: true,
    },
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

    // ===== MONTOS =====
    monto: {
      type: Number,
      required: true,
      validate: {
        validator: function (v) {
          return v > 0;
        },
        message: "El monto debe ser mayor a 0",
      },
    },
    descripcion: {
      type: String,
      default: "",
    },

    // ===== ESTADO DEL CLIENTE =====
    deuda_anterior: {
      type: Number,
      default: 0,
    },
    deuda_nueva: {
      type: Number,
      default: 0,
    },

    // ===== ESTADO DEL COBRADOR =====
    saldo_anterior_cobrador: {
      type: Number,
      default: 0,
    },
    saldo_nuevo_cobrador: {
      type: Number,
      default: 0,
    },

    // ===== CONTROL =====
    estado: {
      type: String,
      enum: ["Completado", "Pendiente", "Rechazado"],
      default: "Completado",
    },
    comprobante: {
      type: String,
      default: "",
    },
    observaciones: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const Transferencia =
  models.Transferencia || mongoose.model("Transferencia", transferenciaSchema);
export default Transferencia;
