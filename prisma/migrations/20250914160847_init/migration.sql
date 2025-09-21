-- CreateTable
CREATE TABLE "Setting" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "range" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
