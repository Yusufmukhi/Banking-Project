import express from "express";
import jwt from "jsonwebtoken";
import { auth } from "../middleware/auth.js";

// auth routes
import authRoutes from "../auth/auth.routes.js";

// protected routes
import home from "../home/home.routes.js";
import accounts from "../accounts/accounts.router.js";
import upi from "../upi/upi.routes.js";
import rd from "../rd/rd-routes.js";
import fd from "../fd/fd-routes.js";
import loan from "../loans/loan.routes.js";
import transfer from "../transfer/transfer.routes.js";
import profile from "../profile/profile.routes.js";

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
