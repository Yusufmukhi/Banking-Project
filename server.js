import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import session from "express-session";

import mainRouter from "./routes/index.js";

const app = express();

// body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// cookies (for JWT)
app.use(cookieParser());

// ⚠️ session ONLY for signup verification (email/phone)
// NOT used for login
app.use(
  session({
    secret: "signup-temp-secret",
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: true,        // REQUIRED for Vercel HTTPS
      sameSite: "lax",
    },
  })
);

// routes
app.use("/", mainRouter);

// ❌ DO NOT app.listen() on Vercel
export default app;
