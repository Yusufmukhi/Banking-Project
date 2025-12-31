import express from "express"
import {
  getProfile,
  updateProfile,
  logout,
  getChangePassword,
  changePassword,
  getEditProfile,
  editProfile,
  verifyEmailOtp,
} from "./profile.controllers.js"

const router = express.Router()

router.get("/profile/:id", getProfile)
router.post("/profile/:id", updateProfile)
router.get("/logout", logout)
router.get("/change-password/:id", getChangePassword)
router.post("/change-password/:id", changePassword)
router.get("/edit-profile/:id", getEditProfile)
router.post("/edit-profile/:id", editProfile)
router.post("/verify-email-otp", verifyEmailOtp)

export default router