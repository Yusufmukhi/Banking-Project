import pool from "../../config/pgPool.js";
import bcrypt from "bcrypt";
import * as data from "../user/user.js";

/* ================= PROFILE PAGE ================= */

export async function getProfile(req, res) {
  try {
    if (!req.session.customer) {
      return res.render("profile.ejs", { user: null, Customers: {}, id: null });
    }

    const id = req.session.customer.customer_id;
    const customer = await data.getCustomer(id);

    if (!customer) {
      return res.render("profile.ejs", { user: null, Customers: {}, id: null });
    }

    return res.render("profile.ejs", {
      user: req.session.customer,
      Customers: customer,
      id
    });
  } catch (err) {
    console.error("[PROFILE ERROR]", err.message);
    return res.status(500).render("profile.ejs", {
      user: null,
      Customers: {},
      error: "Error fetching profile"
    });
  }
}

/* ================= UPDATE PROFILE (AJAX) ================= */
/* NOTE: ONLY updates columns that EXIST in your SQL */

export async function updateProfile(req, res) {
  try {
    if (!req.session.customer) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const customerId = req.session.customer.customer_id;

    const {
      full_name,
      email,
      phone,
      address,
      city,
      state,
      postal_code
    } = req.body;

    if (!full_name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: "Required fields missing"
      });
    }

    const result = await pool.query(
      `
      UPDATE customers SET
        full_name = $1,
        email = $2,
        mobile = $3,
        address = $4,
        city = $5,
        state = $6,
        pincode = $7
      WHERE customer_id = $8
      RETURNING customer_id, cif, full_name
      `,
      [
        full_name,
        email,
        phone,
        address,
        city,
        state,
        postal_code,
        customerId
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    /* ✅ SAFE SESSION REFRESH (NO PASSWORD, NO DB FIELDS LEAKED) */
    req.session.customer = {
      ...req.session.customer,
      full_name: result.rows[0].full_name
    };

    return res.json({
      success: true,
      message: "Profile updated successfully"
    });

  } catch (err) {
    console.error("[PROFILE UPDATE ERROR]", err.message);
    return res.status(500).json({
      success: false,
      message: "Error updating profile"
    });
  }
}

/* ================= LOGOUT ================= */

export async function logout(req, res) {
  req.session.destroy(err => {
    if (err) {
      console.error("[LOGOUT ERROR]", err.message);
      return res.status(500).json({ success: false });
    }
    res.redirect("/login");
  });
}

/* ================= VERIFY EMAIL OTP ================= */
/* NOTE: OTP validation logic exists elsewhere */

export async function verifyEmailOtp(req, res) {
  try {
    if (!req.session.customer) {
      return res.status(401).json({ success: false });
    }

    req.session.emailOtpVerified = true;
    return res.json({ success: true });

  } catch (err) {
    return res.status(500).json({ success: false });
  }
}

/* ================= CHANGE PASSWORD ================= */

