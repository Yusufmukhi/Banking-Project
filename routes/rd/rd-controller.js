import pool from "../../config/pgPool.js"
import * as data from "../user/user.js"

/* ================= Create RD ================= */

export async function createrd(req, res) {
  data.checkuser(req)

  const customerId = req.session.customer.customer_id
  console.log(customerId);
  const Savings = await data.getAccounts(customerId)
  

  return res.render("create-rd.ejs", {
    user: false,
    Customers: req.session.customer,
    id: customerId,
    Savings,
  })
}

/* ================= POST Create RD ================= */

export async function postcreaterd(req, res) {
  const client = await pool.connect()

  try {
    data.checkuser(req)

    const customerId = req.session.customer.customer_id
    const { account_id, monthly_amount, duration, deposit_date, payout_frequency } = req.body

    const [year, interest_rate] = duration.split("||")
    const duration_months = Number(year) * 12
    const rate = Number(interest_rate)

    await client.query("BEGIN")

    const result = await client.query(
      `INSERT INTO recurring_deposits
       (customer_id, linked_account, monthly_amount, interest_rate,
        duration_months, start_date, payout_method, deposit_day)
       VALUES ($1,$2,$3,$4,$5,NOW(),$6,$7)
       RETURNING rd_id`,
      [
        customerId,
        account_id,
        monthly_amount,
        rate,
        duration_months,
        payout_frequency.toUpperCase(),
        deposit_date,
      ]
    )

    await client.query("COMMIT")
    return res.redirect(`/rd-success/${result.rows[0].rd_id}`)

  } catch (err) {
    console.log(err);
    
    await client.query("ROLLBACK")
    console.log("Create RD error:", err.message)
    res.send("Server error")
  } finally {
    client.release()
  }
}

/* ================= RD Success ================= */

export async function successrd(req, res) {
  data.checkuser(req)

  const customerId = req.session.customer.customer_id
  const rd_id = req.params.id

  const result = await pool.query(
    `SELECT * FROM recurring_deposits
     WHERE rd_id=$1 AND customer_id=$2`,
    [rd_id, customerId]
  )

  if (!result.rows.length) return res.status(403).send("Unauthorized")

  return res.render("rd-success.ejs", {
    Customers: req.session.customer,
    id: customerId,
    rdData: result.rows[0],
  })
}

/* ================= RD Details ================= */

export async function getrdDetails(req, res) {
  data.checkuser(req)

  const customerId = req.session.customer.customer_id
  const rd_id = req.params.id

  const rdResult = await pool.query(
    `SELECT * FROM recurring_deposits
     WHERE rd_id=$1 AND customer_id=$2`,
    [rd_id, customerId]
  )

  if (!rdResult.rows.length) return res.status(403).send("Unauthorized")

  const rd = rdResult.rows[0]

  const paidResult = await pool.query(
    `SELECT COUNT(*) 
     FROM rd_deposit_transactions 
     WHERE rd_id=$1 AND status='PAID'`,
    [rd_id]
  )

  const paidMonths = Number(paidResult.rows[0].count)
  const totalDeposits = paidMonths * Number(rd.monthly_amount)
  const interestEarned =
    (totalDeposits * rd.interest_rate * paidMonths) / (12 * 100)
  const maturityAmount = totalDeposits + interestEarned

  const schedule = await pool.query(
    `SELECT * FROM rd_payout_schedule
     WHERE rd_id=$1
     ORDER BY scheduled_date`,
    [rd_id]
  )
console.log(schedule);
console.log("Paid Motnhs",paidMonths);


  return res.render("rd-detailes.ejs", {
    Customers: req.session.customer,
    id: customerId,
    rd,
    totalDeposits: totalDeposits.toFixed(2),
    interestEarned: interestEarned.toFixed(2),
    maturityAmount: maturityAmount.toFixed(2),
    Paidmonths: paidMonths,
    payment_schedule: schedule.rows,
    maturity: paidMonths === rd.duration_months,
  })
}

/* ================= RD CLAIM PAGE ================= */

