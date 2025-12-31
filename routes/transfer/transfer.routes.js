import express from "express";
import {
  gettransfer,
  bankTransferPage,
  processBankTransfer,
  upiTransferPage,
  processUpiTransfer
} from "./transfer.controllers.js";

const router = express.Router();

router.get("/transfers/:id", gettransfer);

router.get("/transfers/bank/:id", bankTransferPage);
router.post("/transfer-bank/:id", processBankTransfer);

router.get("/transfers/upi/:id", upiTransferPage);
router.post("/transfer-upi/:id", processUpiTransfer);

export default router;
