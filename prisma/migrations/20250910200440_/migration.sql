-- CreateEnum
CREATE TYPE "public"."BookStatus" AS ENUM ('AVAILABLE', 'BORROWED', 'MISSING', 'DAMAGED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."BookCondition" AS ENUM ('EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED', 'MISSING');

-- CreateEnum
CREATE TYPE "public"."UserType" AS ENUM ('STUDENT', 'EMPLOYEE', 'ALUMNI', 'GUEST');

-- CreateEnum
CREATE TYPE "public"."UserStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'STAFF', 'USER');

-- CreateEnum
CREATE TYPE "public"."LockerStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'DAMAGED', 'MAINTENANCE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."TransactionStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'COMPLETED', 'OVERDUE', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('LOCKER_OVERDUE', 'BOOK_OVERDUE', 'LOCKER_ASSIGNED', 'BOOK_APPROVED', 'BOOK_REJECTED', 'PENDING_APPROVAL', 'SYSTEM_ALERT', 'ACCOUNT_UPDATE');

-- CreateEnum
CREATE TYPE "public"."NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'READ');

-- CreateEnum
CREATE TYPE "public"."ReportModule" AS ENUM ('ENTRY', 'BOOK', 'LOCKER', 'USER', 'AUDIT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "public"."PenaltyType" AS ENUM ('BOOK', 'LOCKER');

-- CreateEnum
CREATE TYPE "public"."ConfigDataType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON');

-- CreateEnum
CREATE TYPE "public"."OverdueTransactionType" AS ENUM ('BOOK', 'LOCKER');

-- CreateEnum
CREATE TYPE "public"."OverdueSettlementStatus" AS ENUM ('PENDING', 'PARTIAL', 'SETTLED');

-- CreateTable
CREATE TABLE "public"."user" (
    "user_id" SERIAL NOT NULL,
    "account_id" VARCHAR(20) NOT NULL,
    "full_name" VARCHAR(100) NOT NULL,
    "user_type" "public"."UserType" NOT NULL,
    "department_id" INTEGER,
    "program_id" INTEGER,
    "year_level" VARCHAR(10),
    "email" VARCHAR(100),
    "rfid_code" VARCHAR(50),
    "purpose" VARCHAR(100),
    "contact_number" VARCHAR(20),
    "status" "public"."UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0) NOT NULL,
    "archived_at" TIMESTAMP(0),

    CONSTRAINT "user_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "public"."user_account" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL,
    "last_login" TIMESTAMP(0),
    "login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(0),
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."book_category" (
    "category_id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "book_category_pkey" PRIMARY KEY ("category_id")
);

-- CreateTable
CREATE TABLE "public"."book_section" (
    "section_id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "book_section_pkey" PRIMARY KEY ("section_id")
);

-- CreateTable
CREATE TABLE "public"."book" (
    "book_id" SERIAL NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "book_author" VARCHAR(100) NOT NULL,
    "isbn" VARCHAR(20),
    "publisher" VARCHAR(100),
    "year_published" INTEGER,
    "copies_total" INTEGER NOT NULL DEFAULT 1,
    "copies_available" INTEGER NOT NULL DEFAULT 1,
    "category_id" INTEGER NOT NULL,
    "section_id" INTEGER,
    "status" "public"."BookStatus" NOT NULL DEFAULT 'AVAILABLE',
    "location" VARCHAR(50),
    "description" TEXT,
    "language" VARCHAR(50),
    "pages" INTEGER,
    "edition" VARCHAR(50),
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0) NOT NULL,
    "archived_at" TIMESTAMP(0),

    CONSTRAINT "book_pkey" PRIMARY KEY ("book_id")
);

-- CreateTable
CREATE TABLE "public"."book_transaction" (
    "transaction_id" SERIAL NOT NULL,
    "borrow_date" DATE,
    "return_date" DATE,
    "due_date" DATE,
    "penalty" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "status" "public"."TransactionStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "condition_on_borrow" "public"."BookCondition",
    "condition_on_return" "public"."BookCondition",
    "book_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "requested_by" INTEGER,
    "approved_by" INTEGER,
    "returned_by" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0) NOT NULL,

    CONSTRAINT "book_transaction_pkey" PRIMARY KEY ("transaction_id")
);

-- CreateTable
CREATE TABLE "public"."locker" (
    "locker_id" SERIAL NOT NULL,
    "locker_number" VARCHAR(20) NOT NULL,
    "location" VARCHAR(100) NOT NULL,
    "status" "public"."LockerStatus" NOT NULL DEFAULT 'AVAILABLE',
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0) NOT NULL,
    "archived_at" TIMESTAMP(0),

    CONSTRAINT "locker_pkey" PRIMARY KEY ("locker_id")
);