export async function maturityrd(req, res) {
  data.checkuser(req)

  const customerId = req.session.user.customer_id

  const rdResult = await pool.query(
    "SELECT * FROM recurring_deposits WHERE customer_id=$1 ORDER BY rd_id ASC",
    [customerId]
  )

  const fdResult = await pool.query(
    "SELECT * FROM fixed_deposits WHERE customer_id=$1 ORDER BY fd_id ASC",
    [customerId]
  )

  let rdinterest = 0
  let fdinterest = 0
  let rdclaim = 0
  let fdclaim = 0

  rdResult.rows.forEach(rd => {
    if (rd.status === "ACTIVE" && rd.paid_months === rd.duration_months) {
      rdinterest += Number(rd.monthly_amount) * Number(rd.paid_months)
      rdclaim++
    }
  })

  fdResult.rows.forEach(fd => {
    if (fd.status === "ACTIVE" && new Date(fd.maturity_date) <= new Date()) {
      fdinterest += Number(fd.maturity_amount) - Number(fd.amount)
      fdclaim++
    }
  })

  const interest = rdinterest + fdinterest

  return res.render("rd-claim.ejs", {
    Customers: req.session.user,
    id: customerId,
    maturedRD: rdResult.rows,
    maturedFD: fdResult.rows,
    interest: interest.toFixed(2),
    rdclaim,
    fdclaim,
    rd_payout: [],
    fd_payout: [],
    accounts: await data.getAccounts(customerId),
  })
}

/* ================= Claim RD Maturity ================= */

export async function claimRDMaturity(req, res) {
  const client = await pool.connect()

  try {
    data.checkuser(req)

    const customerId = req.session.user.customer_id
    const { rd_id } = req.body

    await client.query("BEGIN")

    const rdResult = await client.query(
      `SELECT * FROM recurring_deposits
       WHERE rd_id=$1 AND customer_id=$2`,
      [rd_id, customerId]
    )

    if (!rdResult.rows.length) {
      throw new Error("Unauthorized RD claim")
    }

    const rd = rdResult.rows[0]

    const paidResult = await client.query(
      `SELECT COUNT(*) 
       FROM rd_deposit_transactions
       WHERE rd_id=$1 AND status='PAID'`,
      [rd_id]
    )

    const paidMonths = Number(paidResult.rows[0].count)
    const totalDeposits = paidMonths * Number(rd.monthly_amount)
    const interest =
      (totalDeposits * rd.interest_rate * paidMonths) / (12 * 100)
    const maturityAmount = totalDeposits + interest

    await client.query(
      "UPDATE accounts SET balance = balance + $1 WHERE account_id=$2",
      [maturityAmount, rd.linked_account]
    )

    await client.query(
      "UPDATE recurring_deposits SET status='CLAIMED' WHERE rd_id=$1",
      [rd_id]
    )

    await client.query("COMMIT")
    res.json({ success: true })

  } catch (err) {
    await client.query("ROLLBACK")
    console.log("RD Claim error:", err.message)
    res.status(400).json({ success: false, error: err.message })
  } finally {
    client.release()
  }
}



/* ================= PAY RD PAGE ================= */

