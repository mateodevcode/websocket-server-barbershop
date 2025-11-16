import mongoose from "mongoose";
const { models, Schema, model } = mongoose;

const notificacionSchema = new Schema(
  {
    mensaje: { type: String, required: true },
    fecha: { type: Date, default: Date.now },
    leido: { type: Boolean, default: false },
  },
  { _id: true } // ✅ asegura que cada notificación tenga un _id único
);

// // Schema para suscripciones Web Push
const pushSubscriptionSchema = new Schema(
  {
    endpoint: { type: String, required: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
  },
  { _id: false }
);

const usuarioSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
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
    plan: {
      type: String,
      default: "gratis",
    },
    estado: {
      type: String,
      default: "activo",
    },
    role: {
      type: String,
      default: "Usuario",
    },
    barberoID: {
      type: String,
      default: "",
    },
    intentos_fallidos: {
      type: Number,
      default: 0,
    },
    bloqueado: {
      type: Boolean,
      default: false,
    },
    codigo_verificacion: {
      type: String,
      default: "",
    },
    date_codigo_verificacion: {
      type: Date,
      default: Date.now,
    },
    notificaciones: {
      type: [notificacionSchema], // ✅ subdocumentos con _id
      default: [
        {
          mensaje: "Bienvenido a Seventwo!. Gracias por registrarte.",
          fecha: new Date(),
          leido: false,
        },
      ],
    },
    // 🔔 Suscripciones a notificaciones push (una por dispositivo)
    pushSubscriptions: {
      type: [pushSubscriptionSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const Usuario = models.Usuario || mongoose.model("Usuario", usuarioSchema);
export default Usuario;
