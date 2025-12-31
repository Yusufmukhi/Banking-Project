import express from 'express';
import {user} from './homes.controller.js';
const router = express.Router();

router.get("/",user);

export default router;