export async function payRDPage(req, res) {
  try {
    data.checkuser(req);

    const id = req.session.customer.customer_id;
    const customer = await data.getCustomer(id);
    if (!customer) return res.status(404).render("404");

    /* ================= ACCOUNT BALANCE ================= */
    const accRes = await pool.query(
      `SELECT account_id, balance 
       FROM accounts 
       WHERE customer_id=$1 
         AND status='ACTIVE' 
       ORDER BY account_id 
       LIMIT 1`,
      [id]
    );

    const accountBalance = accRes.rows.length
      ? accRes.rows[0].balance
      : 0;

    /* ================= ELIGIBLE RD INSTALLMENTS ================= */
  const rdRes = await pool.query(
  `
  SELECT 
    ps.rd_id,
    ps.payout_amount,
    r.duration_months,
    r.linked_account,
    r.paid_months,
    ps.scheduled_date AS next_payout_date
  FROM rd_payout_schedule ps
  JOIN recurring_deposits r 
    ON ps.rd_id = r.rd_id
  WHERE r.customer_id = $1
    AND ps.status = 'PENDING'
    AND r.status = 'ACTIVE'
    AND r.paid_months < r.duration_months
    AND ps.scheduled_date::date <= (CURRENT_DATE + INTERVAL '7 days')
  ORDER BY ps.scheduled_date ASC
  `,
  [id]
);

 

    const PendingRDs = rdRes.rows;
console.log("Pending Rd",PendingRDs);

    /* ================= CALCULATIONS ================= */
    const PendingRDCount = PendingRDs.length;

    const TotalPendingRD = PendingRDs.reduce(
      (sum, r) => sum + Number(r.monthly_amount),
      0
    );

    const nextRD = PendingRDs[0] || null;

    return res.render("pay-rd.ejs", {
      id,
      user: true,
      Customers: customer,
      PendingRDs,
      PendingRDCount,
      TotalPendingRD: TotalPendingRD.toLocaleString("en-IN"),
      NextRDAmount: nextRD ? nextRD.payout_amount.toLocaleString("en-IN") : "0",
      NextRDDueDate: nextRD
        ? new Date(nextRD.next_payout_date).toLocaleDateString("en-IN")
        : "—",
      AccountBalance: Number(accountBalance).toLocaleString("en-IN")
    });

  } catch (err) {
    console.error("[PAY RD PAGE ERROR]", err);
    return res.status(500).render("error.ejs", {
      message: "Error loading RD payment page"
    });
  }
}


/* ================= SUBMIT RD PAYMENT ================= */

export async function submitRDPayment(req, res) {
  const client = await pool.connect();

  try {
    data.checkuser(req);

    const { id, rdId } = req.params;
    const { account_id, amount } = req.body;

    const payAmount = Number(amount); // ✅ MOVE THIS UP

    if (!account_id || !payAmount || payAmount <= 0) {
      return res.status(400).json({
        error: "Invalid payment amount"
      });
    }

    await client.query("BEGIN");

    /* ================= LOCK RD ================= */
    const rdRes = await client.query(
      `SELECT * FROM recurring_deposits
       WHERE rd_id=$1 AND customer_id=$2 AND status='ACTIVE'
       FOR UPDATE`,
      [rdId, id]
    );
  console.log(rdRes.rows);
  
    if (!rdRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Invalid RD" });
    }
   
    

    /* ================= LOCK ACCOUNT ================= */
    const accRes = await client.query(
      `SELECT balance FROM accounts WHERE account_id=$1 FOR UPDATE`,
      [account_id]
    );
console.log(account_id);

    if (!accRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Invalid account" });
    }

    const balance = Number(accRes.rows[0].balance);

    if (balance < payAmount) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Insufficient balance" });
    }

    const newBalance = balance - payAmount;
    console.log(rdRes.rows[0].next_payout_date);
    
    /* ================= INSERT RD PAYMENT ================= */
    await client.query(
      `INSERT INTO rd_deposit_transactions
       (rd_id,linked_Account, deposit_amount, status, actual_deposit_date,scheduled_date)
       VALUES ($1,$3,$2,'PAID',CURRENT_DATE,$4)`,
      [rdId,account_id, payAmount, rdRes.rows[0].next_payout_date ]
    );

    /* ================= UPDATE ACCOUNT ================= */
    await client.query(
      "UPDATE accounts SET balance=$1 WHERE account_id=$2",
      [newBalance, account_id]
    );

    /* ================= TRANSACTION LOG ================= */
    await client.query(
      `INSERT INTO transactions
       (account_id, tx_type, amount, balance_after, remarks)
       VALUES ($1,'DEBIT',$2,$3,$4)`,
      [
        account_id,
        payAmount,
        newBalance,
        `RD Installment | RD ${rdId}`
      ]
    );

    /* ================= UPDATE RD ================= */
    await client.query(
      `UPDATE recurring_deposits
       SET 
         paid_months = paid_months + 1,
         last_payout_date = CURRENT_DATE,
         next_payout_date = CURRENT_DATE + INTERVAL '1 month'
       WHERE rd_id=$1`,
      [rdId]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      transaction_id: "TXN" + Date.now()
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[RD PAY ERROR]", err.message);
    return res.status(500).json({
      error: err.message
    });
  } finally {
    client.release();
  }
}

