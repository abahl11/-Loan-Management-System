# LoanDesk – Loan Management System

LoanDesk is a small web app that a bank or finance company could use to handle loans from start to finish:

1. A **customer** applies for a loan and uploads documents.
2. A **loan officer** checks the application and approves or rejects it.
3. Once approved, the customer pays monthly instalments (EMIs) until the loan is closed.
4. An **admin** manages users, loan types and interest rates, and sees reports.

This is a **backend project**: the main work is the REST API (Node.js + Express + MongoDB). 

Still, to make it easy to visualise and test, a simple **Frontend** (plain HTML/CSS/JavaScript) is also included as a convenience. It only calls the API and has no logic of its own. Everything it does can also be done directly through the API / Swagger docs.

---

## 1. Quickest way to check it – live link

**Live app:** https://loandesk.onrender.com

**API documentation (Swagger):** https://loandesk.onrender.com/api-docs

Nothing to install. Open the link and log in with one of the demo accounts below.

> The app runs on Render's free plan. If nobody has used it for a while it goes to sleep, so the **first load can take up to a minute**. After that it is fast.

---

## 2. Demo accounts and demo data

When the app starts for the first time, it automatically creates this starter data:

**Three users (one for each role):**

| Role | Email | Password |
|---|---|---|
| Admin | admin@loandesk.com | Admin@123 |
| Loan Officer | officer@loandesk.com | Officer@123 |
| Customer | customer@loandesk.com | Customer@123 |

You don't need to type these. The login page has **Admin / Loan Officer / Customer** buttons that fill them in.

**Four loan types:**

| Loan type | Interest (per year) | Amount allowed | Tenure allowed |
|---|---|---|---|
| Home Loan | 7.25% | ₹5,00,000 – ₹2,00,00,000 | 12 – 360 months |
| Personal Loan | 10% | ₹10,000 – ₹25,00,000 | 6 – 60 months |
| Education Loan | 9.15% | ₹50,000 – ₹50,00,000 | 12 – 120 months |
| Vehicle Loan | 8.7% | ₹50,000 – ₹30,00,000 | 12 – 84 months |

The rates are the real starting rates of State Bank of India (SBI) as of October 2026, so the EMIs look realistic. The admin can change any rate from the *Loan Types* page.

**That is all the starter data.** There are no loan applications or payments at the start, so the reports show zeros and the officer's list is empty until someone applies. The walkthrough below creates a loan in about two minutes.

You can also create your own customer account with **Register** on the login page.

---

## 3. Try it in 5 minutes

1. **Customer** – log in as Customer → *Apply for Loan* → pick *Personal Loan*, enter amount `200000` and tenure `24` → *Preview EMI* → *Submit*.
   A window opens for the new loan: upload any PDF/JPG/PNG as a document (e.g. type "ID Proof").
2. **Loan Officer** – log out, log in as Loan Officer → *Applications* → *Open* the loan →
   *Start review* → add a remark → write a note → *Approve*. An EMI schedule is created.
3. **Customer again** – *My Loans* → *Open* → *Pay EMI* (or *Close loan early*) → *Download statement (PDF)*.
4. **Admin** – log in as Admin → see *Reports*, add a user in *Users*, change an interest rate in *Loan Types*, download the CSV report.

> Payments are **simulated**. No real money or payment gateway is involved.

---

## 4. Run it on your own computer (with Docker) – recommended

Docker runs the app **and** its database for you, so you don't need to install Node.js or MongoDB, and it runs the same on every computer.

**Step 1 – Install Docker Desktop** (one time)
Download it from https://www.docker.com/products/docker-desktop/, install it, open it, and wait until it says **"Engine running"**.

**Step 2 – Get the code**

```bash
git clone <GITHUB_REPO_LINK_HERE>
cd loan_management
```

(or download the ZIP from GitHub and open a terminal inside the folder)

**Step 3 – Start it**

```bash
docker compose up --build
```

The first time takes a few minutes because it downloads Node.js and MongoDB. You'll know it's ready when you see:

```
LoanDesk running on port 5000
```

**Step 4 – Open it**

- App: http://localhost:5000
- Swagger docs: http://localhost:5000/api-docs

The demo accounts and loan types from section 2 are created automatically.

**Useful commands**

| What you want | Command |
|---|---|
| Stop the app | press `Ctrl + C` (or run `docker compose down`) |
| Start again later (keeps your data) | `docker compose up` |
| Delete all data and start fresh | `docker compose down -v` |

**Port 5000 already in use?** (common on Mac, where AirPlay uses it) Start on another port:

```bash
# Mac / Linux
APP_PORT=5050 docker compose up --build
# Windows PowerShell
$env:APP_PORT=5050; docker compose up --build
```

Then open http://localhost:5050.

---

## 5. Run it without Docker (optional)

You need **Node.js 18+** and a **MongoDB** database (installed locally, or a free cloud one from MongoDB Atlas).

```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env
```

Open `.env` and set `MONGO_URI` (your database address) and `JWT_SECRET` (any long random text).
If MongoDB is installed locally, the default `MONGO_URI` already works.

```bash
npm start
```

Open http://localhost:5000.

---

## 6. How it works (simple version)

**Who can do what**

