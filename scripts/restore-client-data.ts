import fs from "fs";
import path from "path";
import { prisma } from "../lib/db";

interface BackupData {
  exportedAt: string;
  totalTables: number;
  totalRecords: number;
  tables: Record<string, { count: number; records: any[] }>;
}

export async function restoreClientData(backupFilePath?: string) {
  const filePath = backupFilePath || path.join(process.cwd(), "prisma", "client_data_backup.json");
  if (!fs.existsSync(filePath)) {
    throw new Error(`Backup file not found at: ${filePath}`);
  }

  const rawJson = fs.readFileSync(filePath, "utf-8");
  const backup: BackupData = JSON.parse(rawJson);

  console.log(`=== RESTORING CLIENT DATA FROM BACKUP ===`);
  console.log(`Source file: ${filePath}`);
  console.log(`Backup timestamp: ${backup.exportedAt}`);
  console.log(`Expected records: ${backup.totalRecords}`);

  let restoredCount = 0;

  // 1. RawIngredient (Parent)
  if (backup.tables.RawIngredient?.records?.length) {
    console.log(`Restoring RawIngredient (${backup.tables.RawIngredient.records.length})...`);
    for (const r of backup.tables.RawIngredient.records) {
      await prisma.rawIngredient.upsert({
        where: { id: r.id },
        update: {
          name: r.name,
          type: r.type,
          available: Number(r.available),
          unit: r.unit,
          warningThreshold: Number(r.warningThreshold),
          costPerUnit: Number(r.costPerUnit),
          entryDate: r.entryDate ? new Date(r.entryDate) : new Date(),
          shelfLifeDays: r.shelfLifeDays !== null && r.shelfLifeDays !== undefined ? Number(r.shelfLifeDays) : null,
          createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
          updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
        },
        create: {
          id: r.id,
          name: r.name,
          type: r.type,
          available: Number(r.available),
          unit: r.unit,
          warningThreshold: Number(r.warningThreshold),
          costPerUnit: Number(r.costPerUnit),
          entryDate: r.entryDate ? new Date(r.entryDate) : new Date(),
          shelfLifeDays: r.shelfLifeDays !== null && r.shelfLifeDays !== undefined ? Number(r.shelfLifeDays) : null,
          createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
          updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
        },
      });
      restoredCount++;
    }
  }

  // 2. Arrangement (Parent)
  if (backup.tables.Arrangement?.records?.length) {
    console.log(`Restoring Arrangement (${backup.tables.Arrangement.records.length})...`);
    for (const r of backup.tables.Arrangement.records) {
      await prisma.arrangement.upsert({
        where: { id: r.id },
        update: {
          name: r.name,
          category: r.category,
          price: Number(r.price),
          featured: Boolean(r.featured),
          image: r.image,
          description: r.description,
          createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
          updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
        },
        create: {
          id: r.id,
          name: r.name,
          category: r.category,
          price: Number(r.price),
          featured: Boolean(r.featured),
          image: r.image,
          description: r.description,
          createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
          updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
        },
      });
      restoredCount++;
    }
  }

  // 3. ArrangementRecipeItem (Child of Arrangement + RawIngredient)
  if (backup.tables.ArrangementRecipeItem?.records?.length) {
    console.log(`Restoring ArrangementRecipeItem (${backup.tables.ArrangementRecipeItem.records.length})...`);
    for (const r of backup.tables.ArrangementRecipeItem.records) {
      await prisma.arrangementRecipeItem.upsert({
        where: { id: r.id },
        update: {
          arrangementId: r.arrangementId,
          rawIngredientId: r.rawIngredientId,
          quantityNeeded: Number(r.quantityNeeded),
        },
        create: {
          id: r.id,
          arrangementId: r.arrangementId,
          rawIngredientId: r.rawIngredientId,
          quantityNeeded: Number(r.quantityNeeded),
        },
      });
      restoredCount++;
    }
  }

  // 4. Dress
  if (backup.tables.Dress?.records?.length) {
    console.log(`Restoring Dress (${backup.tables.Dress.records.length})...`);
    for (const r of backup.tables.Dress.records) {
      await prisma.dress.upsert({
        where: { id: r.id },
        update: {
          name: r.name,
          brand: r.brand,
          size: r.size,
          category: r.category || "Gala",
          imageUrl: r.imageUrl || null,
          baseRentalPrice: Number(r.baseRentalPrice),
          acquisitionCost: Number(r.acquisitionCost),
          timesUsed: Number(r.timesUsed),
          condition: r.condition,
          requiredGuarantee: Number(r.requiredGuarantee),
          status: r.status,
          color: r.color,
          createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
          updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
        },
        create: {
          id: r.id,
          name: r.name,
          brand: r.brand,
          size: r.size,
          category: r.category || "Gala",
          imageUrl: r.imageUrl || null,
          baseRentalPrice: Number(r.baseRentalPrice),
          acquisitionCost: Number(r.acquisitionCost),
          timesUsed: Number(r.timesUsed),
          condition: r.condition,
          requiredGuarantee: Number(r.requiredGuarantee),
          status: r.status,
          color: r.color,
          createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
          updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
        },
      });
      restoredCount++;
    }
  }

  // 5. CRMClient
  if (backup.tables.CRMClient?.records?.length) {
    console.log(`Restoring CRMClient (${backup.tables.CRMClient.records.length})...`);
    for (const r of backup.tables.CRMClient.records) {
      await prisma.cRMClient.upsert({
        where: { id: r.id },
        update: {
          name: r.name,
          phone: r.phone,
          favoriteFlower: r.favoriteFlower || null,
          notes: r.notes || null,
          totalSpent: Number(r.totalSpent),
          purchaseCount: Number(r.purchaseCount),
          loyaltyTier: r.loyaltyTier,
          lastPurchaseAt: r.lastPurchaseAt ? new Date(r.lastPurchaseAt) : null,
          createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
        },
        create: {
          id: r.id,
          name: r.name,
          phone: r.phone,
          favoriteFlower: r.favoriteFlower || null,
          notes: r.notes || null,
          totalSpent: Number(r.totalSpent),
          purchaseCount: Number(r.purchaseCount),
          loyaltyTier: r.loyaltyTier,
          lastPurchaseAt: r.lastPurchaseAt ? new Date(r.lastPurchaseAt) : null,
          createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
        },
      });
      restoredCount++;
    }
  }

  // 6. POSTicket (Parent)
  if (backup.tables.POSTicket?.records?.length) {
    console.log(`Restoring POSTicket (${backup.tables.POSTicket.records.length})...`);
    for (const r of backup.tables.POSTicket.records) {
      await prisma.pOSTicket.upsert({
        where: { id: r.id },
        update: {
          ticketNumber: r.ticketNumber,
          customerName: r.customerName || null,
          customerPhone: r.customerPhone || null,
          totalAmount: Number(r.totalAmount),
          discountAmount: Number(r.discountAmount),
          paymentMethod: r.paymentMethod,
          createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
        },
        create: {
          id: r.id,
          ticketNumber: r.ticketNumber,
          customerName: r.customerName || null,
          customerPhone: r.customerPhone || null,
          totalAmount: Number(r.totalAmount),
          discountAmount: Number(r.discountAmount),
          paymentMethod: r.paymentMethod,
          createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
        },
      });
      restoredCount++;
    }
  }

  // 7. POSTicketItem (Child of POSTicket)
  if (backup.tables.POSTicketItem?.records?.length) {
    console.log(`Restoring POSTicketItem (${backup.tables.POSTicketItem.records.length})...`);
    for (const r of backup.tables.POSTicketItem.records) {
      await prisma.pOSTicketItem.upsert({
        where: { id: r.id },
        update: {
          ticketId: r.ticketId,
          itemName: r.itemName,
          price: Number(r.price),
          quantity: Number(r.quantity),
        },
        create: {
          id: r.id,
          ticketId: r.ticketId,
          itemName: r.itemName,
          price: Number(r.price),
          quantity: Number(r.quantity),
        },
      });
      restoredCount++;
    }
  }

  // 8. LoyaltyConfig
  if (backup.tables.LoyaltyConfig?.records?.length) {
    console.log(`Restoring LoyaltyConfig (${backup.tables.LoyaltyConfig.records.length})...`);
    for (const r of backup.tables.LoyaltyConfig.records) {
      await prisma.loyaltyConfig.upsert({
        where: { id: r.id || "default" },
        update: {
          targetCount: Number(r.targetCount),
          rewardText: r.rewardText,
          minSpent: Number(r.minSpent),
          updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
        },
        create: {
          id: r.id || "default",
          targetCount: Number(r.targetCount),
          rewardText: r.rewardText,
          minSpent: Number(r.minSpent),
          updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
        },
      });
      restoredCount++;
    }
  }

  // 9. CarissmaConfig
  if (backup.tables.CarissmaConfig?.records?.length) {
    console.log(`Restoring CarissmaConfig (${backup.tables.CarissmaConfig.records.length})...`);
    for (const r of backup.tables.CarissmaConfig.records) {
      await prisma.carissmaConfig.upsert({
        where: { id: r.id || "default" },
        update: {
          defaultRentalDays: Number(r.defaultRentalDays),
          defaultGuaranteePercent: Number(r.defaultGuaranteePercent),
          decayRatePerUsage: Number(r.decayRatePerUsage),
          minPriceFloorPercent: Number(r.minPriceFloorPercent),
          lateFeePerDay: Number(r.lateFeePerDay),
          updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
        },
        create: {
          id: r.id || "default",
          defaultRentalDays: Number(r.defaultRentalDays),
          defaultGuaranteePercent: Number(r.defaultGuaranteePercent),
          decayRatePerUsage: Number(r.decayRatePerUsage),
          minPriceFloorPercent: Number(r.minPriceFloorPercent),
          lateFeePerDay: Number(r.lateFeePerDay),
          updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
        },
      });
      restoredCount++;
    }
  }

  // 10. ChannelConfig
  if (backup.tables.ChannelConfig?.records?.length) {
    console.log(`Restoring ChannelConfig (${backup.tables.ChannelConfig.records.length})...`);
    for (const r of backup.tables.ChannelConfig.records) {
      await prisma.channelConfig.upsert({
        where: { id: r.id },
        update: {
          channel: r.channel,
          environment: r.environment || "farfalina",
          status: r.status,
          qrCodeData: r.qrCodeData || null,
          whatsappPhoneNumberId: r.whatsappPhoneNumberId || null,
          whatsappWabaId: r.whatsappWabaId || null,
          whatsappAccessToken: r.whatsappAccessToken || null,
          whatsappBusinessPhone: r.whatsappBusinessPhone || null,
          facebookPageToken: r.facebookPageToken || null,
          facebookPageId: r.facebookPageId || null,
          instagramAccessToken: r.instagramAccessToken || null,
          instagramAccountId: r.instagramAccountId || null,
          tiktokAppId: r.tiktokAppId || null,
          tiktokAccessToken: r.tiktokAccessToken || null,
          tiktokOpenId: r.tiktokOpenId || null,
          verifyToken: r.verifyToken || null,
          lastSyncAt: r.lastSyncAt ? new Date(r.lastSyncAt) : null,
          updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
          createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
        },
        create: {
          id: r.id,
          channel: r.channel,
          environment: r.environment || "farfalina",
          status: r.status,
          qrCodeData: r.qrCodeData || null,
          whatsappPhoneNumberId: r.whatsappPhoneNumberId || null,
          whatsappWabaId: r.whatsappWabaId || null,
          whatsappAccessToken: r.whatsappAccessToken || null,
          whatsappBusinessPhone: r.whatsappBusinessPhone || null,
          facebookPageToken: r.facebookPageToken || null,
          facebookPageId: r.facebookPageId || null,
          instagramAccessToken: r.instagramAccessToken || null,
          instagramAccountId: r.instagramAccountId || null,
          tiktokAppId: r.tiktokAppId || null,
          tiktokAccessToken: r.tiktokAccessToken || null,
          tiktokOpenId: r.tiktokOpenId || null,
          verifyToken: r.verifyToken || null,
          lastSyncAt: r.lastSyncAt ? new Date(r.lastSyncAt) : null,
          updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
          createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
        },
      });
      restoredCount++;
    }
  }

  // 11. QuickReply
  if (backup.tables.QuickReply?.records?.length) {
    console.log(`Restoring QuickReply (${backup.tables.QuickReply.records.length})...`);
    for (const r of backup.tables.QuickReply.records) {
      await prisma.quickReply.upsert({
        where: { id: r.id },
        update: {
          title: r.title,
          category: r.category || "General",
          text: r.text,
          mediaUrl: r.mediaUrl || null,
          mediaName: r.mediaName || null,
          mediaType: r.mediaType || null,
          shortcut: r.shortcut || null,
          createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
          updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
        },
        create: {
          id: r.id,
          title: r.title,
          category: r.category || "General",
          text: r.text,
          mediaUrl: r.mediaUrl || null,
          mediaName: r.mediaName || null,
          mediaType: r.mediaType || null,
          shortcut: r.shortcut || null,
          createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
          updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
        },
      });
      restoredCount++;
    }
  }

  // 12. ChatThread (Parent of ChatMessage)
  if (backup.tables.ChatThread?.records?.length) {
    console.log(`Restoring ChatThread (${backup.tables.ChatThread.records.length})...`);
    for (const r of backup.tables.ChatThread.records) {
      await prisma.chatThread.upsert({
        where: { id: r.id },
        update: {
          clientName: r.clientName,
          phone: r.phone,
          channel: r.channel,
          status: r.status,
          lastMessage: r.lastMessage,
          assignedAgent: r.assignedAgent || "Agente General",
          profilePicUrl: r.profilePicUrl || null,
          environment: r.environment || "farfalina",
          lastMessageAt: r.lastMessageAt ? new Date(r.lastMessageAt) : null,
          externalId: r.externalId || null,
          rawTimestamp: r.rawTimestamp || null,
          unreadCount: Number(r.unreadCount || 0),
          createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
          updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
        },
        create: {
          id: r.id,
          clientName: r.clientName,
          phone: r.phone,
          channel: r.channel,
          status: r.status,
          lastMessage: r.lastMessage,
          assignedAgent: r.assignedAgent || "Agente General",
          profilePicUrl: r.profilePicUrl || null,
          environment: r.environment || "farfalina",
          lastMessageAt: r.lastMessageAt ? new Date(r.lastMessageAt) : null,
          externalId: r.externalId || null,
          rawTimestamp: r.rawTimestamp || null,
          unreadCount: Number(r.unreadCount || 0),
          createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
          updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
        },
      });
      restoredCount++;
    }
  }

  // 13. ChatMessage (Child of ChatThread)
  if (backup.tables.ChatMessage?.records?.length) {
    console.log(`Restoring ChatMessage (${backup.tables.ChatMessage.records.length})...`);
    for (const r of backup.tables.ChatMessage.records) {
      await prisma.chatMessage.upsert({
        where: { id: r.id },
        update: {
          threadId: r.threadId,
          sender: r.sender,
          text: r.text,
          mediaUrl: r.mediaUrl || null,
          mediaType: r.mediaType || null,
          environment: r.environment || "farfalina",
          externalId: r.externalId || null,
          rawTimestamp: r.rawTimestamp || null,
          timestamp: r.timestamp ? new Date(r.timestamp) : null,
          createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
        },
        create: {
          id: r.id,
          threadId: r.threadId,
          sender: r.sender,
          text: r.text,
          mediaUrl: r.mediaUrl || null,
          mediaType: r.mediaType || null,
          environment: r.environment || "farfalina",
          externalId: r.externalId || null,
          rawTimestamp: r.rawTimestamp || null,
          timestamp: r.timestamp ? new Date(r.timestamp) : null,
          createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
        },
      });
      restoredCount++;
    }
  }

  console.log("----------------------------------------");
  console.log(`✅ Successfully restored/upserted ${restoredCount} records!`);
  return restoredCount;
}

if (require.main === module || process.argv[1]?.includes("restore-client-data")) {
  restoreClientData()
    .then((count) => {
      console.log(`Done. Total records processed: ${count}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ Error restoring data:", err);
      process.exit(1);
    });
}
