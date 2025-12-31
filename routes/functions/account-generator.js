import pool from "../../config/pgPool.js";
import axios from "axios";

/* =========================================================
   RANDOM GENERATORS (UNCHANGED)
========================================================= */

export function AccountNumber() {
  const base = Math.floor(1000000000 + Math.random() * 9000000000); // 10-digit
  return base;
}

function Customerid() {
  const base = Math.floor(1000000000 + Math.random() * 9000000000); // 10-digit
  return base;
}

export function generateTransactionID() {
  const date = new Date();
  const formattedDate = date
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");
  const randomPart = Math.floor(100000 + Math.random() * 900000);
  return `TXN${formattedDate}-${randomPart}`;
}

/* =========================================================
   UNIQUE CUSTOMER ID (CIF)
========================================================= */

export async function generateCustomerid() {
  let cif = Customerid();

  while (true) {
    const result = await pool.query(
      "SELECT 1 FROM customers WHERE cif = $1",
      [cif]
    );

    if (result.rows.length === 0) {
      return cif;
    }

    cif = Customerid();
  }
}

/* =========================================================
   UNIQUE ACCOUNT NUMBER
========================================================= */

export async function generateAccountNumber() {
  let accno = AccountNumber();

  while (true) {
    const result = await pool.query(
      "SELECT 1 FROM accounts WHERE account_number = $1",
      [accno]
    );

    if (result.rows.length === 0) {
      return accno;
    }

    accno = AccountNumber();
  }
}

/* =========================================================
   UNIQUE IFSC GENERATION
========================================================= */

export async function generateIFSC(branchNumber) {
  const bankCode = "BTIN";
  let ifsc = `${bankCode}0${String(branchNumber).padStart(6, "0")}`;

  while (true) {
    const result = await pool.query(
      "SELECT 1 FROM accounts WHERE ifsc = $1",
      [ifsc]
    );

    if (result.rows.length === 0) {
      return ifsc;
    }

    branchNumber++;
    ifsc = `${bankCode}0${String(branchNumber).padStart(6, "0")}`;
  }
}

/* =========================================================
   AGE VALIDATION
========================================================= */

export function is18OrOlder(dob) {
  const birth = new Date(dob);
  const today = new Date();

  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birth.getDate())
  ) {
    age--;
  }

  return age >= 18;
}
