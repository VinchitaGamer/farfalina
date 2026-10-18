const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

function generatePdf() {
  const doc = new PDFDocument({
    margin: 40,
    size: "A4",
    info: {
      Title: "Documento Oficial de Entrega de Demostración - SaaS Florería & Alquiler",
      Author: "SaaS Enterprise Core Team",
    },
  });

  const outputPath = path.join(__dirname, "demo_delivery_report.pdf");
  const writeStream = fs.createWriteStream(outputPath);
  doc.pipe(writeStream);

  // Palette
  const PRIMARY = "#C85A32"; // Terracotta
  const DARK = "#2C2523";
  const SECONDARY = "#786C68";
  const LIGHT_BG = "#FDFBF7";
  const EMERALD = "#059669";
  const BORDER = "#E6E1DC";

  // HEADER
  doc
    .rect(0, 0, doc.page.width, 100)
    .fill(PRIMARY);

  doc
    .fillColor("#FFFFFF")
    .fontSize(18)
    .font("Helvetica-Bold")
    .text("Floreria Farfalina & Alquiler Carissma", 40, 30);

  doc
    .fontSize(12)
    .font("Helvetica")
    .text("Documento Oficial de Entrega de Demostración (SaaS Enterprise)", 40, 56);

  doc
    .fontSize(9)
    .text(`Fecha de Emision: ${new Date().toLocaleDateString()} | Estado: Demo Funcional Verificada`, 40, 75);

  doc.y = 120;

  // 1. RESUMEN EJECUTIVO
  sectionTitle(doc, "1. Resumen Ejecutivo", PRIMARY);

  doc
    .fontSize(9.5)
    .font("Helvetica")
    .fillColor(DARK)
    .text(
      "El presente documento constituye la entrega oficial del prototipo funcional y sistema demostrativo SaaS Enterprise, desarrollado bajo estandares de arquitectura moderna (Next.js 14 App Router, TypeScript estricto, Tailwind CSS, Shadcn UI, Zustand y Prisma ORM con base de datos SQLite persistente).",
      40,
      doc.y,
      { width: 515, align: "justify" }
    );

  doc.moveDown(0.5);

  doc.text(
    "El sistema se encuentra 100% populado con datos reales y demostrativos, incluyendo catalogo de productos con fotos HD, insumos de floreria, hilos de chat omnicanal, historial de tickets POS, pedidos programados en el calendario y prendas del modulo de alquiler Carissma.",
    { width: 515, align: "justify" }
  );

  doc.moveDown(1.5);

  // 2. MODULOS IMPLEMENTADOS
  sectionTitle(doc, "2. Modulos Implementados & Caracteristicas Construidas", PRIMARY);

  const modules = [
    {
      title: "Modulo Omnicanalidad (Atencion & Emision de Tickets)",
      desc: "Simulacion multi-canal (WhatsApp, FB, TikTok), vista dividida con dedicatoria en 1-clic y emision de tickets con receta de insumos, margen neto en vivo y descuento atomico en DB.",
    },
    {
      title: "Modulo Punto de Venta (POS) & Inventario Vivo",
      desc: "Atajos F2/F4, cobro directo con ticket impreso, creacion de nuevos insumos vivos (flores, follajes, jarrones, cintas), registro de mermas y Ticket Manual (Receta & Despacho).",
    },
    {
      title: "Modulo Catalogo E-Commerce & Edicion Individual",
      desc: "Tarjetas con fotos HD de Unsplash, modal interactivo de edicion (EditArrangementModal) para modificar nombres, precios, fotos, descripciones y recetas de materiales.",
    },
    {
      title: "Modulo Logistica, Calendario & Kanban",
      desc: "Ubicacion automatica de tickets segun fecha de entrega (deliveryDate corregida en UTC), insignias de colores de estado Kanban (Prep, Camino, Entregado) y Agenda de Actividades (Hoy/Semana/Mes).",
    },
    {
      title: "Modulo Arqueo de Caja & Informe Oficial PDF",
      desc: "Conciliacion automatica de fondos, calculo de discrepancias (Sobrante/Faltante), Hoja Oficial de Arqueo en PDF/Impresion con firmas y tabla de Historial de Cierres Archivados.",
    },
    {
      title: "Modulo Alquiler Carissma",
      desc: "Gestion de vestidos y prendas de alquiler de gala integrados en la arquitectura.",
    },
  ];

  modules.forEach((mod, idx) => {
    if (doc.y > 680) doc.addPage();

    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .fillColor(PRIMARY)
      .text(`${String.fromCharCode(65 + idx)}. ${mod.title}`);

    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor(DARK)
      .text(mod.desc, { width: 515, align: "justify" });

    doc.moveDown(0.8);
  });

  doc.moveDown(1);

  // 3. FLUJO DE TRABAJO DIARIO
  if (doc.y > 600) doc.addPage();
  sectionTitle(doc, "3. Flujo de Trabajo Operativo Diario (Paso a Paso)", PRIMARY);

  const steps = [
    { time: "08:30 AM", title: "Apertura de Caja", desc: "Apertura de turno en POS con Saldo Inicial ($350 Bs) y revision de alertas de stock bajo." },
    { time: "09:00 AM", title: "Atencion Omnicanal & POS", desc: "Recepcion de chats de clientes, seleccion de dedicatoria en 1-clic y emision de ticket con receta." },
    { time: "12:00 PM", title: "Impresion & Ensamblado", desc: "Impresion de tarjetas dedicatorias desde Agenda de Actividades y armado del arreglo floral." },
    { time: "02:00 PM", title: "Logistica & Envios", desc: "Despacho con actualizacion de estado en Kanban (En camino -> Entregado) y badges en calendario." },
    { time: "06:00 PM", title: "Control de Stock & Merma", desc: "Conteo final de tallos y registro de mermas por marchitamiento o daño de transporte." },
    { time: "06:30 PM", title: "Cierre de Caja & PDF", desc: "Declaracion de efectivo contado, conciliacion automatica, firma e impresion de Hoja de Arqueo PDF." },
  ];

  steps.forEach((st) => {
    if (doc.y > 700) doc.addPage();

    // Box row
    const startY = doc.y;
    doc
      .rect(40, startY, 515, 32)
      .fillAndStroke(LIGHT_BG, BORDER);

    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor(PRIMARY)
      .text(st.time, 50, startY + 10);

    doc
      .fillColor(DARK)
      .font("Helvetica-Bold")
      .text(st.title, 110, startY + 10);

    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(SECONDARY)
      .text(st.desc, 230, startY + 6, { width: 315 });

    doc.y = startY + 38;
  });

  doc.moveDown(1.5);

  // 4. ROADMAP FUTURO
  if (doc.y > 600) doc.addPage();
  sectionTitle(doc, "4. Lo que Falta / Roadmap Futuro para Produccion", PRIMARY);

  const roadmap = [
    { name: "Conector Oficial WhatsApp Cloud API", desc: "Integracion webhook directa con Meta para recibir mensajes reales." },
    { name: "Pasarela de Pagos (Stripe / QR)", desc: "Cobros online automaticos desde e-commerce y links de pago en chat." },
    { name: "Notificaciones SMS / WhatsApp Destinatario", desc: "Mensaje automatico 'Tu pedido esta en camino' con tracker en vivo." },
    { name: "Modulo de Analitica & Costeo Avanzado", desc: "Reporte grafico de flor mas vendida y rentabilidad por diseñador." },
    { name: "Autenticacion & Roles Granulares (RBAC)", desc: "Login por usuario con roles de Cajero, Florista, Repartidor y Admin." },
  ];

  roadmap.forEach((item) => {
    if (doc.y > 700) doc.addPage();

    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor(DARK)
      .text(`• ${item.name}: `, { continued: true })
      .font("Helvetica")
      .fillColor(SECONDARY)
      .text(item.desc);

    doc.moveDown(0.5);
  });

  // FOOTER SIGNATURE
  doc.moveDown(2);
  if (doc.y > 680) doc.addPage();

  const footerY = doc.y;
  doc
    .strokeColor(BORDER)
    .lineWidth(1)
    .lineCap("butt")
    .moveTo(40, footerY)
    .lineTo(240, footerY)
    .stroke();

  doc
    .moveTo(315, footerY)
    .lineTo(555, footerY)
    .stroke();

  doc
    .fontSize(8.5)
    .font("Helvetica-Bold")
    .fillColor(DARK)
    .text("Firma Ingenieria SaaS Core", 40, footerY + 5, { width: 200, align: "center" })
    .text("Firma Gerencia & Cliente", 315, footerY + 5, { width: 240, align: "center" });

  doc.end();
  console.log("PDF generado exitosamente en:", outputPath);
}

function sectionTitle(doc, title, color) {
  doc
    .fontSize(12)
    .font("Helvetica-Bold")
    .fillColor(color)
    .text(title);

  doc
    .strokeColor(color)
    .lineWidth(1)
    .moveTo(40, doc.y + 2)
    .lineTo(555, doc.y + 2)
    .stroke();

  doc.moveDown(0.6);
}

generatePdf();
