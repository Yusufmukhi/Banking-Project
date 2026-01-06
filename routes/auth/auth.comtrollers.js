import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../../config/pgPool.js";
import {
  generateAccountNumber,
  generateCustomerid,
  generateIFSC,
  is18OrOlder,
} from "../functions/account-generator.js";

/* =========================================================
   SIGNUP CONTROLLER
========================================================= */
export async function signuser(req, res) {
  const {
    name,
    tel,
    email,
    userId,
    password,
    confirmPassword,
    dob,
    address,
    city,
    state,
    pincode,
    branch,
    Aadhaar,
    PAN,
    Monthly,
    initialAmount,
    Username,
    Gender,
  } = req.body;

  const errors = {};

  /* ---------- EMAIL & PHONE VERIFICATION ---------- */
  if (!req.session?.verifiedEmail || req.session.verifiedEmail !== email) {
    errors.email = "Please verify your email";
  }

  if (!req.session?.verifiedPhone || req.session.verifiedPhone !== tel) {
    errors.tel = "Please verify your phone number";
  }

  /* ---------- BASIC VALIDATIONS ---------- */
  if (!name) errors.name = "Full name is required";
  if (!Username) errors.Username = "Username is required";
  if (!userId) errors.userId = "User ID is required";
  if (!dob) errors.dob = "Date of birth is required";
  if (!branch) errors.branch = "Branch is required";
  if (!Aadhaar) errors.Aadhaar = "Aadhaar is required";
  if (!PAN) errors.PAN = "PAN is required";
  if (!password) errors.password = "Password is required";
  if (password !== confirmPassword)
    errors.password = "Passwords do not match";

  if (dob && !is18OrOlder(dob)) {
    errors.dob = "You must be 18 or older to open an account";
  }

  if (Object.keys(errors).length > 0) {
    return res.render("signup.ejs", {
      errors,
      old: req.body,
      verifiedEmail: req.session?.verifiedEmail || null,
      verifiedPhone: req.session?.verifiedPhone || null,
    });
  }

  const [branchNumber, branchName] = branch.split("|");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /* ---------- DUPLICATE CHECKS ---------- */
    const duplicateChecks = [
      { field: "email", value: email },
      { field: "mobile", value: tel },
      { field: "userid", value: userId },
      { field: "aadhaar", value: Aadhaar },
      { field: "pan", value: PAN },
    ];

    for (const check of duplicateChecks) {
      const result = await client.query(
        `SELECT 1 FROM customers WHERE ${check.field} = $1`,
        [check.value]
      );
      if (result.rows.length > 0) {
        errors[check.field] = `${check.field.toUpperCase()} already exists`;
        throw new Error("Duplicate data");
      }
    }

    /* ---------- GENERATE BANK DETAILS ---------- */
    const accountNumber = await generateAccountNumber();
    const cif = await generateCustomerid();
    const ifsc = await generateIFSC(branchNumber);

    /* ---------- HASH PASSWORD ---------- */
    const passwordHash = await bcrypt.hash(password, 10);

    /* ---------- INSERT CUSTOMER ---------- */
    const customerInsert = await client.query(
      `
      INSERT INTO customers (
        full_name,
        mobile,
        email,
        userid,
        password_hash,
        dob,
        address,
        city,
        state,
        pincode,
        aadhaar,
        pan,
        monthly_income,
        username,
        gender,
        cif,
        verification_email,
        verification_phone
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18
      )
      RETURNING customer_id
      `,
      [
        name,
        tel,
        email,
        userId,
        passwordHash,
        dob,
        address,
        city,
        state,
        pincode,
        Aadhaar,
        PAN,
        Monthly,
        Username,
        Gender,
        cif,
        req.session.verifiedEmail,
        req.session.verifiedPhone,
      ]
    );

    const customerId = customerInsert.rows[0].customer_id;

    /* ---------- CREATE ACCOUNT ---------- */
    await client.query(
      `
      INSERT INTO accounts (
        customer_id,
        account_number,
        account_type,
        ifsc,
        branch,
        balance
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      `,
      [
        customerId,
        accountNumber,
        "Savings Account",
        ifsc,
        branchName,
        Number(initialAmount) || 0,
      ]
    );

    await client.query("COMMIT");

    /* ---------- TEMP SUCCESS DATA ---------- */
    req.session.signupSuccess = {
      name,
      cif,
      accno: accountNumber,
      ifsc,
      branch: branchName,
      balance: Number(initialAmount) || 0,
    };

    req.session.verifiedEmail = null;
    req.session.verifiedPhone = null;

    res.redirect("/signup-success");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[SIGNUP ERROR]", err);

    res.render("signup.ejs", {
      errors,
      old: req.body,
      verifiedEmail: req.session?.verifiedEmail || null,
      verifiedPhone: req.session?.verifiedPhone || null,
      phoneEmailClientId: process.env.PHONE_EMAIL_CLIENT_ID,
    });
  } finally {
    client.release();
  }
}

/* =========================================================
   LOGIN CONTROLLER (JWT)
========================================================= */
export async function loginuser(req, res) {
  const { id, password } = req.body;
  const errors = {};

  if (!id || !password) {
    errors.login = "User ID / CIF / Email / Mobile and password are required";
    return res.render("login.ejs", { errors, old: req.body });
  }

  try {
    const result = await pool.query(
      `
      SELECT customer_id, cif, full_name, password_hash
      FROM customers
      WHERE userid = $1
         OR cif = $1
         OR email = $1
         OR mobile = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      errors.login = "Invalid credentials";
      return res.render("login.ejs", { errors, old: req.body });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      errors.login = "Invalid credentials";
      return res.render("login.ejs", { errors, old: req.body });
    }

    /* ---------- CREATE JWT ---------- */
    const token = jwt.sign(
      {
        customer_id: user.customer_id,
        cif: user.cif,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    /* ---------- SET COOKIE ---------- */
    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: true, // REQUIRED on Vercel
      sameSite: "strict",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    res.redirect("/");
  } catch (err) {
    console.error("[LOGIN ERROR]", err);
    res.render("login.ejs", {
      errors: { login: "Something went wrong. Try again." },
      old: req.body,
    });
  }
}

/* =========================================================
   EMAIL & PHONE VERIFICATION
========================================================= */
export function verifyEmail(req, res) {
  const { email } = req.body;
  if (!email) {
    return res.json({ success: false, message: "Email required" });
  }
  req.session.verifiedEmail = email;
  res.json({ success: true });
}

export function verifyPhone(req, res) {
  const { phone } = req.body;
  if (!phone) {
    return res.json({ success: false, message: "Phone required" });
  }
  req.session.verifiedPhone = phone;
  res.json({ success: true });
}

/* =========================================================
   SIGNUP SUCCESS PAGE
========================================================= */
export function showSuccess(req, res) {
  if (!req.session?.signupSuccess) {
    return res.redirect("/signup");
  }
  res.render("signup-success.ejs", {
    account: req.session.signupSuccess,
  });
}
