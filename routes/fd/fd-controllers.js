import pool from "../../config/pgPool.js";
import * as data from "../user/user.js";

/* ================= FD + Deposit Dashboard ================= */

export async function getdeposit(req, res) {
  if (!data.checkuser(req)) {
    return res.redirect("/login");
  }

  const customerId = req.session.customer.customer_id;

  const Customers = await data.getCustomer(customerId);
  const Accounts = await data.getAccounts(customerId);
  const fd = await data.getFD(customerId);
  const rd = await data.getRD(customerId);

  return res.render("deposits.ejs", {
    id: customerId,
    Customers,
    Accounts,
    fd,
    rd
  });
}

/* ================= Create FD ================= */

export async function createfd(req, res) {
  if (!data.checkuser(req)) {
    return res.redirect("/login");
  }

  const customerId = req.session.customer.customer_id;

  const Customers = await data.getCustomer(customerId);
  const Savings = await data.getAccounts(customerId);

  return res.render("create-fd.ejs", {
    user: false,
    Customers,
    id: customerId,
    Savings
  });
}

export const getcreatefd = createfd;

/* ================= POST Create FD ================= */

export async function postcreatefd(req, res) {
  const client = await pool.connect();

  try {
    if (!data.checkuser(req)) {
      return res.redirect("/login");
    }

    const customerId = req.session.customer.customer_id;
    const { account_id, amount, tenure } = req.body;

    const [year, interest_rate] = tenure.split("||");
    const years = Number(year);
    const rate = Number(interest_rate);
    const duration_months = years * 12;

    const start_date = new Date();
    const maturity_date = new Date();
    maturity_date.setMonth(maturity_date.getMonth() + duration_months);

    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO fixed_deposits
       (customer_id, linked_account, amount, interest_rate, duration_months, start_date, maturity_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING fd_id`,
      [
        customerId,
        account_id,
        Number(amount),
        rate,
        duration_months,
        start_date,
        maturity_date
      ]
    );

    await client.query("COMMIT");

    return res.redirect(`/fd-success/${result.rows[0].fd_id}`);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST FD ERROR:", err);
    res.status(500).send("Server error");
  } finally {
    client.release();
  }
}

/* ================= FD Success ================= */

export async function successfd(req, res) {
  if (!data.checkuser(req)) {
    return res.redirect("/login");
  }

  const customerId = req.session.customer.customer_id;
  const fd_id = req.params.id;

  const result = await pool.query(
    `SELECT *
     FROM fixed_deposits
     WHERE fd_id = $1
       AND customer_id = $2`,
    [fd_id, customerId]
  );

  if (!result.rows.length) {
    return res.status(403).send("Unauthorized");
  }

  return res.render("fd-success.ejs", {
    Customers: req.session.customer,
    id: customerId,
    fdData: result.rows[0]
  });
}

/* ================= Claim FD ================= */

export async function claimFDMaturity(req, res) {
  const client = await pool.connect();

  try {
    if (!data.checkuser(req)) {
      return res.status(401).json({ success: false });
    }

    const customerId = req.session.customer.customer_id;
    const { fd_id } = req.body;

    await client.query("BEGIN");

    const fdResult = await client.query(
      `SELECT *
       FROM fixed_deposits
       WHERE fd_id = $1
         AND customer_id = $2`,
      [fd_id, customerId]
    );

    if (!fdResult.rows.length) {
      throw new Error("Unauthorized FD claim");
    }

    const fd = fdResult.rows[0];
    const maturityAmount = Number(fd.maturity_amount || 0);

    await client.query(
      `UPDATE accounts
       SET balance = balance + $1
       WHERE account_id = $2`,
      [maturityAmount, fd.linked_account]
    );

    await client.query(
      `UPDATE fixed_deposits
       SET status = 'CLAIMED'
       WHERE fd_id = $1`,
      [fd_id]
    );

    await client.query("COMMIT");

    res.json({ success: true });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("FD CLAIM ERROR:", err);
    res.status(400).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
}

/* ================= FD DETAILS ================= */

export async function getFDDetails(req, res) {
  try {
    if (!data.checkuser(req)) {
      return res.redirect("/login");
    }

    const customerId = req.session.customer.customer_id;
    const fd_id = req.params.id;

    const fdResult = await pool.query(
      `SELECT fd.*, acc.account_number
       FROM fixed_deposits fd
       JOIN accounts acc ON acc.account_id = fd.linked_account
       WHERE fd.fd_id = $1
         AND fd.customer_id = $2`,
      [fd_id, customerId]
    );

    if (!fdResult.rows.length) {
      return res.status(403).send("Unauthorized");
    }

    const fd = fdResult.rows[0];
    const interestAmount =
      Number(fd.maturity_amount || 0) - Number(fd.amount || 0);

    return res.render("fd-details.ejs", {
      user: true,
      Customers: req.session.customer,
      id: customerId,
      fd: {
        ...fd,
        tenure: fd.duration_months,
        interest_amount: interestAmount.toFixed(2),
        monthly_interest: (interestAmount / fd.duration_months).toFixed(2)
      }
    });

  } catch (err) {
    console.error("FD DETAILS ERROR:", err);
    res.status(500).send("Server error");
  }
}
