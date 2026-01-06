import jwt from "jsonwebtoken";

export function auth(req, res, next) {
  const token = req.cookies.auth_token;

  if (!token) return res.redirect("/login");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ CREATE A FAKE SESSION OBJECT (COMPAT MODE)
    req.session = {
      customer: {
        customer_id: decoded.customer_id,
        cif: decoded.cif,
      },
    };

    // (optional) also expose directly
    req.customer = req.session.customer;

    next();
  } catch (err) {
    return res.redirect("/login");
  }
}
