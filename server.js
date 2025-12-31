import "dotenv/config"
import express from "express"
import path from "path"
import { fileURLToPath } from "url"

import { sessionMiddleware } from "./routes/middleware/sessionMiddleware.js"
import mainRouter from "./routes/index.js"

const app = express()

/* ================= FIX __dirname (ESM + Vercel) ================= */
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/* ================= View Engine ================= */
app.set("view engine", "ejs")
app.set("views", path.join(__dirname, "views"))

/* ================= Middlewares ================= */
// session FIRST
app.use(sessionMiddleware)

// body & static
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(express.static(path.join(__dirname, "public")))

// routes
app.use("/", mainRouter)

/* ================= EXPORT (NO listen) ================= */
export default app
