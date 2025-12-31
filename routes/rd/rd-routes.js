import express from "express";
import {
  createrd,
  postcreaterd,
  successrd,
  getrdDetails,
  maturityrd,
  claimRDMaturity,
  payRDPage,
  submitRDPayment
} from "./rd-controller.js";

const router = express.Router();

/* ================= CREATE RD ================= */

// show create RD page
router.get("/deposits/create-rd/:id", createrd);

// submit create RD
router.post("/rd/create/:id", postcreaterd);


/* ================= RD SUCCESS ================= */

router.get("/rd-success/:id", successrd); 
// :id here is rd_id (safe)


/* ================= RD DETAILS ================= */

router.get("/rd/details/:id", getrdDetails); 
// :id here is rd_id (safe)


/* ================= MATURITY CLAIM PAGE ================= */

router.get("/claim", maturityrd);


/* ================= CLAIM RD ================= */

router.post("/claim/rd", claimRDMaturity);
router.get("/pay/:id", payRDPage);

/* ================= SUBMIT RD PAYMENT ================= */
router.post("/pay-rd/:id/:rdId", submitRDPayment);

export default router;
