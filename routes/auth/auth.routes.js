import express from "express"
import { signuser, showSuccess, loginuser, verifyEmail, verifyPhone } from "./auth.comtrollers.js"
import supabase from '../../config/db.js';
const router = express.Router()

/* LOGIN */
router.get("/login", (req, res) => {
  console.log("DB URL:", process.env.DATABASE_URL);

  console.log(supabase);
  
  res.render("login.ejs", { errors: {}, old: {} })
})

router.post("/login", loginuser)

/* SIGNUP */
router.get("/signup", (req, res) => {
  console.log("[v0] Client ID:", process.env.PHONE_EMAIL_CLIENT_ID)

  req.session.verifiedEmail = null
  req.session.verifiedPhone = null

  res.render("signup.ejs", {
    errors: {},
    old: {},
    verifiedEmail: null,
    verifiedPhone: null,
    phoneEmailClientId: process.env.PHONE_EMAIL_CLIENT_ID,
  })
})

router.post("/signup", signuser)

/* Email and Phone verification endpoints */
router.post("/verify-email", verifyEmail)

router.post("/verify-phone", verifyPhone)

/* SUCCESS */
router.get("/signup-success", showSuccess)

export default router