-- CreateTable
CREATE TABLE "public"."locker_transaction" (
    "transaction_id" SERIAL NOT NULL,
    "borrow_time" TIMESTAMP(0) NOT NULL,
    "return_time" TIMESTAMP(0),
    "due_time" TIMESTAMP(0) NOT NULL,
    "penalty" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "status" "public"."TransactionStatus" NOT NULL DEFAULT 'ACTIVE',
    "user_id" INTEGER NOT NULL,
    "locker_id" INTEGER NOT NULL,
    "assigned_by" INTEGER,
    "returned_by" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0) NOT NULL,

    CONSTRAINT "locker_transaction_pkey" PRIMARY KEY ("transaction_id")
);

-- CreateTable
CREATE TABLE "public"."entrylog" (
    "entry_id" SERIAL NOT NULL,
    "entry_time" TIMESTAMP(0) NOT NULL,
    "exit_time" TIMESTAMP(0),
    "user_id" INTEGER NOT NULL,
    "rfid_code" VARCHAR(50),
    "purpose" VARCHAR(100),
    "verified_by" INTEGER,

    CONSTRAINT "entrylog_pkey" PRIMARY KEY ("entry_id")
);

-- CreateTable
CREATE TABLE "public"."auditlog" (
    "event_id" SERIAL NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "description" TEXT NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "date_time_log" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" "public"."UserRole" NOT NULL,
    "user_account_id" INTEGER NOT NULL,

    CONSTRAINT "auditlog_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "public"."session" (
    "session_id" SERIAL NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_account_id" INTEGER NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(0) NOT NULL,
    "last_activity" TIMESTAMP(0) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "session_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "public"."notification_log" (
    "notification_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" "public"."NotificationType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "status" "public"."NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "sent_at" TIMESTAMP(0),
    "read_at" TIMESTAMP(0),
    "metadata" TEXT,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_log_pkey" PRIMARY KEY ("notification_id")
);

-- CreateTable
CREATE TABLE "public"."report_log" (
    "report_id" SERIAL NOT NULL,
    "module" "public"."ReportModule" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "parameters" TEXT,
    "file_path" VARCHAR(500),
    "date_generated" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generated_by" INTEGER NOT NULL,
    "download_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "report_log_pkey" PRIMARY KEY ("report_id")
);

-- CreateTable
CREATE TABLE "public"."penalty_config" (
    "config_id" SERIAL NOT NULL,
    "type" "public"."PenaltyType" NOT NULL,
    "penalty_per_day" DECIMAL(10,2) NOT NULL,
    "penalty_per_hour" DECIMAL(10,2),
    "grace_period_days" INTEGER NOT NULL DEFAULT 0,
    "grace_period_hours" INTEGER DEFAULT 0,
    "max_penalty" DECIMAL(10,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0) NOT NULL,

    CONSTRAINT "penalty_config_pkey" PRIMARY KEY ("config_id")
);

-- CreateTable
CREATE TABLE "public"."system_config" (
    "config_id" SERIAL NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "data_type" "public"."ConfigDataType" NOT NULL DEFAULT 'STRING',
    "is_encrypted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0) NOT NULL,

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("config_id")
);

-- CreateTable
CREATE TABLE "public"."department" (
    "department_id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0) NOT NULL,
    "archived_at" TIMESTAMP(0),

    CONSTRAINT "department_pkey" PRIMARY KEY ("department_id")
);

-- CreateTable
CREATE TABLE "public"."program" (
    "program_id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "description" TEXT,
    "department_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0) NOT NULL,
    "archived_at" TIMESTAMP(0),

    CONSTRAINT "program_pkey" PRIMARY KEY ("program_id")
);

