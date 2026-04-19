// 部署時根據 DATABASE_URL 切換 provider
// 本機 sqlite → 部署自動改 postgresql
const fs = require("fs");
const path = require("path");

const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
const dbUrl = process.env.DATABASE_URL || "";

if (dbUrl.startsWith("postgres")) {
  let content = fs.readFileSync(schemaPath, "utf-8");
  if (content.includes('provider = "sqlite"')) {
    content = content.replace('provider = "sqlite"', 'provider = "postgresql"');
    fs.writeFileSync(schemaPath, content);
    console.log("✓ Prisma schema switched to postgresql");
  }
} else {
  console.log("✓ Prisma schema stays as sqlite (local dev)");
}
