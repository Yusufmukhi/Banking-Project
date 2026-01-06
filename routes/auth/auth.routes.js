import express from "express";
import {
  signuser,
  showSuccess,
  loginuser,
  verifyEmail,
  verifyPhone,
} from "./auth.comtrollers.js";

import { tempSession } from "../middleware/tempSession.js";

const router = express.Router();

/* LOGIN (NO SESSION NEEDED) */
router.get("/login", (req, res) => {
  res.render("login.ejs", { errors: {}, old: {} });
});

router.post("/login", loginuser);

/* SIGNUP (TEMP SESSION ENABLED) */
router.get("/signup", tempSession, (req, res) => {
  req.session.verifiedEmail = null;
  req.session.verifiedPhone = null;

  res.render("signup.ejs", {
    errors: {},
    old: {},
    verifiedEmail: null,
    verifiedPhone: null,
    phoneEmailClientId: process.env.PHONE_EMAIL_CLIENT_ID,
  });
});

router.post("/signup", tempSession, signuser);
router.post("/verify-email", tempSession, verifyEmail);
router.post("/verify-phone", tempSession, verifyPhone);
router.get("/signup-success", tempSession, showSuccess);

export default router;
