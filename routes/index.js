import express from "express";
import jwt from "jsonwebtoken";
import { auth } from "./middleware/auth.js";

// auth routes
import authRoutes from "../routes/auth/auth.routes.js";

// protected routes
import home from "../routes/home/home.routes.js";
import accounts from "../routes/accounts/accounts.router.js";
import upi from "../routes/upi/upi.routes.js";
import rd from "../routes/rd/rd-routes.js";
import fd from "../routes/fd/fd-routes.js";
import loan from "../routes/loans/loan.routes.js";
import transfer from "../routes/transfer/transfer.routes.js";
import profile from "../routes/profile/profile.routes.js";

const router = express.Router();

/* ROOT */
router.get("/", (req, res) => {
  const token = req.cookies.auth_token;

  if (!token) return res.redirect("/login");

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    return res.redirect("/dashboard");
  } catch {
    return res.redirect("/login");
  }
});

/* AUTH (login, signup, verify) */
router.use("/", authRoutes);

/* PROTECTED ROUTES */
router.use("/", auth, home);
router.use("/", auth, accounts);
router.use("/", auth, upi);
router.use("/", auth, rd);
router.use("/", auth, fd);
router.use("/", auth, loan);
router.use("/", auth, transfer);
router.use("/", auth, profile);

/* 404 */
router.use((req, res) => {
  res.status(404).render("404.ejs");
});

export default router;
