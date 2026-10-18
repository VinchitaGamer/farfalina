import { prisma } from "../lib/db";

async function main() {
  console.log("=== MIGRACIÓN Y LIMPIEZA DE CONTACTOS REALES DE META BUSINESS SUITE ===");

  // 1. Eliminar hilos espurios creados por botones o pestañas de la interfaz
  const invalidNames = [
    "Vista previa de las condiciones",
    "Todos los mensajes",
    "Messenger",
    "Instagram",
    "WhatsApp",
    "Comentarios de Facebook",
    "Comentarios de Instagram",
    "Administrar etiquetas",
    "Editar",
    "Borrar estado",
    "Administrar captura de información de clientes potenciales",
    "Administrar captura de información...",
    "Conversación activa",
  ];

  const deleteResult = await prisma.chatThread.deleteMany({
    where: {
      OR: [
        { clientName: { in: invalidNames } },
        { phone: { in: ["messenger", "editar", "borrar_estado", "administrar_etiquetas", "comentarios_de_facebook", "comentarios_de_instagram"] } },
      ],
    },
  });

  console.log(`✅ Eliminados ${deleteResult.count} hilos espurios de la interfaz.`);

  // 2. Definir los contactos reales extraídos en caliente de Meta Business Suite
  const realContacts = [
    {
      clientName: "jhon",
      channel: "WhatsApp",
      phone: "+59168079141",
      profilePicUrl: "https://lookaside.fbsbx.com/wec/attachment/?f=%01EW%B9%B0%7E%AA%CB%9E5%F7%AC%7E%F2O%92%02%C1%93%1Fv%A2%ABM%BA%B8%3B%EC%21%99%9D%17EOHjy%88EP%D5%5E%BB%CD%EC%9B%A0%C5bJ%C8%AB%8AF%10%7CH%81&u=%01E%D7%9C%24%A2%FB%86z%9D%CF_%98%FE%EE%DD%CE%5E%ADz%A0%D0%8B-%83%5D%E75K%3D%AC1s%CB%F4%9Df%22%C2%C6%CB%B6%AF%E3%A8%60u%97%D1%02%A9j%90%C1%9A%D37&m=%01E%B8%AF%DDD%5Df8%91%CC%1A%DE%3B%D6%B4%F6%3F%E8%0A%B3%28%9B%8Bd%B0%A2%FC%2B%17%5D%2FQ%B4%C0u%C0%16k%1A%87%92%05%D6K%23%0Fi%84y%A5%C6%040i%B7N%FD",
      lastMessage: "hooola",
      status: "Por Responder",
      environment: "farfalina",
      messages: [
        { sender: "bot", text: "Lo siento, tuve un problema técnico momentáneo. ¿Podrías repetirme eso?" },
        { sender: "bot", text: "Lo siento, tuve un problema técnico momentáneo. ¿Podrías repetirme eso?" },
        { sender: "customer", text: "hola" },
        { sender: "agent", text: "hoola" },
        { sender: "customer", text: "hooola" },
      ],
    },
    {
      clientName: "Danito",
      channel: "Instagram",
      phone: "340282366841710301244259456430560347250",
      profilePicUrl: "https://instagram.flpb1-1.fna.fbcdn.net/v/t51.2885-19/490225652_686215860479358_7648516339975665594_n.jpg?stp=dst-jpg_s150x150_tt6&_nc_cat=101&_nc_map=urlgen_bucketless&ccb=7-5&_nc_sid=f7ccc5&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLnd3dy4xMDgwLkMzIn0%3D&_nc_ohc=1nJl0jAqWeIQ7kNvwHwEAx2&_nc_oc=AdoG335yhWFv1l_P9UOK8_VxTlhZI2caqsZ2s3aGre9HWfjSIDtRNISGBXTkjRJRpN3aK3S5z_0YvBaeMeXO88QK&_nc_ad=z-m&_nc_cid=0&_nc_zt=24&_nc_ht=instagram.flpb1-1.fna&_nc_ss=7a22e&oh=00_AQM-XbblTa17fJygR1YpCuLSPvNmGYbY9ivqEJa55YBKZw&oe=6AC4D23E",
      lastMessage: "Danito envió un archivo adjunto",
      status: "Por Responder",
      environment: "farfalina",
      messages: [
        { sender: "customer", text: "Importante el \"no me voy a matar\", ya me estaba asustando" },
        { sender: "customer", text: "jakaksjd" },
        { sender: "customer", text: "oye viejo no te metas con venezuela" },
        { sender: "customer", text: "[Archivo adjunto recibido]" },
      ],
    },
    {
      clientName: "Chris Kass (@chriszs.k)",
      channel: "Instagram",
      phone: "340282366841710301244258613691574613295",
      profilePicUrl: "https://instagram.flpb1-1.fna.fbcdn.net/v/t51.89012-19/573323465_1219825463302212_7278921664109726296_n.jpg?stp=dst-jpg_s150x150_tt6&_nc_cat=1&ccb=7-5&_nc_sid=f7ccc5&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLnd3dy5DMyJ9&_nc_ohc=KsOoGv21mmoQ7kNvwE52MQ3&_nc_oc=Adqcb4XgcrAQA7Omlcn-Bc_RF2ne5VPzCRcAaOKtkU8MDC_82gbWK0KV2oc6cnoC6JKFpxAGY0_ZpRcf9wlAx4Xt&_nc_ad=z-m&_nc_cid=0&_nc_zt=24&_nc_ht=instagram.flpb1-1.fna&_nc_gid=GJGuLQjrwC-_LELLIi4_vg&_nc_ss=7a22e&oh=00_AQMwYNqg4gQvksTCo_iutOcOjVFdkf7s6_qZ0g-1rDv87w&oe=6AC4F1A2",
      lastMessage: "Chris envió un archivo adjunto",
      status: "Por Responder",
      environment: "farfalina",
      messages: [
        { sender: "customer", text: "ya no me mandes nada" },
        { sender: "customer", text: "caardo" },
        { sender: "customer", text: "[Archivo adjunto recibido]" },
      ],
    },
    {
      clientName: "Jhoseph Gutierrez",
      channel: "Instagram",
      phone: "340282366841710301244258502320459382123",
      profilePicUrl: "https://instagram.flpb1-2.fna.fbcdn.net/v/t51.82787-19/829072573_18211484194364495_1085441013936944628_n.jpg?stp=dst-jpg_s150x150_tt6&_nc_cat=100&_nc_map=urlgen_bucketless&ccb=7-5&_nc_sid=f7ccc5&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLnd3dy4xMDgwLkMzIn0%3D&_nc_ohc=VTX7nog_2zEQ7kNvwFGw7F4&_nc_oc=AdoHeycGkIfsbtVgpjSgacp65Us7XvDTI0pXKEH2CjlLIf3ymFm5EqvrtUVuhmBut1fxuf7rFX7S5f6wbOvjuCAX&_nc_ad=z-m&_nc_cid=0&_nc_zt=24&_nc_ht=instagram.flpb1-2.fna&_nc_gid=GJGuLQjrwC-_LELLIi4_vg&_nc_ss=7a22e&oh=00_AQPwmT2uo_pQRGdY5drNBMj-c1_gEd7HbqodA20yj3dHIg&oe=6AC4D7E9",
      lastMessage: "Jhoseph envió un archivo adjunto",
      status: "Por Responder",
      environment: "farfalina",
      messages: [
        { sender: "customer", text: "[Archivo adjunto recibido]" },
      ],
    },
    {
      clientName: "Monserrat Claure",
      channel: "Instagram",
      phone: "340282366841710301244259725171716805485",
      profilePicUrl: "https://instagram.flpb1-2.fna.fbcdn.net/v/t51.82787-19/825710422_18427964332196326_3373578088202084918_n.jpg?stp=dst-jpg_s150x150_tt6&_nc_cat=109&_nc_map=urlgen_bucketless&ccb=7-5&_nc_sid=f7ccc5&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLnd3dy4xMDgwLkMzIn0%3D&_nc_ohc=PDhTBUeJLiQQ7kNvwEwVcPZ&_nc_oc=AdqgEE_RdJdDp45NEaGwDqD3nGaikLRUUI0KogzKAo7AxH6jZop3Yxc0TCVDq2c_Lq9lan-hENE__NnDGhsxpaM4&_nc_ad=z-m&_nc_cid=0&_nc_zt=24&_nc_ht=instagram.flpb1-2.fna&_nc_gid=GJGuLQjrwC-_LELLIi4_vg&_nc_ss=7a22e&oh=00_AQOkcfbn23pvfr5joKqdgxhkySikiTX5ukyVYdc-RXxKXw&oe=6AC4CADD",
      lastMessage: "Tú: 🤪",
      status: "Por Responder",
      environment: "farfalina",
      messages: [
        { sender: "customer", text: "ese día solo me dijiste eeeeh monchis te quieres? yo esperaba algo mejor" },
        { sender: "customer", text: "le doy un 6/10" },
        { sender: "agent", text: "🤪" },
      ],
    },
    {
      clientName: "⋆˚࿔ 𝓐𝓵𝓲𝜗𝜚˚⋆",
      channel: "Instagram",
      phone: "340282366841710301244286777833813105241",
      profilePicUrl: "https://instagram.flpb1-2.fna.fbcdn.net/v/t51.82787-19/786755511_17997585276005953_8541111597902381927_n.jpg?stp=dst-jpg_s150x150_tt6&_nc_cat=110&_nc_map=urlgen_bucketless&ccb=7-5&_nc_sid=f7ccc5&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLnd3dy45MTUuQzMifQ%3D%3D&_nc_ohc=J4qcz1IZZNcQ7kNvwG7AjNd&_nc_oc=AdpHrzBiIr7ly2_uWXZA9bbhQ2lML7Dmq7dJiKcraJGqJYEOYYfyxjL32CZiRMKKHpnoALJ5NrfLXqLw0Qjmnq-j&_nc_ad=z-m&_nc_cid=0&_nc_zt=24&_nc_ht=instagram.flpb1-2.fna&_nc_gid=ac5bDI0g_MVQ3_0Fz79F_w&_nc_ss=7a22e&oh=00_AQPrKTpVcbNDfBmD6wE0hlpilSL-waa8wbGkqeJEB4W3Yw&oe=6AC4EA4A",
      lastMessage: "JJAJAJAJAJA re salados",
      status: "Por Responder",
      environment: "farfalina",
      messages: [
        { sender: "customer", text: "Ahorita ando camino al concierto de jess y joy" },
        { sender: "customer", text: "Los conoces?" },
        { sender: "customer", text: "JJAJAJAJAJA re salados" },
      ],
    },
  ];

  // 3. Upsert de cada contacto real con sus fotos y mensajes
  for (const contact of realContacts) {
    const thread = await prisma.chatThread.upsert({
      where: {
        chatthread_tenant_unique: {
          channel: contact.channel,
          phone: contact.phone,
          environment: contact.environment,
        },
      },
      update: {
        clientName: contact.clientName,
        lastMessage: contact.lastMessage,
        profilePicUrl: contact.profilePicUrl,
        status: contact.status,
        updatedAt: new Date(),
      },
      create: {
        clientName: contact.clientName,
        channel: contact.channel,
        phone: contact.phone,
        profilePicUrl: contact.profilePicUrl,
        lastMessage: contact.lastMessage,
        status: contact.status,
        environment: contact.environment,
      },
    });

    // Insertar mensajes si no existen aún
    for (const msg of contact.messages) {
      const exists = await prisma.chatMessage.findFirst({
        where: {
          threadId: thread.id,
          text: msg.text,
          sender: msg.sender,
        },
      });

      if (!exists) {
        await prisma.chatMessage.create({
          data: {
            threadId: thread.id,
            sender: msg.sender,
            text: msg.text,
            environment: contact.environment,
          },
        });
      }
    }

    console.log(`✅ Contacto sincronizado: ${contact.clientName} (${contact.channel}) con foto de perfil.`);
  }

  console.log("=== MIGRACIÓN COMPLETADA EXITOSAMENTE ===");
}

main().catch((e) => {
  console.error("Error en migración:", e);
  process.exit(1);
});
