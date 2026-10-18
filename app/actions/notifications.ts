"use server";

import { prisma } from "@/lib/db";

import { z } from "zod";

const SystemNotificationSchema = z.object({
  id: z.string(),
  category: z.enum(["inventory", "logistics", "register", "crm", "omnichannel"]),
  severity: z.enum(["critical", "warning", "info"]),
  title: z.string(),
  message: z.string(),
  createdAt: z.string(),
  targetView: z.enum(["pos", "orders", "crm", "omnichannel"]),
  targetTab: z.enum(["terminal", "stock", "register", "agenda", "calendar"]).optional(),
  targetSearch: z.string().optional(),
  targetId: z.string().optional(),
});
export type SystemNotification = z.infer<typeof SystemNotificationSchema>;

import { ActionResponse } from "@/types/action-response";

export async function getSystemNotificationsAction(): Promise<ActionResponse<SystemNotification[]>> {
  try {
    const notifications: SystemNotification[] = [];
    const now = new Date();

    // 1. Fetch Raw Ingredients for Stock & Expiry Alerts
    const ingredients = await prisma.rawIngredient.findMany({
      orderBy: { name: "asc" },
    });

    for (const ing of ingredients) {
      // Stock Out Alert (Critical)
      if (ing.available <= 0) {
        notifications.push({
          id: `stock-empty-${ing.id}`,
          category: "inventory",
          severity: "critical",
          title: `Insumo Agotado: ${ing.name}`,
          message: `Stock en 0 ${ing.unit}. Los arreglos que usan este insumo no podrán elaborarse.`,
          createdAt: ing.updatedAt ? ing.updatedAt.toISOString() : now.toISOString(),
          targetView: "pos",
          targetTab: "stock",
          targetSearch: ing.name,
          targetId: ing.id,
        });
      }
      // Low Stock Alert (Warning)
      else if (ing.available <= ing.warningThreshold) {
        notifications.push({
          id: `stock-low-${ing.id}`,
          category: "inventory",
          severity: "warning",
          title: `Bajo Stock: ${ing.name}`,
          message: `Quedan ${ing.available} ${ing.unit} (umbral de alerta: ${ing.warningThreshold} ${ing.unit}).`,
          createdAt: ing.updatedAt ? ing.updatedAt.toISOString() : now.toISOString(),
          targetView: "pos",
          targetTab: "stock",
          targetSearch: ing.name,
          targetId: ing.id,
        });
      }

      // Expiry & Shelf Life Alert (Only for Perishable Insumos)
      if (ing.shelfLifeDays !== null && ing.shelfLifeDays !== undefined && ing.shelfLifeDays > 0) {
        const entryDate = ing.entryDate ? new Date(ing.entryDate) : new Date();
        const diffDays = Math.floor((now.getTime() - entryDate.getTime()) / (1000 * 3600 * 24));
        const daysLeft = ing.shelfLifeDays - diffDays;

        if (daysLeft <= 0 && ing.available > 0) {
          notifications.push({
            id: `expiry-expired-${ing.id}`,
            category: "inventory",
            severity: "critical",
            title: `Insumo Vencido: ${ing.name}`,
            message: `Superó su vida útil estimada (${ing.shelfLifeDays} días). Registra merma para ajustar stock.`,
            createdAt: now.toISOString(),
            targetView: "pos",
            targetTab: "stock",
            targetSearch: ing.name,
            targetId: ing.id,
          });
        } else if (daysLeft <= 2 && ing.available > 0) {
          notifications.push({
            id: `expiry-warning-${ing.id}`,
            category: "inventory",
            severity: "warning",
            title: `Próximo a Marchitarse: ${ing.name}`,
            message: `Quedan ${daysLeft} día(s) de frescura estimada (${ing.available} ${ing.unit} en stock).`,
            createdAt: now.toISOString(),
            targetView: "pos",
            targetTab: "stock",
            targetSearch: ing.name,
            targetId: ing.id,
          });
        }
      }
    }

    // 2. Fetch Orders for Today Delivery Alerts
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const pendingOrders = await prisma.orderDelivery.findMany({
      where: {
        deliveryDate: {
          gte: todayStart,
          lte: todayEnd,
        },
        status: {
          not: "Entregado",
        },
      },
      orderBy: { deliveryTime: "asc" },
    });

    for (const order of pendingOrders) {
      notifications.push({
        id: `order-today-${order.id}`,
        category: "logistics",
        severity: order.status === "En camino" ? "info" : "warning",
        title: `Entrega de Hoy #${order.orderNumber}`,
        message: `Arreglo "${order.arrangementName}" para ${order.recipientName} a las ${order.deliveryTime} (${order.zone}).`,
        createdAt: order.createdAt ? order.createdAt.toISOString() : now.toISOString(),
        targetView: "orders",
        targetTab: "agenda",
        targetId: order.id,
      });
    }

    // 3. Cash Register Shift Status
    const openShift = await prisma.cashRegisterShift.findFirst({
      where: { status: "Open" },
      orderBy: { createdAt: "desc" },
    });

    if (openShift) {
      const shiftCreated = new Date(openShift.createdAt);
      const hoursOpen = Math.floor((now.getTime() - shiftCreated.getTime()) / (1000 * 3600));

      if (hoursOpen >= 8) {
        notifications.push({
          id: `shift-open-${openShift.id}`,
          category: "register",
          severity: "warning",
          title: "Turno de Caja Extendido",
          message: `El turno de ${openShift.cashierName} lleva ${hoursOpen}h abierto. Recuerda realizar el arqueo y cierre diario.`,
          createdAt: openShift.createdAt.toISOString(),
          targetView: "pos",
          targetTab: "register",
          targetId: openShift.id,
        });
      }
    }

    // 4. Omnichannel Pending Chats
    const unreadThreads = await prisma.chatThread.findMany({
      where: { status: "Por Responder" },
      take: 5,
      orderBy: { updatedAt: "desc" },
    });

    for (const thread of unreadThreads) {
      notifications.push({
        id: `chat-pending-${thread.id}`,
        category: "omnichannel",
        severity: "info",
        title: `Mensaje por Responder: ${thread.clientName}`,
        message: `Canal ${thread.channel}: "${thread.lastMessage.slice(0, 50)}${thread.lastMessage.length > 50 ? "..." : ""}"`,
        createdAt: thread.updatedAt ? thread.updatedAt.toISOString() : now.toISOString(),
        targetView: "omnichannel",
        targetId: thread.id,
      });
    }

    // 5. CRM Special Events (Within next 3 days)
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 3600 * 1000);
    const upcomingEvents = await prisma.cRMSpecialEvent.findMany({
      where: {
        eventDate: {
          gte: todayStart,
          lte: threeDaysLater,
        },
      },
      include: {
        client: true,
      },
      take: 5,
    });

    for (const event of upcomingEvents) {
      notifications.push({
        id: `crm-event-${event.id}`,
        category: "crm",
        severity: "info",
        title: `Evento Especial: ${event.title}`,
        message: `Cliente: ${event.client?.name || "Registrado"} - ${event.eventType} el ${new Date(event.eventDate).toLocaleDateString()}`,
        createdAt: now.toISOString(),
        targetView: "crm",
        targetId: event.id,
      });
    }

    return {
      success: true,
      data: notifications,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al obtener notificaciones";
    return {
      success: false,
      error: errorMessage,
      code: "NOTIFICATIONS_FETCH_ERROR",
    };
  }
}
