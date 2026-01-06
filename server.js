import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

import mainRouter from "./routes/index.js";

const app = express();

/* 🔹 REQUIRED FOR EJS + ES MODULES */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* 🔹 EJS SETUP (THIS FIXES THE ERROR) */
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// cookies
app.use(cookieParser());

// routes
app.use("/", mainRouter);

// ❌ DO NOT listen() on Vercel
export default app;
