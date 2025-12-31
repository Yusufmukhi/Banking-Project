import pool from "../../config/pgPool.js";

/* =========================================================
   SESSION CHECK
========================================================= */
export function checkuser(req) {
  return !!req.session.customer;
}

/* =========================================================
   CUSTOMER
========================================================= */
export async function getCustomer(customerId) {
  const result = await pool.query(
    `
    SELECT
      customer_id,
      cif,
      userid,
      full_name,
      username,
      email,
      mobile,
      dob,
      gender,
      aadhaar,
      pan,
      address,
      city,
      state,
      pincode,
      monthly_income,
      created_at
    FROM customers
    WHERE customer_id = $1
    `,
    [customerId]
  );

  if (!result.rows.length) return null;

  const customer = result.rows[0];

  // ✅ GUARANTEE SAFE STRINGS (NO NULL / UNDEFINED)
  customer.aadhaar = customer.aadhaar || "";
  customer.pan = customer.pan || "";
  customer.gender = customer.gender || "";
  customer.address = customer.address || "";
  customer.city = customer.city || "";
  customer.state = customer.state || "";
  customer.pincode = customer.pincode || "";

  return customer;
}


/* =========================================================
   ACCOUNTS
========================================================= */
export async function getAccounts(customerId) {
  const result = await pool.query(
    `SELECT 
        account_id,
        account_number,
        account_type,
        balance,
        branch,
        ifsc,
        status,
        opened_at
     FROM accounts
     WHERE customer_id = $1
     ORDER BY opened_at DESC`,
    [customerId]
  );

  return result.rows;
}

export async function getAccountById(accountId) {
  const result = await pool.query(
    `SELECT *
     FROM accounts
     WHERE account_id = $1`,
    [accountId]
  );

  return result.rows[0] || null;
}

export async function getSavingsAccount(customerId) {
  const result = await pool.query(
    `SELECT *
     FROM accounts
     WHERE customer_id = $1
       AND account_type = 'SAVINGS'`,
    [customerId]
  );

  return result.rows;
}

/* =========================================================
   TRANSACTIONS
========================================================= */
export async function getTransactionsByAccount(accountId) {
  const result = await pool.query(
    `SELECT 
        tx_id,
        tx_type,
        amount,
        balance_after,
        remarks,
        created_at
     FROM transactions
     WHERE account_id = $1
     ORDER BY created_at DESC`,
    [accountId]
  );

  return result.rows;
}

export async function getAllTransactions(customerId) {
  const result = await pool.query(
    `SELECT 
        t.tx_id,
        t.tx_type,
        t.amount,
        t.balance_after,
        t.remarks,
        t.created_at,
        a.account_number
     FROM transactions t
     JOIN accounts a ON a.account_id = t.account_id
     WHERE a.customer_id = $1
     ORDER BY t.created_at DESC`,
    [customerId]
  );

  return result.rows;
}

/* =========================================================
   FIXED DEPOSITS
========================================================= */
export async function getFD(customerId) {
  const result = await pool.query(
    `SELECT *
     FROM fixed_deposits
     WHERE customer_id = $1
     ORDER BY created_at DESC`,
    [customerId]
  );

  return result.rows;
}

/* =========================================================
   RECURRING DEPOSITS
========================================================= */
export async function getRD(customerId) {
  const result = await pool.query(
    `SELECT *
     FROM recurring_deposits
     WHERE customer_id = $1
     ORDER BY created_at DESC`,
    [customerId]
  );

  return result.rows;
}

export async function getRDTransactions(rdId) {
  const result = await pool.query(
    `SELECT *
     FROM rd_deposit_transactions
     WHERE rd_id = $1
     ORDER BY scheduled_date`,
    [rdId]
  );

  return result.rows;
}

/* =========================================================
   LOANS & EMI
========================================================= */
export async function getLoans(customerId) {
  const result = await pool.query(
    `SELECT *
     FROM loans
     WHERE customer_id = $1
     ORDER BY created_at DESC`,
    [customerId]
  );

  return result.rows;
}

export async function getEMIPayments(customerId) {
  const result = await pool.query(
    `SELECT ep.*
     FROM emi_payments ep
     JOIN loans l ON l.loan_id = ep.loan_id
     WHERE l.customer_id = $1
     ORDER BY ep.due_date`,
    [customerId]
  );

  return result.rows;
}

export async function getEMIPayouts(loanId) {
  const result = await pool.query(
    `SELECT *
     FROM emi_payouts
     WHERE loan_id = $1
     ORDER BY payout_number`,
    [loanId]
  );

  return result.rows;
}

/* =========================================================
   CARDS
========================================================= */
export async function getCards(customerId) {
  const result = await pool.query(
    `SELECT 
        card_id,
        card_number,
        card_type,
        network,
        expiry_month,
        expiry_year,
        status,
        issued_at
     FROM cards
     WHERE customer_id = $1
     ORDER BY issued_at DESC`,
    [customerId]
  );

  return result.rows;
}

/* =========================================================
   UPI
========================================================= */
export async function getUpiAccounts(customerId) {
  const result = await pool.query(
    `SELECT 
        upi_id,
        upi_handle,
        status,
        created_at,
        account_id
     FROM upi_accounts
     WHERE customer_id = $1`,
    [customerId]
  );

  return result.rows;
}
