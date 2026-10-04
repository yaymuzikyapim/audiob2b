-- Migration: add isDemo column to Company
-- Demo şirket ID: review-company-001 (AudioB2B Demo)

ALTER TABLE "Company" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Company" SET "isDemo" = true WHERE id = 'review-company-001';
