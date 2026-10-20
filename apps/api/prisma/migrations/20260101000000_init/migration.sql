-- Initial schema. Required for the overlapping-lease exclusion constraint.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE "Role" AS ENUM ('LANDLORD', 'ADMIN');
CREATE TYPE "UnitStatus" AS ENUM ('VACANT', 'OCCUPIED', 'MAINTENANCE');
CREATE TYPE "LeaseStatus" AS ENUM ('ACTIVE', 'ENDED', 'TERMINATED', 'RENEWED');
CREATE TYPE "ObligationStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');
CREATE TYPE "PaymentKind" AS ENUM ('PAYMENT', 'REVERSAL');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CARD', 'MOBILE_MONEY', 'CHEQUE', 'OTHER');
CREATE TYPE "ExpenseCategory" AS ENUM ('REPAIRS', 'UTILITIES', 'TAXES', 'INSURANCE', 'MANAGEMENT', 'CLEANING', 'OTHER');
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "MaintenanceStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED');
CREATE TYPE "NotificationType" AS ENUM ('RENT_DUE', 'RENT_OVERDUE', 'LEASE_EXPIRING', 'MAINTENANCE_UPDATE');

CREATE TABLE "User" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'LANDLORD',
  "disabledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Session" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PasswordResetToken" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Property" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "ownerId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "description" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Unit" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "ownerId" UUID NOT NULL,
  "propertyId" UUID NOT NULL,
  "number" TEXT NOT NULL,
  "description" TEXT,
  "monthlyRent" DECIMAL(12,2) NOT NULL,
  "status" "UnitStatus" NOT NULL DEFAULT 'VACANT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Tenant" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "ownerId" UUID NOT NULL,
  "fullName" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "emergencyContact" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Lease" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "ownerId" UUID NOT NULL,
  "unitId" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "monthlyRent" DECIMAL(12,2) NOT NULL,
  "securityDeposit" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "dueDay" INTEGER NOT NULL,
  "status" "LeaseStatus" NOT NULL DEFAULT 'ACTIVE',
  "terminatedAt" DATE,
  "notes" TEXT,
  "renewedFromId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Lease_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Lease_dates_check" CHECK ("startDate" < "endDate"),
  CONSTRAINT "Lease_dueDay_check" CHECK ("dueDay" BETWEEN 1 AND 28),
  CONSTRAINT "Lease_amounts_check" CHECK ("monthlyRent" >= 0 AND "securityDeposit" >= 0)
);

CREATE TABLE "RentObligation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "ownerId" UUID NOT NULL,
  "leaseId" UUID NOT NULL,
  "periodMonth" DATE NOT NULL,
  "dueDate" DATE NOT NULL,
  "amountDue" DECIMAL(12,2) NOT NULL,
  "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "status" "ObligationStatus" NOT NULL DEFAULT 'UNPAID',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RentObligation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RentObligation_amounts_check" CHECK ("amountDue" >= 0 AND "paidAmount" >= 0 AND "paidAmount" <= "amountDue")
);

CREATE TABLE "RentPayment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "ownerId" UUID NOT NULL,
  "obligationId" UUID NOT NULL,
  "kind" "PaymentKind" NOT NULL DEFAULT 'PAYMENT',
  "amount" DECIMAL(12,2) NOT NULL,
  "paidAt" DATE NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "reference" TEXT,
  "note" TEXT,
  "idempotencyKey" TEXT,
  "reversesId" UUID,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RentPayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RentPayment_amount_check" CHECK (
    ("kind" = 'PAYMENT' AND "amount" > 0) OR ("kind" = 'REVERSAL' AND "amount" < 0)
  )
);

CREATE TABLE "Expense" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "ownerId" UUID NOT NULL,
  "propertyId" UUID,
  "category" "ExpenseCategory" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "incurredAt" DATE NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Expense_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Expense_amount_check" CHECK ("amount" > 0)
);

