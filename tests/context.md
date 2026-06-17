# 📚 DWCC AccessLib – Project Context

## 1. Project Overview

DWCC AccessLib is a **web-based Library Management System** designed for **Divine Word College of Calapan**.
The system manages:

* **User access (students, employees, alumni, staff, admins)**
* **Entry logging via RFID**
* **Locker assignment & monitoring**
* **Book borrowing, returning, and overdue tracking**
* **Email notifications for overdue lockers/books**
* **Dashboards & reports for administrators**

**Tech stack**:

* Frontend: **Next.js (React, TailwindCSS, shadcn/ui, Recharts for graphs)**
* Backend: **Node.js/Express or Next.js API routes**
* Database: **MySQL (MariaDB)**

---

## 2. Feature Breakdown by Role

### 🔹 System Administrator

* **User Account Management**

  * Create/manage administrator accounts
  * Reset passwords
  * View audit logs (login/logout)
  * Enforce role-based access restrictions

* **Library User Management**

  * Register students, employees, alumni
  * Update or archive user records
  * Prevent edits on archived users

---

### 🔹 Library Administrator

* **User Account Management (staff)**

* **Entry Monitoring**

  * Real-time entry logs
  * Filter logs by date, department, year level
  * View peak hour statistics

* **Locker Management**

  * Add/update lockers
  * Monitor availability in real-time

* **Book Management**

  * Add book details
  * Approve borrow/return transactions
  * Update book status (available, borrowed, missing, damaged)

* **Overdue Management**

  * Track overdue books
  * Track overdue lockers

* **Dashboard**

  * Today’s entries, locker usage, book borrowing
  * Graphs of overdue counts

* **Reports**

  * Generate by module (entries, lockers, books)
  * Filter by date range
  * Export to Excel

* **Email Notifications**

  * Configure overdue reminders
  * Send test email

---

### 🔹 Library Staff

* **Entry Monitoring** (RFID scanning + user validation)
* **Locker Management** (assign lockers via RFID)
* **Book Management** (add, borrow, return, mark damaged)
* **Overdue Lists** (books & lockers)
* **Dashboard** (real-time alerts & charts)

---

### 🔹 Library Users

* **Books**

  * Browse/search/filter available books
  * View details

* **Notifications**

  * Receive overdue reminders

---

## 3. Database Context

You already have a **solid foundation** with these tables:

* `user` (profiles)
* `user_account` (login credentials + roles)
* `session` (auth tracking)
* `auditlog` (activity logs)
* `entrylog` (RFID entries)
* `book`
* `book_transaction`
* `locker`
* `locker_transaction`

### Recommended DB Improvements

I noticed **some gaps** for your required features:

1. **Book Category Normalization**

   * Instead of `book.category` as varchar, create a `book_category` table.

   ```sql
   CREATE TABLE book_category (
     category_id INT AUTO_INCREMENT PRIMARY KEY,
     name VARCHAR(100) UNIQUE NOT NULL
   );
   ```

   * Link `book.category` to `book_category.category_id`.

2. **Reports**

   * No dedicated `report_log` table.

   ```sql
   CREATE TABLE report_log (
     report_id INT AUTO_INCREMENT PRIMARY KEY,
     module ENUM('ENTRY','BOOK','LOCKER') NOT NULL,
     date_generated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
     generated_by INT NOT NULL,
     parameters JSON,
     FOREIGN KEY (generated_by) REFERENCES user_account(id)
   );
   ```

3. **Notifications**

   * To track overdue reminders, add a `notification_log`.

   ```sql
   CREATE TABLE notification_log (
     notification_id INT AUTO_INCREMENT PRIMARY KEY,
     user_id INT NOT NULL,
     type ENUM('LOCKER_OVERDUE','BOOK_OVERDUE') NOT NULL,
     status ENUM('SENT','FAILED','QUEUED') NOT NULL DEFAULT 'QUEUED',
     sent_at DATETIME DEFAULT NULL,
     FOREIGN KEY (user_id) REFERENCES user(user_id)
   );
   ```

4. **Locker Details Enhancement**

   * Current `locker` table lacks **location info**. Add `location` column.

5. **Book Metadata Expansion**

   * Add `isbn`, `publisher`, `year_published`, `copies_available` to `book`.

6. **Penalties Config Table**

   * Define rules for overdue fees (instead of hardcoding in code).

   ```sql
   CREATE TABLE penalty_config (
     config_id INT AUTO_INCREMENT PRIMARY KEY,
     type ENUM('BOOK','LOCKER') NOT NULL,
     penalty_per_day DECIMAL(10,2) NOT NULL,
     grace_period_days INT DEFAULT 0
   );
   ```

---

## 4. Recommended Additional Features

1. **Security & Auth**

   * 2FA support for admins
   * Session expiration + forced logout on inactivity

2. **Data Integrity**

   * Archiving mechanism for inactive lockers/books
   * Prevent deletion of key records (use soft delete)

3. **Advanced Reports**

   * Heatmaps of library usage by hour/day
   * Export to PDF (besides Excel)

4. **Usability**

   * Book reservation (before actual borrowing)
   * Waitlist system if book is borrowed
   * Locker reservation

5. **System Health**

   * Backup logs table
   * System configuration table (email settings, penalties, terms)

---

