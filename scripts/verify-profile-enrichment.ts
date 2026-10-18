import path from "path";
import fs from "fs";
import { prisma } from "../lib/db";
import { getInstagramUserProfile, fetchInstagramProfile } from "../lib/instagram-profile";
import { POST } from "../app/api/webhooks/instagram/route";

async function main() {
  console.log("================================================================================");
  console.log("  VERIFICACIÓN AUTOMATIZADA: ENRIQUECIMIENTO PERSISTENTE DE PERFILES (M2)");
  console.log("================================================================================\n");

  const targetIgsid = "1304358138230682"; // Cuenta real verificada de Instagram (@acido_juan)
  const environment = "farfalina";

  // Step 1: Obtener credenciales reales desde ChannelConfig
  console.log("[1/5] Verificando credenciales de Instagram en ChannelConfig...");
  const config = await prisma.channelConfig.findUnique({
    where: { channel_tenant_unique: { channel: "Instagram", environment } },
  });

  if (!config?.instagramAccessToken) {
    throw new Error(`No se encontró token activo de Instagram en ChannelConfig para environment=${environment}`);
  }
  console.log(`✓ Token encontrado (longitud: ${config.instagramAccessToken.length} chars, accountId: ${config.instagramAccountId})\n`);

  // Step 2: Probar llamada en vivo a Meta Graph API v22.0
  console.log(`[2/5] Consultando Meta Graph API v22.0 para IGSID ${targetIgsid}...`);
  const profile = await getInstagramUserProfile(targetIgsid, config.instagramAccessToken);

  if (!profile) {
    throw new Error(`getInstagramUserProfile retornó null para IGSID ${targetIgsid}`);
  }

  console.log("✓ Perfil obtenido con éxito desde Meta Graph API:");
  console.log(`  - ID: ${profile.id}`);
  console.log(`  - Name: ${profile.name}`);
  console.log(`  - Username: @${profile.username}`);
  console.log(`  - ProfilePicUrl: ${profile.profilePicUrl}`);

  if (profile.username !== "acido_juan") {
    throw new Error(`Se esperaba username 'acido_juan', pero se recibió '${profile.username}'`);
  }
  if (!profile.profilePicUrl || !profile.profilePicUrl.startsWith("/uploads/avatars/")) {
    throw new Error(`Se esperaba ruta local en /uploads/avatars/, pero se recibió '${profile.profilePicUrl}'`);
  }
  console.log("✓ Validación de campos y username @acido_juan confirmada.\n");

  // Step 3: Verificar persistencia física del archivo de avatar en disco
  console.log("[3/5] Verificando persistencia física del avatar descargado en disco...");
  const avatarPathOnDisk = path.join(process.cwd(), "public", profile.profilePicUrl.replace(/^\//, ""));
  if (!fs.existsSync(avatarPathOnDisk)) {
    throw new Error(`El archivo de avatar no existe en disco: ${avatarPathOnDisk}`);
  }

  const stat = fs.statSync(avatarPathOnDisk);
  if (stat.size < 500) {
    throw new Error(`El archivo de avatar es sospechosamente pequeño (${stat.size} bytes)`);
  }
  console.log(`✓ Archivo de avatar verificado en disco: ${avatarPathOnDisk}`);
  console.log(`  - Tamaño: ${stat.size} bytes`);
  console.log(`  - Fecha modificación: ${stat.mtime.toISOString()}\n`);

  // Step 4: Probar reuso de caché local (evitar descargas redundantes)
  console.log("[4/5] Probando reuso de avatar en caché...");
  const cachedProfile = await fetchInstagramProfile(targetIgsid, config.instagramAccessToken);
  if (!cachedProfile || cachedProfile.profilePicUrl !== profile.profilePicUrl) {
    throw new Error("El reuso de avatar en caché falló o retornó una ruta diferente");
  }
  console.log(`✓ Reuso de avatar en caché exitoso: ${cachedProfile.profilePicUrl}\n`);

  // Step 5: Probar flujo de webhook end-to-end con persistencia en SQLite dev.db
  console.log("[5/5] Probando Webhook POST end-to-end con actualización en ChatThread y CRMClient...");
  const testExternalMid = `mid_verify_m2_${Date.now()}`;
  const webhookRequest = new Request("http://localhost:3000/api/webhooks/instagram?env=farfalina", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      object: "instagram",
      entry: [
        {
          id: config.instagramAccountId || "29643476368611224",
          time: Date.now(),
          messaging: [
            {
              sender: { id: targetIgsid },
              recipient: { id: config.instagramAccountId || "29643476368611224" },
              timestamp: Date.now(),
              message: {
                mid: testExternalMid,
                text: "Mensaje de prueba para verificación de enriquecimiento M2",
              },
            },
          ],
        },
      ],
    }),
  });

  const webhookResponse = await POST(webhookRequest);
  const webhookBody = await webhookResponse.json();
  console.log("✓ Webhook POST respondió:", JSON.stringify(webhookBody));

  if (!webhookResponse.ok || !webhookBody.success) {
    throw new Error(`Webhook POST falló: ${JSON.stringify(webhookBody)}`);
  }

  // Verificar ChatThread en BD SQLite
  const thread = await prisma.chatThread.findUnique({
    where: {
      chatthread_tenant_unique: {
        channel: "Instagram",
        phone: targetIgsid,
        environment,
      },
    },
  });

  if (!thread) {
    throw new Error(`No se encontró ChatThread para phone=${targetIgsid}`);
  }

  console.log("✓ ChatThread verificado en SQLite:");
  console.log(`  - ID: ${thread.id}`);
  console.log(`  - ClientName: ${thread.clientName}`);
  console.log(`  - ProfilePicUrl: ${thread.profilePicUrl}`);
  console.log(`  - LastMessage: ${thread.lastMessage}`);

  if (thread.clientName !== "@acido_juan") {
    throw new Error(`Se esperaba ChatThread.clientName '@acido_juan', pero tiene '${thread.clientName}'`);
  }
  if (thread.profilePicUrl !== profile.profilePicUrl) {
    throw new Error(`Se esperaba ChatThread.profilePicUrl '${profile.profilePicUrl}', pero tiene '${thread.profilePicUrl}'`);
  }

  // Verificar CRMClient en BD SQLite
  const crmClient = await prisma.cRMClient.findUnique({
    where: { phone: targetIgsid },
  });

  if (!crmClient) {
    throw new Error(`No se encontró CRMClient para phone=${targetIgsid}`);
  }

  console.log("✓ CRMClient verificado en SQLite:");
  console.log(`  - ID: ${crmClient.id}`);
  console.log(`  - Name: ${crmClient.name}`);
  console.log(`  - Notes: ${crmClient.notes}`);

  if (crmClient.name !== "@acido_juan") {
    throw new Error(`Se esperaba CRMClient.name '@acido_juan', pero tiene '${crmClient.name}'`);
  }
  if (!crmClient.notes?.includes("Username: @acido_juan")) {
    throw new Error(`Se esperaba notas con 'Username: @acido_juan', pero tiene: '${crmClient.notes}'`);
  }
  if (!crmClient.notes?.includes(profile.profilePicUrl)) {
    throw new Error(`Se esperaba notas con Avatar '${profile.profilePicUrl}', pero tiene: '${crmClient.notes}'`);
  }

  console.log("\n================================================================================");
  console.log("  TODAS LAS PRUEBAS DE ENRIQUECIMIENTO DE PERFILES (M2) PASARON EXITOSAMENTE!  ");
  console.log("================================================================================");
}

main()
  .catch((err) => {
    console.error("\n❌ ERROR EN VERIFICACIÓN M2:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
