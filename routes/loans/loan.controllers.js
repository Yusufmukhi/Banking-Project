import pool from "../../config/pgPool.js";
import * as data from "../user/user.js";

/* ================= LOANS DASHBOARD ================= */

export async function getLoans(req, res) {
  try {
    data.checkuser(req);
    const id = req.params.id;

    const customer = await data.getCustomer(id);
    if (!customer) return res.status(404).render("404");

    const loanRes = await pool.query(
      `SELECT *
       FROM loans
       WHERE customer_id = $1
       AND status = 'ACTIVE'
       ORDER BY created_at DESC`,
      [id]
    );

    const loans = loanRes.rows;

    for (const loan of loans) {
      const emiRes = await pool.query(
        `SELECT
          COUNT(*) FILTER (WHERE status = 'PAID') AS paid_count,
          COUNT(*) FILTER (WHERE status IN ('PENDING','OVERDUE')) AS pending_count,
          MIN(payout_date) FILTER (WHERE status = 'PENDING') AS next_emi_date,
          COALESCE(SUM(penalty_amount), 0) AS total_penalty
         FROM emi_payouts
         WHERE loan_id = $1`,
        [loan.loan_id]
      );

      const emi = emiRes.rows[0];

      loan.paid_emis = Number(emi.paid_count || 0);
      loan.pending_emis = Number(emi.pending_count || 0);
      loan.remaining_emis = loan.tenure_months - loan.paid_emis;
      loan.next_emi_date = emi.next_emi_date;
      loan.total_penalty = Number(emi.total_penalty || 0);
    }

    let totalOutstanding = 0;
    let nextEMI = 0;
    let totalPenalties = 0;

    loans.forEach((loan) => {
      totalOutstanding += Number(loan.loan_amount || 0);
      nextEMI += Number(loan.emi_amount || 0);
      totalPenalties += Number(loan.total_penalty || 0);
    });

    return res.render("loans.ejs", {
  id,
  Customers: customer,
  Loans: loans,
  TotalOutstanding: totalOutstanding.toLocaleString("en-IN"),
  NextEMI: nextEMI.toLocaleString("en-IN"),
  TotalPenalties: totalPenalties.toLocaleString("en-IN"),
  Accounts: await data.getAccounts(id),
});

  } catch (err) {
    console.error("[GET LOANS ERROR]", err.message);
    return res.status(500).render("error", {
      message: "Error fetching loans",
    });
  }
}

/* ================= EMI LIST (JSON) ================= */

export async function getLoanEMIs(req, res) {
  try {
    data.checkuser(req);
    const { id, loanId } = req.params;

    const loanCheck = await pool.query(
      `SELECT 1 FROM loans
       WHERE loan_id = $1 AND customer_id = $2`,
      [loanId, id]
    );

    if (!loanCheck.rows.length) {
      return res.status(404).json({ error: "Loan not found" });
    }

    const emiRes = await pool.query(
      `SELECT *
       FROM emi_payouts
       WHERE loan_id = $1
       ORDER BY payout_date ASC`,
      [loanId]
    );

    return res.json({ emis: emiRes.rows });
  } catch (err) {
    console.error("[GET EMI ERROR]", err.message);
    return res.status(500).json({ error: "Error fetching EMIs" });
  }
}

/* ================= APPLY LOAN PAGE ================= */

export async function applyLoanPage(req, res) {
  try {
    data.checkuser(req);
    const id = req.params.id;

    const customer = await data.getCustomer(id);
    const accRes = await pool.query(
      `SELECT * FROM accounts
       WHERE customer_id = $1 AND status = 'ACTIVE'`,
      [id]
    );

    return res.render("apply-loan.ejs", {
      id,
      Customers: customer,
      Accounts: accRes.rows,
    });
  } catch (err) {
    console.error("[APPLY LOAN PAGE ERROR]", err.message);
    return res.status(500).render("error", {
      message: "Error loading loan application",
    });
  }
}

/* ================= SUBMIT LOAN ================= */

