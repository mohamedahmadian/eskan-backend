CREATE TABLE "user_revoked_roles" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_revoked_roles_pkey" PRIMARY KEY ("userId","roleId")
);

CREATE INDEX "user_revoked_roles_roleId_idx" ON "user_revoked_roles"("roleId");

ALTER TABLE "user_revoked_roles" ADD CONSTRAINT "user_revoked_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_revoked_roles" ADD CONSTRAINT "user_revoked_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
