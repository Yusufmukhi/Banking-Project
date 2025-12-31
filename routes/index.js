import express from 'express';
import auth from './auth/auth.routes.js';
import home from './home/home.routes.js';
import accounts from './accounts/accounts.router.js';
import upi from './upi/upi.routes.js';
import rd from './rd/rd-routes.js';
import fd from './fd/fd-routes.js';
import loan from './loans/loan.routes.js';
import transfer from './transfer/transfer.routes.js';
import profile from './profile/profile.routes.js';

const router = express.Router();
router.get("/", (req, res) => {
  if (!req.session.customer) {
    return res.redirect("/login");
  }
  return res.redirect("/");
});

router.use("/",auth);
router.use("/",home);
router.use("/",accounts)
router.use("/",upi)
router.use("/",rd)
router.use("/",fd)
router.use("/",loan)
router.use("/",transfer)
router.use("/",profile)




export default router;  