| Role | Can do |
|---|---|
| Customer | Register, apply for a loan, upload documents, see loan status, pay EMIs, close the loan early, download statement |
| Loan Officer | See all applications (search, filter, pages), review, approve/reject, add remarks, edit amount/tenure/rate, use EMI calculator |
| Admin | Everything an officer can see, plus manage users, loan types, interest rates, and reports |

**Life of a loan**

```
 pending ──► under review ──► approved ──► (all EMIs paid or closed early) ──► closed
    │              │
    └──────────────┴──► rejected  (officer must give a reason)
```

**How the EMI is calculated** (standard reducing-balance formula used by banks)

```
EMI = P × r × (1 + r)^n / ((1 + r)^n − 1)

P = loan amount, r = yearly interest ÷ 12 ÷ 100, n = number of months
```

Example: ₹1,00,000 at 12% for 12 months → EMI = ₹8,884.88.

**Login and security**

- Logging in gives a **JWT token**. The web page sends it with every request.
- Every API route checks the user's **role**, so a customer can't approve loans, and a customer can only see their own loans.
- Passwords are stored **hashed** (bcrypt), never as plain text.
- Deleting a user, loan, loan type or document is a **soft delete**: it is hidden, not erased, so records stay for audit (deleted users can be restored).

---

## 7. What the assignment asked for → where it is

| Requirement | Done with |
|---|---|
| JWT authentication | `server/guards/auth.js`, `server/services/tokens.js` |
| Role-based authorization | `allowRoles(...)` on every route in `server/routes/` |
| Input validation | express-validator rules in `server/routes/`, checked by `server/guards/checkInput.js` |
| File upload API | multer in `server/guards/upload.js` (PDF/JPG/PNG, max 5 MB) |
| Soft delete | Mongoose plugin `server/plugins/softDelete.js` |
| Global exception handling | `server/guards/errors.js` – every error returns the same JSON shape |
| Logging | `server/core/logger.js` + HTTP request logs (morgan) |
| Pagination | `?page=&limit=` on lists – `server/core/paging.js` |
| Search & filters | `?search=&status=&loanType=&minAmount=&from=&to=` on `/api/loans`, `?search=&role=` on `/api/users` |
| Docker support | `Dockerfile`, `docker-compose.yml` |
| Swagger documentation | `/api-docs` – written in `server/docs/openapi.js` |
| Unit testing | Jest tests in `tests/` – run `npm test` |
| EMI / interest calculation | `server/core/emi.js` |
| Repayment, closure, payment history | `server/services/repayment.js` |
| Loan statement download | PDF in `server/handlers/statementHandler.js` |
| Reports | `server/handlers/reportHandler.js` (summary + CSV export) |

**Database tables (MongoDB collections):**
`users`, `roles`, `loanapplications`, `loantypes`, `loandocuments`, `emi_schedules`, `payments`, `loan_history`

---

## 8. Project folders

```
server/
  index.js     starts the app: connects to MongoDB, creates demo data, starts the server
  app.js       Express setup: security headers, logging, Swagger, routes, web page
  config/      settings read from environment variables
  core/        helpers: EMI maths, error type, logger, paging
  guards/      middleware: login check, role check, validation, file upload, error handler
  models/      database tables (Mongoose schemas)
  plugins/     soft delete
  services/    shared logic: repayments, loan access check, history
  handlers/    what each API route actually does
  routes/      URL → handler mapping, with validation rules
  docs/        Swagger (OpenAPI) description
  seed/        the demo data from section 2
public/        the web page (index.html, css, js)
tests/         unit tests
```

---

## 9. Swagger (API docs) in one minute

Swagger is a web page that lists every API endpoint and lets you **try them from the browser**.

1. Open `/api-docs`.
2. Use **Auth → POST /auth/login** → *Try it out* → enter a demo email and password → *Execute*.
3. Copy the `token` from the response, click **Authorize** (top right), and paste it.
4. Now you can try any endpoint. Endpoints your role isn't allowed to use answer with **403**.

---

## 10. Main API endpoints

All routes start with `/api`. Every success response looks like `{ success: true, data, meta? }` and every error looks like `{ success: false, message, details? }`.

| Method | Route | Who |
|---|---|---|
| POST | /auth/register, /auth/login | anyone |
| GET | /auth/me | logged in |
| GET | /loan-types | logged in |
| POST, PUT, DELETE | /loan-types, /loan-types/:id | admin |
| PATCH | /loan-types/:id/rate | admin |
| GET | /loans | customer (own) / officer, admin (all) |
| POST | /loans | customer |
| GET | /loans/:id | owner / officer, admin |
| PUT, DELETE | /loans/:id | officer, admin |
| PATCH | /loans/:id/review | officer, admin |
| POST | /loans/:id/decision, /loans/:id/remarks | officer, admin |
| GET, POST | /loans/:id/documents | owner / officer, admin |
| GET | /documents/:docId/download | owner / officer, admin |
| GET | /loans/:id/schedule, /loans/:id/payments, /loans/:id/statement | owner / officer, admin |
| POST | /loans/:id/repayments | customer |
| POST | /emi/calculate | logged in |
| GET, POST, PUT, DELETE | /users, /users/:id (and PATCH /users/:id/restore) | admin |
| GET | /reports/summary, /reports/loans.csv | admin |

---

## 11. Tests

```bash
npm install
npm test
```

25 unit tests cover the EMI maths, pagination, role checks, validation and error handling. They don't need a database.

---

