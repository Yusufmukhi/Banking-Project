import jwt from "jsonwebtoken";

export function auth(req, res, next) {
  const token = req.cookies.auth_token;

  if (!token) return res.redirect("/login");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 🔑 MAP JWT → req.customer (SESSION COMPATIBLE)
    req.customer = {
      customer_id: decoded.customer_id,
      cif: decoded.cif,
    };

    next();
  } catch (err) {
    return res.redirect("/login");
  }
}
