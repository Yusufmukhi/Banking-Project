import express from "express";
import {
  account,
  createaccount,
  accountdetalis,
  deatlis
} from "./account.controllers.js";

const router = express.Router();

/* ================= ROUTES ================= */

// account list
router.get("/accounts/:id", account);

// create account
router.get("/create-account/:id", accountdetalis);
router.post("/create-account/:id", createaccount);

// account details (account_id is OK)
router.get("/details/:accid", deatlis);

export default router;
