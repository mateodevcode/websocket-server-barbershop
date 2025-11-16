import mongoose from "mongoose";

if (!process.env.URL_URI_MONGODB) {
  throw new Error("Falta la url de mongodb");
}

export const connectMongoDB = async () => {
  try {
    await mongoose.connect(process.env.URL_URI_MONGODB);
    console.log("Database connected");
  } catch (error) {
    console.error("Error al conectar a MongoDB", error);
  }
};
