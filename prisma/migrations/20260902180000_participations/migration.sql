CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "cardNumber" TEXT,
    "iban" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crypto_wallets" (
    "id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "network" TEXT,
    "address" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crypto_wallets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "participation_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "description" TEXT,
    "imageId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "totalAmount" INTEGER NOT NULL,
    "sharePrice" INTEGER NOT NULL,
    "bankAccountId" TEXT,
    "cryptoWalletId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "participation_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "campaign_participants" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "shareCount" INTEGER NOT NULL,
    "paidAmount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_participants_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bank_accounts_bankName_idx" ON "bank_accounts"("bankName");
CREATE INDEX "bank_accounts_isActive_idx" ON "bank_accounts"("isActive");
CREATE INDEX "crypto_wallets_currency_idx" ON "crypto_wallets"("currency");
CREATE INDEX "crypto_wallets_isActive_idx" ON "crypto_wallets"("isActive");
CREATE INDEX "participation_campaigns_name_idx" ON "participation_campaigns"("name");
CREATE INDEX "participation_campaigns_isActive_idx" ON "participation_campaigns"("isActive");
CREATE INDEX "participation_campaigns_startDate_idx" ON "participation_campaigns"("startDate");
CREATE INDEX "participation_campaigns_endDate_idx" ON "participation_campaigns"("endDate");
CREATE INDEX "participation_campaigns_bankAccountId_idx" ON "participation_campaigns"("bankAccountId");
CREATE INDEX "participation_campaigns_cryptoWalletId_idx" ON "participation_campaigns"("cryptoWalletId");
CREATE INDEX "campaign_participants_campaignId_idx" ON "campaign_participants"("campaignId");
CREATE INDEX "campaign_participants_fullName_idx" ON "campaign_participants"("fullName");

ALTER TABLE "participation_campaigns" ADD CONSTRAINT "participation_campaigns_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "stored_images"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "participation_campaigns" ADD CONSTRAINT "participation_campaigns_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "participation_campaigns" ADD CONSTRAINT "participation_campaigns_cryptoWalletId_fkey" FOREIGN KEY ("cryptoWalletId") REFERENCES "crypto_wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "campaign_participants" ADD CONSTRAINT "campaign_participants_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "participation_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
