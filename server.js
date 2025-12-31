import "dotenv/config"
import express from "express"
import { sessionMiddleware } from "./routes/middleware/sessionMiddleware.js"
import mainRouter from "./routes/index.js"

const app = express()

// session FIRST
app.use(sessionMiddleware)

// body & static
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(express.static("public"))

// routes
app.use("/", mainRouter)

// Railway-safe listen
const PORT = process.env.PORT || 3000
app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port", PORT)
})
