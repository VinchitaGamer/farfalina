const { initWhatsAppSocket } = require("./lib/whatsapp-socket-manager");

async function main() {
  console.log("Starting WhatsApp socket test on VPS...");
  const result = await initWhatsAppSocket(true, "farfalina");
  console.log("Result from initWhatsAppSocket:", {
    status: result.status,
    hasQR: Boolean(result.qrCodeDataUrl),
    qrLength: result.qrCodeDataUrl?.length
  });
}

main().catch(console.error);
