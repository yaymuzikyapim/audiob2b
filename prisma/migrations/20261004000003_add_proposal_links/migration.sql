CREATE TABLE "ProposalLink" (
    "id"        TEXT NOT NULL,
    "token"     TEXT NOT NULL,
    "label"     TEXT NOT NULL,
    "slug"      TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProposalLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProposalLink_token_key" ON "ProposalLink"("token");

CREATE TABLE "ProposalLinkVisitor" (
    "id"          TEXT NOT NULL,
    "linkId"      TEXT NOT NULL,
    "visitorId"   TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt"  TIMESTAMP(3) NOT NULL,
    "views"       INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "ProposalLinkVisitor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProposalLinkVisitor_linkId_visitorId_key"
    ON "ProposalLinkVisitor"("linkId", "visitorId");

ALTER TABLE "ProposalLinkVisitor"
    ADD CONSTRAINT "ProposalLinkVisitor_linkId_fkey"
    FOREIGN KEY ("linkId") REFERENCES "ProposalLink"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
