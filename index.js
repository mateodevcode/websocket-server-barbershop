// server.mjs
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import "./config.js";
import { PORT } from "./config.js";
import { connectMongoDB } from "./db.js";
import { Socket } from "./sockets/socket.js";

const app = express();
const server = http.createServer(app);

// ✅ Configuración mejorada de CORS
const allowedOrigins = [
  process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000",
  "http://localhost:3000",
  "http://localhost:3001",
];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"], // ✅ Fallback a polling
});

app.use(cors());

app.get("/", (req, res) => {
  res.send("Servidor de sockets funcionando desde server con github actions!");
});

// ✅ Ruta de health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

server.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
  console.log(`Frontend permitido: ${allowedOrigins.join(", ")}`);
});

connectMongoDB();

Socket(io);
