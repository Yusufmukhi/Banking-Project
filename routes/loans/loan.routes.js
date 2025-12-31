import express from "express"
import {
  getLoans,
  getLoanEMIs,
  applyLoanPage,
  submitLoanApplication,
  payEMIPage,
  submitEMIPayment,
  loanDetailsPage,
} from "./loan.controllers.js"

const router = express.Router()

router.get("/loans/:id", getLoans)
router.get("/loans/:id/emis/:loanId", getLoanEMIs)

router.get("/apply-loan/:id", applyLoanPage)
router.post("/loans/apply/submit/:id", submitLoanApplication)

router.get("/pay-emi/:id/:loanId", payEMIPage)
router.post("/pay-emi/:id/:loanId", submitEMIPayment)

router.get("/loan-details/:id/:loanId", loanDetailsPage)

export default router
