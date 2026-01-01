import express from "express";
import {
  getdeposit,
  createfd,
  getcreatefd,
  postcreatefd,
  successfd,
  claimFDMaturity,
  getFDDetails
} from "./fd-controllers.js";

const router = express.Router();

// FD Dashboard
router.get("/deposits/:id", getdeposit);

// Create FD
router.get("/deposits/create-fd/:id", createfd);
router.get("/fd/create", getcreatefd);
router.post("/fd/create", postcreatefd);

// FD Success & Details
router.get("/fd-success/:id", successfd);
router.get("/fd/details/:id", getFDDetails);

// Claim FD
router.post("/claim/fd", claimFDMaturity);

export default router;
