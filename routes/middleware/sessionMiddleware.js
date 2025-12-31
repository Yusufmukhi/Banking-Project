// import session from "express-session";
// import pgSession from "connect-pg-simple";
// import db from "../../config/db.js"; // <-- your PostgreSQL connection

// const PgSession = pgSession(session);

// export const sessionMiddleware = session({
//   store: new PgSession({
//     pool: db,
//     tableName: "user_sessions"
//   }),
//   secret: "supersecretkey",
//   resave: false,
//   saveUninitialized: false,
//   cookie: {
//     maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
//   }
// });
import session from "express-session";
import pgSession from "connect-pg-simple";
import pool from "../../config/pgPool.js";

const PgSession = pgSession(session);

export const sessionMiddleware = session({
  store: new PgSession({
    pool,
    tableName: "user_sessions",
  }),
  secret: "supersecretkey",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
});