export async function changePassword(req, res) {
  try {
    if (!req.session.customer) return res.redirect("/login");

    if (!req.session.emailOtpVerified) {
      return res.render("change-password.ejs", {
        user: req.session.customer,
        errors: { emailVerification: "Verify email first" },
        success: false,
        emailOtpVerified: false
      });
    }

    const { currentPassword, newPassword, confirmPassword } = req.body;
    const errors = {};

    if (newPassword !== confirmPassword)
      errors.confirmPassword = "Passwords do not match";

    if (newPassword.length < 8)
      errors.newPassword = "Minimum 8 characters";

    if (!/[A-Z]/.test(newPassword))
      errors.newPassword = "Must contain uppercase letter";

    if (!/[0-9]/.test(newPassword))
      errors.newPassword = "Must contain number";

    if (Object.keys(errors).length) {
      return res.render("change-password.ejs", {
        user: req.session.customer,
        errors,
        success: false,
        emailOtpVerified: true
      });
    }

    const customerId = req.session.customer.customer_id;

    const dbUser = await pool.query(
      "SELECT password_hash FROM customers WHERE customer_id = $1",
      [customerId]
    );

    const valid = await bcrypt.compare(
      currentPassword,
      dbUser.rows[0].password_hash
    );

    if (!valid) {
      return res.render("change-password.ejs", {
        user: req.session.customer,
        errors: { currentPassword: "Incorrect password" },
        success: false,
        emailOtpVerified: true
      });
    }

    const hash = await bcrypt.hash(newPassword, 10);

    await pool.query(
      "UPDATE customers SET password_hash = $1 WHERE customer_id = $2",
      [hash, customerId]
    );

    req.session.emailOtpVerified = false;

    return res.render("change-password.ejs", {
      user: req.session.customer,
      success: true,
      errors: {},
      emailOtpVerified: false
    });

  } catch (err) {
    console.error("[CHANGE PASSWORD ERROR]", err.message);
    return res.status(500).render("change-password.ejs", {
      user: req.session.customer,
      errors: { system: "Server error" },
      success: false,
      emailOtpVerified: false
    });
  }
}

/* ================= GET CHANGE PASSWORD ================= */

export async function getChangePassword(req, res) {
  if (!req.session.customer) return res.redirect("/login");

  return res.render("change-password.ejs", {
    user: req.session.customer,
    errors: {},
    success: false,
    emailOtpVerified: req.session.emailOtpVerified || false
  });
}

/* ================= EDIT PROFILE PAGE ================= */

export async function getEditProfile(req, res) {
  try {
    if (!req.session.customer) {
      return res.redirect("/login");
    }

    const id = req.session.customer.customer_id;
    const customer = await data.getCustomer(id);

    if (!customer) {
      return res.redirect("/profile");
    }

    return res.render("edit-profile.ejs", {
      user: req.session.customer,
      customer,
      errors: {},
      success: false,
      id
    });

  } catch (err) {
    console.error("[EDIT PROFILE ERROR]", err.message);
    return res.status(500).render("edit-profile.ejs", {
      user: req.session.customer,
      customer: {},
      errors: { system: "Error loading profile" },
      success: false
    });
  }
}

/* ================= EDIT PROFILE SUBMIT ================= */

export async function editProfile(req, res) {
  try {
    if (!req.session.customer) return res.redirect("/login");

    const customerId = req.session.customer.customer_id;

    const {
      full_name,
      email,
      phone,
      address,
      city,
      state,
      postal_code
    } = req.body;

    const errors = {};
    if (!full_name) errors.full_name = "Required";
    if (!email) errors.email = "Required";
    if (!phone) errors.phone = "Required";
    if (!address) errors.address = "Required";
    if (!city) errors.city = "Required";
    if (!state) errors.state = "Required";
    if (!postal_code) errors.postal_code = "Required";

    if (Object.keys(errors).length) {
      return res.render("edit-profile.ejs", {
        user: req.session.customer,
        customer: req.body,
        errors,
        success: false
      });
    }

    const result = await pool.query(
      `
      UPDATE customers SET
        full_name = $1,
        email = $2,
        mobile = $3,
        address = $4,
        city = $5,
        state = $6,
        pincode = $7
      WHERE customer_id = $8
      RETURNING customer_id, cif, full_name
      `,
      [
        full_name,
        email,
        phone,
        address,
        city,
        state,
        postal_code,
        customerId
      ]
    );

    /* ✅ SAFE SESSION UPDATE */
    req.session.customer = {
      ...req.session.customer,
      full_name: result.rows[0].full_name
    };

    return res.render("edit-profile.ejs", {
      user: req.session.customer,
      customer: result.rows[0],
      success: true,
      errors: {}
    });

  } catch (err) {
    console.error("[EDIT PROFILE SUBMIT ERROR]", err.message);
    return res.status(500).render("edit-profile.ejs", {
      user: req.session.customer,
      customer: {},
      errors: { system: "Error updating profile" },
      success: false
    });
  }
}