CREATE TABLE "MaintenanceRequest" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "ownerId" UUID NOT NULL,
  "propertyId" UUID NOT NULL,
  "unitId" UUID,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
  "status" "MaintenanceStatus" NOT NULL DEFAULT 'OPEN',
  "estimatedCost" DECIMAL(12,2),
  "actualCost" DECIMAL(12,2),
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MaintenanceRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "ownerId" UUID NOT NULL,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "ownerId" UUID,
  "userId" UUID,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- Unique constraints and indexes
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
CREATE INDEX "Property_ownerId_archivedAt_idx" ON "Property"("ownerId", "archivedAt");
CREATE UNIQUE INDEX "Unit_propertyId_number_key" ON "Unit"("propertyId", "number");
CREATE INDEX "Unit_ownerId_idx" ON "Unit"("ownerId");
CREATE INDEX "Tenant_ownerId_active_idx" ON "Tenant"("ownerId", "active");
CREATE INDEX "Lease_ownerId_status_idx" ON "Lease"("ownerId", "status");
CREATE INDEX "Lease_unitId_idx" ON "Lease"("unitId");
CREATE INDEX "Lease_tenantId_idx" ON "Lease"("tenantId");
CREATE INDEX "Lease_status_endDate_idx" ON "Lease"("status", "endDate");
CREATE UNIQUE INDEX "RentObligation_leaseId_periodMonth_key" ON "RentObligation"("leaseId", "periodMonth");
CREATE INDEX "RentObligation_ownerId_dueDate_idx" ON "RentObligation"("ownerId", "dueDate");
CREATE INDEX "RentObligation_ownerId_status_dueDate_idx" ON "RentObligation"("ownerId", "status", "dueDate");
CREATE UNIQUE INDEX "RentPayment_reversesId_key" ON "RentPayment"("reversesId");
CREATE UNIQUE INDEX "RentPayment_ownerId_idempotencyKey_key" ON "RentPayment"("ownerId", "idempotencyKey");
CREATE INDEX "RentPayment_ownerId_paidAt_idx" ON "RentPayment"("ownerId", "paidAt");
CREATE INDEX "RentPayment_obligationId_idx" ON "RentPayment"("obligationId");
CREATE INDEX "Expense_ownerId_incurredAt_idx" ON "Expense"("ownerId", "incurredAt");
CREATE INDEX "Expense_propertyId_idx" ON "Expense"("propertyId");
CREATE INDEX "MaintenanceRequest_ownerId_status_idx" ON "MaintenanceRequest"("ownerId", "status");
CREATE INDEX "MaintenanceRequest_propertyId_idx" ON "MaintenanceRequest"("propertyId");
CREATE UNIQUE INDEX "Notification_ownerId_dedupeKey_key" ON "Notification"("ownerId", "dedupeKey");
CREATE INDEX "Notification_ownerId_readAt_idx" ON "Notification"("ownerId", "readAt");
CREATE INDEX "AuditLog_ownerId_createdAt_idx" ON "AuditLog"("ownerId", "createdAt");
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- Foreign keys (financial history is never cascaded away)
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Property" ADD CONSTRAINT "Property_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_renewedFromId_fkey" FOREIGN KEY ("renewedFromId") REFERENCES "Lease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RentObligation" ADD CONSTRAINT "RentObligation_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RentObligation" ADD CONSTRAINT "RentObligation_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RentPayment" ADD CONSTRAINT "RentPayment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RentPayment" ADD CONSTRAINT "RentPayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RentPayment" ADD CONSTRAINT "RentPayment_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "RentObligation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RentPayment" ADD CONSTRAINT "RentPayment_reversesId_fkey" FOREIGN KEY ("reversesId") REFERENCES "RentPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Database-level guarantee: no two ACTIVE leases may overlap on the same unit.
ALTER TABLE "Lease" ADD CONSTRAINT "lease_no_overlap"
  EXCLUDE USING gist ("unitId" WITH =, daterange("startDate", "endDate", '[]') WITH &&)
  WHERE ("status" = 'ACTIVE');
