import pool from "../../config/pgPool.js";
import * as data from "../user/user.js";
import bcrypt from "bcrypt";

/* ================= GET OR CREATE UPI ================= */

export async function getOrCreateUpi(req, res) {
  try {
    data.checkuser(req);

    const customerId = req.session.customer.customer_id;

    const customer = await data.getCustomer(customerId);
    if (!customer) {
      return res.status(404).render("error.ejs", { message: "Customer not found" });
    }

    const upiData = await pool.query(
      `SELECT upi.upi_handle, upi.account_id,
              acc.account_number, acc.account_type, acc.ifsc, acc.balance
       FROM upi_accounts upi
       JOIN accounts acc ON acc.account_id = upi.account_id
       WHERE upi.customer_id = $1
       LIMIT 1`,
      [customerId]
    );

    /* ---------- No UPI → Create ---------- */
    if (upiData.rows.length === 0) {
      const accounts = await data.getAccounts(customerId);
      return res.render("create-upi.ejs", {
        acc: accounts,
        cust: customer,
        error: {},
        id: customerId
      });
    }

    /* ---------- UPI Exists → Show ---------- */
    return res.render("upi.ejs", {
      id: customerId,
      acc: upiData.rows[0],
      cust: customer,
      accid: upiData.rows[0].account_id
    });

  } catch (err) {
    console.error("Error in getOrCreateUpi:", err);
    return res.status(500).render("error.ejs", { message: "Server error" });
  }
}

/* ================= CREATE UPI ================= */

export async function createUpi(req, res) {
  const client = await pool.connect();

  try {
    data.checkuser(req);

    const customerId = req.session.customer.customer_id;
    const { account, upiid, password, cpassword } = req.body;
    const error = {};

    if (!account || !upiid || !password || !cpassword) {
      error.general = "All fields are required";
    }

    const customer = await data.getCustomer(customerId);
    const accounts = await data.getAccounts(customerId);

    /* ---------- Account Ownership ---------- */
    const upiAccount = accounts.find(
      acc => acc.account_id === Number(account)
    );
    if (!upiAccount) {
      error.account = "Invalid account selected";
    }

    /* ---------- Duplicate UPI ---------- */
    const existingUpi = await pool.query(
      "SELECT 1 FROM upi_accounts WHERE upi_handle = $1",
      [upiid]
    );
    if (existingUpi.rows.length > 0) {
      error.upi = "UPI ID already exists";
    }

    /* ---------- PIN Validation ---------- */
    if (password !== cpassword) {
      error.password = "UPI PIN does not match";
    }

    if (!/^\d{4,6}$/.test(password)) {
      error.password = "UPI PIN must be 4–6 digits";
    }

    if (Object.keys(error).length > 0) {
      return res.render("create-upi.ejs", {
        acc: accounts,
        cust: customer,
        error,
        id: customerId
      });
    }

    const hashedPin = await bcrypt.hash(password, 10);

    await client.query("BEGIN");

    await client.query(
      `INSERT INTO upi_accounts
       (customer_id, upi_handle, upi_pin, account_id)
       VALUES ($1,$2,$3,$4)`,
      [customerId, upiid, hashedPin, Number(account)]
    );

    await client.query("COMMIT");

    return res.render("upi-success.ejs", {
      acc: accounts,
      cust: customer,
      success: "UPI Created Successfully",
      id: customerId
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating UPI:", err);

    const customerId = req.session.customer.customer_id;
    const customer = await data.getCustomer(customerId);
    const accounts = await data.getAccounts(customerId);

    return res.render("create-upi.ejs", {
      acc: accounts,
      cust: customer,
      error: { system: "Something went wrong. Try again." },
      id: customerId
    });

  } finally {
    client.release();
  }
}
