import jwt from "jsonwebtoken";

export function auth(req, res, next) {
  const token = req.cookies.auth_token;

  if (!token) {
    return res.redirect("/login");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.redirect("/login");
  }
}
