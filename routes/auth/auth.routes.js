import express from "express";
import {
  signuser,
  showSuccess,
  loginuser,
  verifyEmail,
  verifyPhone
} from "./auth.comtrollers.js";

const router = express.Router();

/* LOGIN */
router.get("/login", (req, res) => {
  res.render("login.ejs", { errors: {}, old: {} });
});
router.post("/login", loginuser);

/* SIGNUP */
router.get("/signup", (req, res) => {
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

router.post("/signup", signuser);
router.post("/verify-email", verifyEmail);
router.post("/verify-phone", verifyPhone);
router.get("/signup-success", showSuccess);

export default router;