export async function submitLoanApplication(req, res) {
  const client = await pool.connect();

  try {
    data.checkuser(req);
    const { id } = req.params;

    const {
      loan_type,
      loan_amount,
      interest_rate,
      tenure_months,
      linked_account,
    } = req.body;

    const accCheck = await client.query(
      `SELECT 1 FROM accounts
       WHERE account_id = $1
       AND customer_id = $2
       AND status = 'ACTIVE'`,
      [linked_account, id]
    );

    if (!accCheck.rows.length) {
      return res.render("apply-loan.ejs", {
        id,
        Customers: await data.getCustomer(id),
        Accounts: await data.getAccounts(id),
        error: "Invalid linked account",
      });
    }

    const monthlyRate = Number(interest_rate) / 12 / 100;
    const principal = Number(loan_amount);
    const months = Number(tenure_months);

    let emi =
      (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
      (Math.pow(1 + monthlyRate, months) - 1);

    emi = Number(emi.toFixed(2));

    await client.query("BEGIN");

    const loanRes = await client.query(
      `INSERT INTO loans
       (customer_id, linked_account, loan_type, loan_amount,
        interest_rate, tenure_months, emi_amount,
        start_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),'ACTIVE')
       RETURNING loan_id`,
      [
        id,
        linked_account,
        loan_type,
        loan_amount,
        interest_rate,
        months,
        emi,
      ]
    );

    const loanId = loanRes.rows[0].loan_id;

    const flagRes = await client.query(
      `SELECT emi_generated FROM loans
       WHERE loan_id = $1 FOR UPDATE`,
      [loanId]
    );

    if (!flagRes.rows[0].emi_generated) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);

      for (let i = 1; i <= months; i++) {
        const date = new Date(start);
        date.setMonth(start.getMonth() + i);

        await client.query(
          `INSERT INTO emi_payouts
           (loan_id, payout_date, emi_amount)
           VALUES ($1,$2,$3)`,
          [loanId, date, emi]
        );
      }

      await client.query(
        "UPDATE loans SET emi_generated = TRUE WHERE loan_id = $1",
        [loanId]
      );
    }

    await client.query("COMMIT");
    return res.redirect(`/loans/${id}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[LOAN APPLY ERROR]", err.message);
    return res.render("error", {
      message: "Loan application failed",
    });
  } finally {
    client.release();
  }
}

/* ================= PAY EMI PAGE ================= */

export async function payEMIPage(req, res) {
  try {
    data.checkuser(req)
    const { id, loanId } = req.params

    /* ---------------- CUSTOMER ---------------- */
    const customer = await data.getCustomer(id)
    if (!customer) return res.status(404).render("404")

    /* ---------------- LOAN ---------------- */
    const loanRes = await pool.query(
      "SELECT * FROM loans WHERE loan_id = $1 AND customer_id = $2",
      [loanId, id]
    )
    if (!loanRes.rows.length) return res.status(404).render("404")

    const loan = loanRes.rows[0]

    /* ---------------- AUTO MARK OVERDUE ---------------- */
    await pool.query(
      `
      UPDATE emi_payouts
      SET status = 'OVERDUE'
      WHERE loan_id = $1
        AND status = 'PENDING'
        AND payout_date < CURRENT_DATE
      `,
      [loanId]
    )

    /* ---------------- PENDING / OVERDUE EMIs ---------------- */
    const pendingRes = await pool.query(
      `
      SELECT ep.*, l.loan_type, l.linked_account
      FROM emi_payouts ep
      JOIN loans l ON l.loan_id = ep.loan_id
      WHERE ep.loan_id = $1
        AND ep.status IN ('PENDING','OVERDUE')
      ORDER BY ep.payout_date ASC
      `,
      [loanId]
    )

    /* ---------------- PAID EMIs ---------------- */
    const paidRes = await pool.query(
      `
      SELECT ep.*
      FROM emi_payouts ep
      WHERE ep.loan_id = $1
        AND ep.status = 'PAID'
      ORDER BY ep.paid_date DESC
      `,
      [loanId]
    )

    /* ---------------- SUMMARY CALCULATION ---------------- */
    let TotalPending = 0
    let OverduePenalty = 0

    pendingRes.rows.forEach(emi => {
      TotalPending += Number(emi.emi_amount)
      OverduePenalty += Number(emi.penalty_amount || 0)
    })

    /* ---------------- ACCOUNT BALANCE ---------------- */
    const accRes = await pool.query(
      "SELECT balance FROM accounts WHERE account_id = $1",
      [loan.linked_account]
    )

    const AccountBalance =
      accRes.rows.length > 0 ? Number(accRes.rows[0].balance) : 0

    /* ---------------- RENDER ---------------- */
    return res.render("pay-emi.ejs", {
      id,
      loanId,
      Customers: customer,
      PendingEMIs: pendingRes.rows,
      PaidEMIs: paidRes.rows,
      TotalPending: TotalPending.toLocaleString("en-IN"),
      OverduePenalty: OverduePenalty.toLocaleString("en-IN"),
      AccountBalance: AccountBalance.toLocaleString("en-IN")
    })

  } catch (err) {
    console.log(err);
    
    console.error("[PAY EMI PAGE ERROR]", err.message)
    return res.status(500).render("error.ejs", {
      message: "Error loading EMI payment page"
    })
  }
}


/* ================= SUBMIT EMI PAYMENT ================= */

export async function submitEMIPayment(req, res) {
  const client = await pool.connect();

  try {
    data.checkuser(req);
    const { id } = req.params;
    const { payout_id, account_id } = req.body;

    await client.query("BEGIN");

    const emiRes = await client.query(
      `SELECT e.*, l.customer_id
       FROM emi_payouts e
       JOIN loans l ON l.loan_id = e.loan_id
       WHERE e.payout_id = $1
       AND l.customer_id = $2
       FOR UPDATE`,
      [payout_id, id]
    );

    if (!emiRes.rows.length) {
      throw new Error("Invalid EMI");
    }

    const emi = emiRes.rows[0];
    const debit = Number(emi.emi_amount) + Number(emi.penalty_amount || 0);

    const accRes = await client.query(
      "SELECT balance FROM accounts WHERE account_id = $1 FOR UPDATE",
      [account_id]
    );

    if (accRes.rows[0].balance < debit) {
      throw new Error("Insufficient balance");
    }

    const newBalance = accRes.rows[0].balance - debit;

    await client.query(
      "UPDATE accounts SET balance = $1 WHERE account_id = $2",
      [newBalance, account_id]
    );

    await client.query(
      `INSERT INTO transactions
       (account_id, tx_type, amount, balance_after, remarks)
       VALUES ($1,'DEBIT',$2,$3,$4)`,
      [account_id, debit, newBalance, `EMI Payment | Loan ${emi.loan_id}`]
    );

    await client.query(
      "UPDATE emi_payouts SET status = 'PAID', paid_date = NOW() WHERE payout_id = $1",
      [payout_id]
    );

    await client.query("COMMIT");
    return res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}

/* ================= LOAN DETAILS ================= */

export async function loanDetailsPage(req, res) {
  try {
    data.checkuser(req);
    const { id, loanId } = req.params;

    const customer = await data.getCustomer(id);

    const loanRes = await pool.query(
      "SELECT * FROM loans WHERE loan_id = $1 AND customer_id = $2",
      [loanId, id]
    );

    const emiRes = await pool.query(
      "SELECT * FROM emi_payouts WHERE loan_id = $1 ORDER BY payout_date ASC",
      [loanId]
    );

    return res.render("loan-details.ejs", {
      id,
      Customers: customer,
      Loan: loanRes.rows[0],
      EMISchedule: emiRes.rows,
    });
  } catch (err) {
    console.error("[LOAN DETAILS ERROR]", err.message);
    return res.status(500).render("error", {
      message: "Error loading loan details",
    });
  }
}
