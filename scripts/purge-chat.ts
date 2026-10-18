import { prisma } from '../lib/db';


async function main() {
  const msgs = await prisma.chatMessage.deleteMany({});
  const threads = await prisma.chatThread.deleteMany({});
  console.log('Messages deleted:', msgs.count);
  console.log('Threads deleted:', threads.count);
}

main()
  .catch(console.error)
  .finally(async () => { await prisma.$disconnect(); });
