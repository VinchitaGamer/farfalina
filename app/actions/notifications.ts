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
import { getBoliviaDateStr, extractCalendarDateStr, formatDateBolivia } from "@/lib/utils";

export async function getSystemNotificationsAction(
  system: "floreria" | "carissma" = "floreria"
): Promise<ActionResponse<SystemNotification[]>> {
  try {
    const notifications: SystemNotification[] = [];
    const now = new Date();
    const todayYmd = getBoliviaDateStr(now);
    const todayStart = new Date(`${todayYmd}T00:00:00.000-04:00`);
    const todayEnd = new Date(`${todayYmd}T23:59:59.999-04:00`);
    const threeDaysLater = new Date(todayEnd.getTime() + 3 * 24 * 3600 * 1000);
    const envKey = system === "carissma" ? "carissma" : "farfalina";

    if (system === "carissma") {
      // 1. Vestidos en lavandería o mantenimiento
      const maintenanceDresses = await prisma.dress.findMany({
        where: {
          OR: [
            { status: "En Lavandería" },
            { condition: "Requiere Mantenimiento" },
          ],
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
      });

      for (const dress of maintenanceDresses) {
        const isMaint = dress.condition === "Requiere Mantenimiento";
        notifications.push({
          id: `dress-maint-${dress.id}`,
          category: "inventory",
          severity: isMaint ? "critical" : "warning",
          title: `${isMaint ? "Requiere Mantenimiento" : dress.status}: ${dress.name}`,
          message: `Talla ${dress.size} (${dress.color}) requiere seguimiento antes de habilitarse nuevamente.`,
          createdAt: dress.updatedAt ? dress.updatedAt.toISOString() : now.toISOString(),
          targetView: "pos",
          targetTab: "stock",
          targetSearch: dress.name,
          targetId: dress.id,
        });
      }

      // 2. Rentas vencidas o programadas para hoy
      const activeBookings = await prisma.rentalBooking.findMany({
        where: {
          rentalStatus: {
            in: ["Reservado", "En Prueba", "Entregado", "Devuelto / Revisión"],
          },
        },
        include: { dress: true },
        orderBy: { rentalEndDate: "asc" },
      });

      for (const booking of activeBookings) {
        const startYmd = extractCalendarDateStr(booking.rentalStartDate);
        const endYmd = extractCalendarDateStr(booking.rentalEndDate);
        if (booking.rentalStatus === "Entregado" && endYmd < todayYmd) {
          notifications.push({
            id: `rental-overdue-${booking.id}`,
            category: "logistics",
            severity: "critical",
            title: `Devolución Vencida #${booking.contractNumber}`,
            message: `"${booking.dressName}" (${booking.clientName}) debía devolverse el ${formatDateBolivia(booking.rentalEndDate)}.`,
            createdAt: booking.updatedAt ? booking.updatedAt.toISOString() : now.toISOString(),
            targetView: "orders",
            targetTab: "agenda",
            targetId: booking.id,
          });
        } else if (endYmd === todayYmd && booking.rentalStatus === "Entregado") {
          notifications.push({
            id: `rental-return-today-${booking.id}`,
            category: "logistics",
            severity: "warning",
            title: `Retorno Hoy #${booking.contractNumber}`,
            message: `Recepción programada hoy de "${booking.dressName}" — Clienta: ${booking.clientName}.`,
            createdAt: booking.updatedAt ? booking.updatedAt.toISOString() : now.toISOString(),
            targetView: "orders",
            targetTab: "agenda",
            targetId: booking.id,
          });
        } else if (startYmd === todayYmd && (booking.rentalStatus === "Reservado" || booking.rentalStatus === "En Prueba")) {
          notifications.push({
            id: `rental-pickup-today-${booking.id}`,
            category: "logistics",
            severity: "info",
            title: `Entrega Hoy #${booking.contractNumber}`,
            message: `Retiro programado hoy de "${booking.dressName}" para ${booking.clientName}.`,
            createdAt: booking.createdAt ? booking.createdAt.toISOString() : now.toISOString(),
            targetView: "orders",
            targetTab: "agenda",
            targetId: booking.id,
          });
        }
      }

      // 3. Turno de Caja Carissma extendido
      const openCarissmaShift = await prisma.carissmaCashShift.findFirst({
        where: { status: "Open" },
        orderBy: { createdAt: "desc" },
      });

      if (openCarissmaShift) {
        const hoursOpen = Math.floor((now.getTime() - new Date(openCarissmaShift.createdAt).getTime()) / (1000 * 3600));
        if (hoursOpen >= 8) {
          notifications.push({
            id: `carissma-shift-open-${openCarissmaShift.id}`,
            category: "register",
            severity: "warning",
            title: "Turno de Caja Carissma Extendido",
            message: `El turno de ${openCarissmaShift.cashierName} lleva ${hoursOpen}h abierto. Recuerda cerrar y arquear caja.`,
            createdAt: openCarissmaShift.createdAt.toISOString(),
            targetView: "pos",
            targetTab: "register",
            targetId: openCarissmaShift.id,
          });
        }
      }
    } else {
      // 1. Fetch Raw Ingredients for Stock & Expiry Alerts
      const ingredients = await prisma.rawIngredient.findMany({
        orderBy: { name: "asc" },
      });

      for (const ing of ingredients) {
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
        } else if (ing.available <= ing.warningThreshold) {
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

      // 2. Fetch Orders for Today Delivery Alerts (Bolivia timezone)
      const pendingOrders = await prisma.orderDelivery.findMany({
        where: {
          deliveryDate: {
            gte: new Date(`${todayYmd}T00:00:00.000Z`),
            lte: todayEnd,
          },
          status: {
            not: "Entregado",
          },
        },
        orderBy: { deliveryTime: "asc" },
      });

      for (const order of pendingOrders) {
        if (extractCalendarDateStr(order.deliveryDate) !== todayYmd) continue;
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
    }

    // 4. Omnichannel Pending Chats (Scoped by tenant environment)
    const unreadThreads = await prisma.chatThread.findMany({
      where: { status: "Por Responder", environment: envKey },
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

    // 5. CRM Special Events (Within next 3 days, scoped by tenant environment)
    const upcomingEvents = await prisma.cRMSpecialEvent.findMany({
      where: {
        environment: envKey,
        eventDate: {
          gte: new Date(`${todayYmd}T00:00:00.000Z`),
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
        message: `Cliente: ${event.client?.name || "Registrado"} - ${event.eventType} el ${formatDateBolivia(event.eventDate)}`,
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
