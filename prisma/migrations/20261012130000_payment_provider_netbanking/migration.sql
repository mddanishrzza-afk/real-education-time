-- Manual NEFT/IMPS bank-transfer orders are reviewed by an administrator,
-- exactly like static-UPI orders, and unlock access only after verification.
ALTER TYPE "PaymentProvider" ADD VALUE 'NETBANKING';
