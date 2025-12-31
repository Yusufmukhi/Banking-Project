import express from "express";
import { getOrCreateUpi, createUpi } from "./upi.controllers.js";

const router = express.Router();

// NO customer ID in URL
router.get("/upi/:id", getOrCreateUpi);
router.post("/createupi/:id", createUpi);

export default router;
