import pool from "../../config/pgPool.js";
import * as data from "../user/user.js";

/* ================= TRANSFER DASHBOARD ================= */

export async function gettransfer(req, res) {
  data.checkuser(req);

  const id = Number(req.params.id);

  const Customers = await data.getCustomer(id);
  if (!Customers) return res.redirect("/login");

  const Accounts = await data.getAccounts(id);

  const history = await pool.query(
    `SELECT * FROM transfers
     WHERE customer_id = $1
     ORDER BY created_at DESC
     LIMIT 10`,
    [id]
  );

  return res.render("transfer.ejs", {
    id,
    Customers,
    Accounts,
    Transfers: history.rows
  });
}

/* ================= BANK TRANSFER PAGE ================= */

export async function bankTransferPage(req, res) {
  data.checkuser(req);

  const id = Number(req.params.id);

  const Customers = await data.getCustomer(id);
  const Accounts = await data.getAccounts(id);

  return res.render("transfer-bank.ejs", {
    id,
    Customers,
    Accounts
  });
}

/* ================= PROCESS BANK TRANSFER ================= */

export async function processBankTransfer(req, res) {
  const client = await pool.connect();

  try {
    data.checkuser(req);

    const customerId = req.session.customer.customer_id;
    const {
      from_account_id,
      recipient_name,
      recipient_bank,
      recipient_account,
      recipient_ifsc,
      amount,
      remarks,
      confirm
    } = req.body;

    if (!confirm) {
      return res.status(400).send("Confirmation required");
    }

    await client.query("BEGIN");

    /* 🔐 Account ownership + lock */
    const accRes = await client.query(
      `SELECT * FROM accounts
       WHERE account_id = $1 AND customer_id = $2
       FOR UPDATE`,
      [from_account_id, customerId]
    );

    if (accRes.rows.length === 0) {
      throw new Error("Unauthorized account");
    }

    const account = accRes.rows[0];

    if (Number(account.balance) < Number(amount)) {
      throw new Error("Insufficient balance");
    }

    const newBalance = Number(account.balance) - Number(amount);

    /* Debit account */
    await client.query(
      "UPDATE accounts SET balance = $1 WHERE account_id = $2",
      [newBalance, from_account_id]
    );

    /* Ledger entry */
    await client.query(
      `INSERT INTO transactions
       (account_id, tx_type, amount, balance_after, remarks)
       VALUES ($1,'DEBIT',$2,$3,$4)`,
      [
        from_account_id,
        Number(amount),
        newBalance,
        "Bank Transfer"
      ]
    );

    /* Transfer record */
    await client.query(
      `INSERT INTO transfers
       (customer_id, account_id, transfer_method,
        recipient_name, recipient_bank, recipient_account,
        recipient_ifsc, amount, remarks, status)
       VALUES ($1,$2,'BANK',$3,$4,$5,$6,$7,$8,'COMPLETED')`,
      [
        customerId,
        from_account_id,
        recipient_name,
        recipient_bank,
        recipient_account,
        recipient_ifsc,
        Number(amount),
        remarks || null
      ]
    );

    await client.query("COMMIT");
    return res.redirect(`/transfers/${customerId}`);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("BANK TRANSFER ERROR:", err.message);
    return res.status(400).send(err.message);
  } finally {
    client.release();
  }
}

/* ================= UPI TRANSFER PAGE ================= */

export async function upiTransferPage(req, res) {
  data.checkuser(req);

  const id = Number(req.params.id);

  const Customers = await data.getCustomer(id);
  const Accounts = await data.getAccounts(id);

  return res.render("transfer-upi.ejs", {
    id,
    Customers,
    Accounts
  });
}

/* ================= PROCESS UPI TRANSFER ================= */

export async function processUpiTransfer(req, res) {
  const client = await pool.connect();

  try {
    data.checkuser(req);

    const customerId = req.session.customer.customer_id;
    const {
      from_account_id,
      recipient_upi,
      amount,
      remarks,
      confirm
    } = req.body;

    if (!confirm) {
      return res.status(400).send("Confirmation required");
    }

    await client.query("BEGIN");

    const accRes = await client.query(
      `SELECT * FROM accounts
       WHERE account_id = $1 AND customer_id = $2
       FOR UPDATE`,
      [from_account_id, customerId]
    );

    if (accRes.rows.length === 0) {
      throw new Error("Unauthorized account");
    }

    const account = accRes.rows[0];

    if (Number(account.balance) < Number(amount)) {
      throw new Error("Insufficient balance");
    }

    const newBalance = Number(account.balance) - Number(amount);

    await client.query(
      "UPDATE accounts SET balance = $1 WHERE account_id = $2",
      [newBalance, from_account_id]
    );

    await client.query(
      `INSERT INTO transactions
       (account_id, tx_type, amount, balance_after, remarks)
       VALUES ($1,'DEBIT',$2,$3,$4)`,
      [
        from_account_id,
        Number(amount),
        newBalance,
        "UPI Transfer"
      ]
    );

    await client.query(
      `INSERT INTO transfers
       (customer_id, account_id, transfer_method,
        recipient_name, amount, remarks, status)
       VALUES ($1,$2,'UPI',$3,$4,$5,'COMPLETED')`,
      [
        customerId,
        from_account_id,
        recipient_upi,
        Number(amount),
        remarks || null
      ]
    );

    await client.query("COMMIT");
    return res.redirect(`/transfers/${customerId}`);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("UPI TRANSFER ERROR:", err.message);
    return res.status(400).send(err.message);
  } finally {
    client.release();
  }
}
