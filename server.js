import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";

import mainRouter from "./routes/index.js";

const app = express();

// body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// cookies (JWT)
app.use(cookieParser());

// routes
app.use("/", mainRouter);

// ❌ DO NOT listen on Vercel
export default app;
