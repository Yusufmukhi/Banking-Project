export function tempSession(req, res, next) {
  if (!req.session) {
    req.session = {};
  }
  next();
}