-- CreateTable
CREATE TABLE "public"."overdue_settlement" (
    "settlement_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "transaction_type" "public"."OverdueTransactionType" NOT NULL,
    "transaction_id" INTEGER NOT NULL,
    "penalty_amount" DECIMAL(10,2) NOT NULL,
    "amount_paid" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "remaining_balance" DECIMAL(10,2) NOT NULL,
    "status" "public"."OverdueSettlementStatus" NOT NULL DEFAULT 'PENDING',
    "settled_at" TIMESTAMP(0),
    "processed_by" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0) NOT NULL,

    CONSTRAINT "overdue_settlement_pkey" PRIMARY KEY ("settlement_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_account_id_key" ON "public"."user"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "public"."user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_rfid_code_key" ON "public"."user"("rfid_code");

-- CreateIndex
CREATE INDEX "user_user_type_status_idx" ON "public"."user"("user_type", "status");

-- CreateIndex
CREATE INDEX "user_department_id_idx" ON "public"."user"("department_id");

-- CreateIndex
CREATE INDEX "user_program_id_idx" ON "public"."user"("program_id");

-- CreateIndex
CREATE INDEX "user_created_at_idx" ON "public"."user"("created_at");

-- CreateIndex
CREATE INDEX "user_full_name_idx" ON "public"."user"("full_name");

-- CreateIndex
CREATE INDEX "user_archived_at_idx" ON "public"."user"("archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_account_username_key" ON "public"."user_account"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_account_user_id_key" ON "public"."user_account"("user_id");

-- CreateIndex
CREATE INDEX "user_account_role_is_active_idx" ON "public"."user_account"("role", "is_active");

-- CreateIndex
CREATE INDEX "user_account_last_login_idx" ON "public"."user_account"("last_login");

-- CreateIndex
CREATE INDEX "user_account_locked_until_idx" ON "public"."user_account"("locked_until");

-- CreateIndex
CREATE UNIQUE INDEX "book_category_name_key" ON "public"."book_category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "book_section_name_key" ON "public"."book_section"("name");

-- CreateIndex
CREATE INDEX "book_section_is_active_idx" ON "public"."book_section"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "book_isbn_key" ON "public"."book"("isbn");

-- CreateIndex
CREATE INDEX "book_status_category_id_idx" ON "public"."book"("status", "category_id");

-- CreateIndex
CREATE INDEX "book_section_id_idx" ON "public"."book"("section_id");

-- CreateIndex
CREATE INDEX "book_title_idx" ON "public"."book"("title");

-- CreateIndex
CREATE INDEX "book_book_author_idx" ON "public"."book"("book_author");

-- CreateIndex
CREATE INDEX "book_isbn_idx" ON "public"."book"("isbn");

-- CreateIndex
CREATE INDEX "book_created_at_idx" ON "public"."book"("created_at");

-- CreateIndex
CREATE INDEX "book_archived_at_idx" ON "public"."book"("archived_at");

-- CreateIndex
CREATE INDEX "book_transaction_book_id_idx" ON "public"."book_transaction"("book_id");

-- CreateIndex
CREATE INDEX "book_transaction_user_id_idx" ON "public"."book_transaction"("user_id");

-- CreateIndex
CREATE INDEX "book_transaction_due_date_idx" ON "public"."book_transaction"("due_date");

-- CreateIndex
CREATE INDEX "book_transaction_borrow_date_idx" ON "public"."book_transaction"("borrow_date");

-- CreateIndex
CREATE INDEX "book_transaction_return_date_idx" ON "public"."book_transaction"("return_date");

-- CreateIndex
CREATE INDEX "book_transaction_status_idx" ON "public"."book_transaction"("status");

-- CreateIndex
CREATE UNIQUE INDEX "locker_locker_number_key" ON "public"."locker"("locker_number");

-- CreateIndex
CREATE INDEX "locker_status_idx" ON "public"."locker"("status");

-- CreateIndex
CREATE INDEX "locker_location_idx" ON "public"."locker"("location");

-- CreateIndex
CREATE INDEX "locker_archived_at_idx" ON "public"."locker"("archived_at");

-- CreateIndex
CREATE INDEX "locker_transaction_locker_id_idx" ON "public"."locker_transaction"("locker_id");

-- CreateIndex
CREATE INDEX "locker_transaction_user_id_idx" ON "public"."locker_transaction"("user_id");

-- CreateIndex
CREATE INDEX "locker_transaction_due_time_idx" ON "public"."locker_transaction"("due_time");

-- CreateIndex
CREATE INDEX "locker_transaction_borrow_time_idx" ON "public"."locker_transaction"("borrow_time");

-- CreateIndex
CREATE INDEX "locker_transaction_return_time_idx" ON "public"."locker_transaction"("return_time");

-- CreateIndex
CREATE INDEX "locker_transaction_status_idx" ON "public"."locker_transaction"("status");

-- CreateIndex
CREATE INDEX "entrylog_user_id_idx" ON "public"."entrylog"("user_id");

-- CreateIndex
CREATE INDEX "entrylog_entry_time_idx" ON "public"."entrylog"("entry_time");

-- CreateIndex
CREATE INDEX "entrylog_exit_time_idx" ON "public"."entrylog"("exit_time");

-- CreateIndex
CREATE INDEX "entrylog_rfid_code_idx" ON "public"."entrylog"("rfid_code");

-- CreateIndex
CREATE INDEX "auditlog_user_account_id_idx" ON "public"."auditlog"("user_account_id");

-- CreateIndex
CREATE INDEX "auditlog_date_time_log_idx" ON "public"."auditlog"("date_time_log");

-- CreateIndex
CREATE INDEX "auditlog_role_idx" ON "public"."auditlog"("role");

-- CreateIndex
CREATE INDEX "auditlog_action_idx" ON "public"."auditlog"("action");

-- CreateIndex
CREATE UNIQUE INDEX "session_session_token_key" ON "public"."session"("session_token");

-- CreateIndex
CREATE INDEX "session_user_account_id_idx" ON "public"."session"("user_account_id");

-- CreateIndex
CREATE INDEX "session_expires_at_is_active_idx" ON "public"."session"("expires_at", "is_active");

-- CreateIndex
CREATE INDEX "session_last_activity_idx" ON "public"."session"("last_activity");

-- CreateIndex
CREATE INDEX "notification_log_user_id_idx" ON "public"."notification_log"("user_id");

-- CreateIndex
CREATE INDEX "notification_log_type_idx" ON "public"."notification_log"("type");

-- CreateIndex
CREATE INDEX "notification_log_status_idx" ON "public"."notification_log"("status");

-- CreateIndex
CREATE INDEX "notification_log_created_at_idx" ON "public"."notification_log"("created_at");

-- CreateIndex
CREATE INDEX "report_log_generated_by_idx" ON "public"."report_log"("generated_by");

-- CreateIndex
CREATE INDEX "report_log_module_idx" ON "public"."report_log"("module");

-- CreateIndex
CREATE INDEX "report_log_date_generated_idx" ON "public"."report_log"("date_generated");

-- CreateIndex
CREATE INDEX "penalty_config_type_is_active_idx" ON "public"."penalty_config"("type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "system_config_key_key" ON "public"."system_config"("key");

-- CreateIndex
CREATE INDEX "system_config_key_idx" ON "public"."system_config"("key");

-- CreateIndex
CREATE UNIQUE INDEX "department_name_key" ON "public"."department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "department_code_key" ON "public"."department"("code");

-- CreateIndex
CREATE INDEX "department_code_idx" ON "public"."department"("code");

-- CreateIndex
CREATE INDEX "department_is_active_idx" ON "public"."department"("is_active");

-- CreateIndex
CREATE INDEX "department_archived_at_idx" ON "public"."department"("archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "program_name_key" ON "public"."program"("name");

-- CreateIndex
CREATE UNIQUE INDEX "program_code_key" ON "public"."program"("code");

-- CreateIndex
CREATE INDEX "program_code_idx" ON "public"."program"("code");

-- CreateIndex
CREATE INDEX "program_department_id_idx" ON "public"."program"("department_id");

-- CreateIndex
CREATE INDEX "program_is_active_idx" ON "public"."program"("is_active");

-- CreateIndex
CREATE INDEX "program_archived_at_idx" ON "public"."program"("archived_at");

-- CreateIndex
CREATE INDEX "overdue_settlement_user_id_idx" ON "public"."overdue_settlement"("user_id");

-- CreateIndex
CREATE INDEX "overdue_settlement_transaction_type_idx" ON "public"."overdue_settlement"("transaction_type");

-- CreateIndex
CREATE INDEX "overdue_settlement_transaction_id_idx" ON "public"."overdue_settlement"("transaction_id");

-- CreateIndex
CREATE INDEX "overdue_settlement_status_idx" ON "public"."overdue_settlement"("status");

-- CreateIndex
CREATE INDEX "overdue_settlement_created_at_idx" ON "public"."overdue_settlement"("created_at");

-- AddForeignKey
ALTER TABLE "public"."user" ADD CONSTRAINT "user_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."department"("department_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user" ADD CONSTRAINT "user_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."program"("program_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_account" ADD CONSTRAINT "user_account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."book" ADD CONSTRAINT "book_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."book_category"("category_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."book" ADD CONSTRAINT "book_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."book_section"("section_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."book_transaction" ADD CONSTRAINT "book_transaction_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "public"."book"("book_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."book_transaction" ADD CONSTRAINT "book_transaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."locker_transaction" ADD CONSTRAINT "locker_transaction_locker_id_fkey" FOREIGN KEY ("locker_id") REFERENCES "public"."locker"("locker_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."locker_transaction" ADD CONSTRAINT "locker_transaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."entrylog" ADD CONSTRAINT "entrylog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."auditlog" ADD CONSTRAINT "auditlog_user_account_id_fkey" FOREIGN KEY ("user_account_id") REFERENCES "public"."user_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."session" ADD CONSTRAINT "session_user_account_id_fkey" FOREIGN KEY ("user_account_id") REFERENCES "public"."user_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notification_log" ADD CONSTRAINT "notification_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."report_log" ADD CONSTRAINT "report_log_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "public"."user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."program" ADD CONSTRAINT "program_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."department"("department_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."overdue_settlement" ADD CONSTRAINT "overdue_settlement_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
