import { prisma } from "../../../lib/db";

async function main() {
  const clients = await prisma.cRMClient.findMany();
  console.log("=== All CRMClients ===");
  console.log(JSON.stringify(clients, null, 2));
}

main().catch(console.error);
