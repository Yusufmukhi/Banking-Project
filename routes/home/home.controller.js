import * as cust from "../user/user.js";

/* =========================================================
   USER DASHBOARD CONTROLLER
========================================================= */
export async function user(req, res) {
  try {

    // AUTH CHECK
    if (!cust.checkuser(req)) {
      return res.render("guest.ejs");
    }

    const id = req.session.customer.customer_id;

    // CUSTOMER
    const customer = await cust.getCustomer(id);
    console.log(customer);

    if (customer === null) {
      return res.redirect("/login");
    }

    // ACCOUNTS
    const accounts = await cust.getAccounts(id);

    // ❌ BUG FIX ONLY (no variable name change)
    // was: acc.account_type="Savings Account"
    const savings = accounts.find(
      acc => acc.account_type === "Savings Account"
    );
    console.log(savings);
    

    // OTHER DATA (unchanged variable names)
    const upi_accounts = await cust.getUpiAccounts(id);
    const Emi = await cust.getEMIPayments(id);
    const loans = await cust.getLoans(id);
    const fd = await cust.getFD(id);
    const rd = await cust.getRD(id);

    console.log(Emi);
   const transactions = await cust.getAllTransactions(id);
   console.log(transactions);
   
    // RENDER (unchanged keys)
    return res.render("dashboard.ejs", {
      user: req.session.customer,
      Savings: savings,
      Customers: customer,
      upi_accounts: upi_accounts,
      rd: rd,
      fd: fd,
      emi: Emi,
      id,
      trans: transactions,
    });

  } catch (err) {
    console.error("[DASHBOARD ERROR]", err);
    return res.status(500).render("error.ejs", {
      message: "Unable to load dashboard"
    });
  }
}
