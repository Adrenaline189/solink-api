-- CreateTable
CREATE TABLE "Setting" (
    "userId" TEXT NOT NULL,
    "range" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("userId")
);
