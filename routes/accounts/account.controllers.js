import pool from "../../config/pgPool.js";
import * as data from "../user/user.js";
import { generateIFSC, generateAccountNumber } from "../functions/account-generator.js";

/* ================= ACCOUNTS LIST ================= */

export async function account(req, res) {
  if (!data.checkuser(req)) {
    return res.redirect("/login");
  }

  const customerId = req.session.customer.customer_id;

  const customer = await data.getCustomer(customerId);
  const accounts = await data.getAccounts(customerId);

  return res.render("accounts.ejs", {
    customer,
    accounts,
    id: customerId
  });
}

/* ================= CREATE ACCOUNT PAGE ================= */

export async function accountdetalis(req, res) {
  if (!data.checkuser(req)) {
    return res.redirect("/login");
  }

  const customerId = req.session.customer.customer_id;

  const customer = await data.getCustomer(customerId);
  const accounts = await data.getAccounts(customerId);

  return res.render("create-account.ejs", {
    customers: customer,
    accounts,
    id: customerId,
    error: {}
  });
}

/* ================= CREATE ACCOUNT ================= */

export async function createaccount(req, res) {
  try {
    if (!data.checkuser(req)) {
      return res.redirect("/login");
    }

    const customerId = req.session.customer.customer_id;

    const customer = await data.getCustomer(customerId);
    const accounts = await data.getAccounts(customerId);

    const { account_type, initialAmount, branch } = req.body;
    const error = {};

    /* ---------- DUPLICATE ACCOUNT CHECK ---------- */
    accounts.forEach(acc => {
      if (acc.branch === branch && acc.account_type === account_type) {
        error.account_type = "Account already exists in this branch";
      }
    });

    /* ---------- MIN BALANCE CHECK ---------- */
    if (Number(initialAmount) < 10000) {
      error.initialAmount = "Minimum opening balance is ₹10,000";
    }

    if (Object.keys(error).length > 0) {
      return res.render("create-account.ejs", {
        customers: customer,
        accounts,
        id: customerId,
        error
      });
    }

    const [branchNumber, branchName] = branch.split("|");
    const ifsc = await generateIFSC(branchNumber);
    const accno = await generateAccountNumber();

    await pool.query(
      `INSERT INTO accounts
       (customer_id, account_number, account_type, balance, branch, ifsc)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        customerId,
        accno,
        account_type,
        Number(initialAmount),
        branchName,
        ifsc
      ]
    );

    return res.render("account-success.ejs", {
      customers: customer,
      id: customerId,
      branchName,
      ifsc,
      initialAmount,
      accno,
      account_type
    });

  } catch (err) {
    console.error("Create account error:", err);
    return res.status(500).send("Internal Server Error");
  }
}

/* ================= ACCOUNT DETAILS ================= */

export async function deatlis(req, res) {
  if (!data.checkuser(req)) {
    return res.redirect("/login");
  }

  const customerId = req.session.customer.customer_id;
  const accid = Number(req.params.accid);

  /* ---------- OWNERSHIP CHECK ---------- */
  const result = await pool.query(
    `SELECT *
     FROM accounts
     WHERE account_id = $1
       AND customer_id = $2`,
    [accid, customerId]
  );

  if (!result.rows.length) {
    return res.status(403).send("Unauthorized access");
  }

  const customer = await data.getCustomer(customerId);
  const treansactions = await data.getTransactionsByAccount(11);
  console.log(treansactions);
  
  return res.render("details-account.ejs", {
    id: customerId,
    acc: result.rows[0],
    cust: customer,
    transactions: treansactions
  });
}
