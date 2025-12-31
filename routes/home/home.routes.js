import express from 'express';
import {user} from './home.controller.js';
const router = express.Router();

router.get("/dashboard",user);
router.get("/dashboard-test", (req, res) => {
  res.send("Dashboard route working")
})

export default router;
