import { prisma } from "../lib/db";

async function main() {
  console.log("Seeding database with production demo data...");

  // Clear existing records in correct relation order
  await prisma.dress.deleteMany();
  await prisma.arrangementRecipeItem.deleteMany();
  await prisma.arrangement.deleteMany();
  await prisma.mermaLog.deleteMany();
  await prisma.rawIngredient.deleteMany();
  await prisma.pOSTicketItem.deleteMany();
  await prisma.pOSTicket.deleteMany();
  await prisma.cashRegisterShift.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.chatThread.deleteMany();
  await prisma.orderDelivery.deleteMany();
  await prisma.cRMSpecialEvent.deleteMany();
  await prisma.cRMClient.deleteMany();

  // ==========================================
  // 1. Raw Ingredients (Stock Vivo de Insumos)
  // ==========================================
  const roses = await prisma.rawIngredient.create({
    data: { name: "Rosas Rojas Importadas", type: "Flor", available: 240, unit: "tallos", warningThreshold: 40, costPerUnit: 4.5 },
  });
  const yellowRoses = await prisma.rawIngredient.create({
    data: { name: "Rosas Amarillas Silvestres", type: "Flor", available: 120, unit: "tallos", warningThreshold: 20, costPerUnit: 4.0 },
  });
  const whiteRoses = await prisma.rawIngredient.create({
    data: { name: "Rosas Blancas Ecuador", type: "Flor", available: 180, unit: "tallos", warningThreshold: 30, costPerUnit: 4.8 },
  });
  const sunflowers = await prisma.rawIngredient.create({
    data: { name: "Girasoles Holandeses", type: "Flor", available: 95, unit: "tallos", warningThreshold: 15, costPerUnit: 6.0 },
  });
  const lilies = await prisma.rawIngredient.create({
    data: { name: "Lirios Blancos Aromáticos", type: "Flor", available: 60, unit: "tallos", warningThreshold: 10, costPerUnit: 8.0 },
  });
  const orchids = await prisma.rawIngredient.create({
    data: { name: "Orquídeas Phalaenopsis Doble Vara", type: "Flor", available: 24, unit: "varas", warningThreshold: 5, costPerUnit: 45.0 },
  });
  const tulips = await prisma.rawIngredient.create({
    data: { name: "Tulipanes Amarillos Importados", type: "Flor", available: 80, unit: "tallos", warningThreshold: 15, costPerUnit: 9.0 },
  });
  const eucalyptus = await prisma.rawIngredient.create({
    data: { name: "Follaje Eucalipto Fino", type: "Follaje", available: 150, unit: "ramitas", warningThreshold: 30, costPerUnit: 2.0 },
  });
  const ferns = await prisma.rawIngredient.create({
    data: { name: "Follaje Helecho Cuero", type: "Follaje", available: 110, unit: "ramitas", warningThreshold: 25, costPerUnit: 1.8 },
  });
  const glassVase = await prisma.rawIngredient.create({
    data: { name: "Jarrón de Cristal Cilíndrico 25cm", type: "Base/Jarrón", available: 25, unit: "piezas", warningThreshold: 5, costPerUnit: 25.0 },
  });
  const luxuryBox = await prisma.rawIngredient.create({
    data: { name: "Caja Sombrerera Negra Matizada", type: "Base/Jarrón", available: 18, unit: "piezas", warningThreshold: 5, costPerUnit: 30.0 },
  });
  const heartBox = await prisma.rawIngredient.create({
    data: { name: "Caja Corazón Roja Velvet", type: "Base/Jarrón", available: 14, unit: "piezas", warningThreshold: 4, costPerUnit: 35.0 },
  });
  const silkRibbon = await prisma.rawIngredient.create({
    data: { name: "Cinta de Seda Terracota (Metro)", type: "Accesorio", available: 100, unit: "metros", warningThreshold: 15, costPerUnit: 1.5 },
  });
  const teddyBear = await prisma.rawIngredient.create({
    data: { name: "Oso de Peluche Gigante 45cm", type: "Accesorio", available: 10, unit: "piezas", warningThreshold: 3, costPerUnit: 55.0 },
  });

  // ==========================================
  // 2. Arrangements Catálogo E-Commerce
  // ==========================================
  await prisma.arrangement.create({
    data: {
      name: "Bouquet Imperial 24 Rosas Rojas",
      category: "Rosas",
      price: 280.0,
      featured: true,
      image: "https://images.unsplash.com/photo-1561181286-d3fee7d55364?auto=format&fit=crop&w=800&q=80",
      description: "Espectacular bouquet de 24 rosas rojas seleccionadas a mano, envueltas en fino papel kraft artesanal con cinta de seda.",
      recipeItems: {
        create: [
          { rawIngredientId: roses.id, quantityNeeded: 24 },
          { rawIngredientId: eucalyptus.id, quantityNeeded: 4 },
          { rawIngredientId: silkRibbon.id, quantityNeeded: 2 },
        ],
      },
    },
  });

  await prisma.arrangement.create({
    data: {
      name: "Caja Premium Girasoles y Lirios Sol de Verano",
      category: "Girasoles",
      price: 240.0,
      featured: true,
      image: "https://images.unsplash.com/photo-1597848212624-a19eb35e2651?auto=format&fit=crop&w=800&q=80",
      description: "Vibrante arreglo primaveral en elegante caja de regalo con girasoles frescos y lirios blancos aromáticos.",
      recipeItems: {
        create: [
          { rawIngredientId: sunflowers.id, quantityNeeded: 6 },
          { rawIngredientId: lilies.id, quantityNeeded: 4 },
          { rawIngredientId: luxuryBox.id, quantityNeeded: 1 },
          { rawIngredientId: eucalyptus.id, quantityNeeded: 3 },
        ],
      },
    },
  });

  await prisma.arrangement.create({
    data: {
      name: "Jarrón de Cristal Elegancia Real",
      category: "Arreglos Mixtos",
      price: 320.0,
      featured: false,
      image: "https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=800&q=80",
      description: "Composición de rosas amarillas, lirios y eucalipto fino en jarrón de cristal tallado.",
      recipeItems: {
        create: [
          { rawIngredientId: yellowRoses.id, quantityNeeded: 12 },
          { rawIngredientId: lilies.id, quantityNeeded: 3 },
          { rawIngredientId: glassVase.id, quantityNeeded: 1 },
          { rawIngredientId: eucalyptus.id, quantityNeeded: 5 },
        ],
      },
    },
  });

  await prisma.arrangement.create({
    data: {
      name: "Sombrerera Tulipanes Amarillos Solsticio",
      category: "Girasoles",
      price: 290.0,
      featured: true,
      image: "https://images.unsplash.com/photo-1520763185298-1b434c919102?auto=format&fit=crop&w=800&q=80",
      description: "Elegante caja sombrerera cargada de tulipanes amarillos importados con follaje de helechos.",
      recipeItems: {
        create: [
          { rawIngredientId: tulips.id, quantityNeeded: 15 },
          { rawIngredientId: luxuryBox.id, quantityNeeded: 1 },
          { rawIngredientId: ferns.id, quantityNeeded: 4 },
        ],
      },
    },
  });

  await prisma.arrangement.create({
    data: {
      name: "Caja Corazón Rosas Rojas & Peluche Romance",
      category: "Rosas",
      price: 350.0,
      featured: true,
      image: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80",
      description: "Edición exclusiva de rosas rojas ecuatorianas en caja de terciopelo con oso de peluche gigante.",
      recipeItems: {
        create: [
          { rawIngredientId: roses.id, quantityNeeded: 18 },
          { rawIngredientId: heartBox.id, quantityNeeded: 1 },
          { rawIngredientId: teddyBear.id, quantityNeeded: 1 },
        ],
      },
    },
  });

  // ==========================================
  // 3. Carissma Dress Rental Catalog Data
  // ==========================================
  await prisma.dress.create({
    data: {
      name: "Vestido Gala Noche Rosa Gold Sequin",
      brand: "Carolina Herrera",
      size: "M",
      acquisitionCost: 2400.0,
      timesUsed: 3,
      condition: "Excelente",
      requiredGuarantee: 500.0,
      status: "Disponible",
      color: "Rosa Gold",
    },
  });

  await prisma.dress.create({
    data: {
      name: "Vestido Corte Sirena Borgoña Terciopelo",
      brand: "Pronovias",
      size: "S",
      acquisitionCost: 3100.0,
      timesUsed: 8,
      condition: "Bueno",
      requiredGuarantee: 600.0,
      status: "En Uso",
      color: "Borgoña",
    },
  });

  await prisma.dress.create({
    data: {
      name: "Vestido Cóctel Satén Emerald Green",
      brand: "ZARA Atelier",
      size: "L",
      acquisitionCost: 1800.0,
      timesUsed: 12,
      condition: "Requiere Mantenimiento",
      requiredGuarantee: 400.0,
      status: "En Lavandería",
      color: "Verde Esmeralda",
    },
  });

  await prisma.dress.create({
    data: {
      name: "Vestido Largo Champagne Tul & Cristales",
      brand: "Marchesa",
      size: "S",
      acquisitionCost: 4200.0,
      timesUsed: 1,
      condition: "Excelente",
      requiredGuarantee: 800.0,
      status: "Reservado",
      color: "Champagne",
    },
  });

  // ==========================================
  // 4. Omnichannel Real Meta Business Contacts
  // ==========================================
  const verifiedMetaContacts = [
    {
      clientName: "jhon",
      phone: "+591 68079141",
      channel: "WhatsApp",
      environment: "farfalina",
      status: "Por Responder",
      lastMessage: "hooola",
      assignedAgent: "Agente General",
      profilePicUrl: "https://lookaside.fbsbx.com/wec/attachment/?f=%01EW%B9%B0%7E%AA%CB%9E5%F7%AC%7E%F2O%92%02%C1%93%1Fv%A2%ABM%BA%B8%3B%EC%21%99%9D%17EOHjy%88EP%D5%5E%BB%CD%EC%9B%A0%C5bJ%C8%AB%8AF%10%7CH%81&u=%01E%D7%9C%24%A2%FB%86z%9D%CF_%98%FE%EE%DD%CE%5E%ADz%A0%D0%8B-%83%5D%E75K%3D%AC1s%CB%F4%9Df%22%C2%C6%CB%B6%AF%E3%A8%60u%97%D1%02%A9j%90%C1%9A%D37&m=%01E%B8%AF%DDD%5Df8%91%CC%1A%DE%3B%D6%B4%F6%3F%E8%0A%B3%28%9B%8Bd%B0%A2%FC%2B%17%5D%2FQ%B4%C0u%C0%16k%1A%87%92%05%D6K%23%0Fi%84y%A5%C6%040i%B7N%FD",
      messages: [
        { sender: "customer", text: "hooola" },
      ],
    },
    {
      clientName: "Danito",
      phone: "340282366841710301244259456430560347250",
      channel: "Instagram",
      environment: "farfalina",
      status: "Por Responder",
      lastMessage: "oye viejo no te metas con venezuela",
      assignedAgent: "Agente General",
      profilePicUrl: "https://instagram.flpb1-1.fna.fbcdn.net/v/t51.2885-19/490225652_686215860479358_7648516339975665594_n.jpg?stp=dst-jpg_s150x150_tt6&_nc_cat=101&_nc_map=urlgen_bucketless&ccb=7-5&_nc_sid=f7ccc5&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLnd3dy4xMDgwLkMzIn0%3D&_nc_ohc=1nJl0jAqWeIQ7kNvwHwEAx2&_nc_oc=AdoG335yhWFv1l_P9UOK8_VxTlhZI2caqsZ2s3aGre9HWfjSIDtRNISGBXTkjRJRpN3aK3S5z_0YvBaeMeXO88QK&_nc_ad=z-m&_nc_cid=0&_nc_zt=24&_nc_ht=instagram.flpb1-1.fna&_nc_ss=7a22e&oh=00_AQM-XbblTa17fJygR1YpCuLSPvNmGYbY9ivqEJa55YBKZw&oe=6AC4D23E",
      messages: [
        { sender: "customer", text: "KSHDKSJDKSHFNEHDKSJDJWKDJJEJFKWJFJDJFKDJF QUÉ MIERDA" },
        { sender: "customer", text: 'Importante el "no me voy a matar", ya me estaba asustando' },
        { sender: "agent", text: "jakaksjd si dano" },
        { sender: "customer", text: "oye viejo no te metas con venezuela" },
      ],
    },
    {
      clientName: "Chris Kass (@chriszs.k)",
      phone: "340282366841710301244258613691574613295",
      channel: "Instagram",
      environment: "farfalina",
      status: "Por Responder",
      lastMessage: "ya no me mandes nada caardo",
      assignedAgent: "Agente General",
      profilePicUrl: "https://instagram.flpb1-1.fna.fbcdn.net/v/t51.89012-19/573323465_1219825463302212_7278921664109726296_n.jpg?stp=dst-jpg_s150x150_tt6&_nc_cat=1&ccb=7-5&_nc_sid=f7ccc5&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLnd3dy5DMyJ9&_nc_ohc=KsOoGv21mmoQ7kNvwE52MQ3&_nc_oc=Adqcb4XgcrAQA7Omlcn-Bc_RF2ne5VPzCRcAaOKtkU8MDC_82gbWK0KV2oc6cnoC6JKFpxAGY0_ZpRcf9wlAx4Xt&_nc_ad=z-m&_nc_cid=0&_nc_zt=24&_nc_ht=instagram.flpb1-1.fna&_nc_gid=GJGuLQjrwC-_LELLIi4_vg&_nc_ss=7a22e&oh=00_AQMwYNqg4gQvksTCo_iutOcOjVFdkf7s6_qZ0g-1rDv87w&oe=6AC4F1A2",
      messages: [
        { sender: "customer", text: "ya no me mandes nada caardo" },
      ],
    },
    {
      clientName: "Jhoseph Gutierrez",
      phone: "340282366841710301244258502320459382123",
      channel: "Instagram",
      environment: "farfalina",
      status: "Por Responder",
      lastMessage: "¡Listo Jhon Bellido! He agendado tu cita para el lunes 29 de junio a las 10:00 AM.",
      assignedAgent: "Agente General",
      profilePicUrl: "https://instagram.flpb1-2.fna.fbcdn.net/v/t51.82787-19/829072573_18211484194364495_1085441013936944628_n.jpg?stp=dst-jpg_s150x150_tt6&_nc_cat=100&_nc_map=urlgen_bucketless&ccb=7-5&_nc_sid=f7ccc5&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLnd3dy4xMDgwLkMzIn0%3D&_nc_ohc=VTX7nog_2zEQ7kNvwFGw7F4&_nc_oc=AdoHeycGkIfsbtVgpjSgacp65Us7XvDTI0pXKEH2CjlLIf3ymFm5EqvrtUVuhmBut1fxuf7rFX7S5f6wbOvjuCAX&_nc_ad=z-m&_nc_cid=0&_nc_zt=24&_nc_ht=instagram.flpb1-2.fna&_nc_gid=GJGuLQjrwC-_LELLIi4_vg&_nc_ss=7a22e&oh=00_AQPwmT2uo_pQRGdY5drNBMj-c1_gEd7HbqodA20yj3dHIg&oe=6AC4D7E9",
      messages: [
        { sender: "customer", text: "¡Listo Jhon Bellido! He agendado tu cita para el lunes 29 de junio a las 10:00 AM." },
      ],
    },
    {
      clientName: "Monserrat Claure",
      phone: "340282366841710301244259725171716805485",
      channel: "Instagram",
      environment: "farfalina",
      status: "Por Responder",
      lastMessage: "Tú: 🤪 (volviendo al porro te lo acabaste?)",
      assignedAgent: "Agente General",
      profilePicUrl: "https://instagram.flpb1-2.fna.fbcdn.net/v/t51.82787-19/825710422_18427964332196326_3373578088202084918_n.jpg?stp=dst-jpg_s150x150_tt6&_nc_cat=109&_nc_map=urlgen_bucketless&ccb=7-5&_nc_sid=f7ccc5&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLnd3dy4xMDgwLkMzIn0%3D&_nc_ohc=PDhTBUeJLiQQ7kNvwEwVcPZ&_nc_oc=AdqgEE_RdJdDp45NEaGwDqD3nGaikLRUUI0KogzKAo7AxH6jZop3Yxc0TCVDq2c_Lq9lan-hENE__NnDGhsxpaM4&_nc_ad=z-m&_nc_cid=0&_nc_zt=24&_nc_ht=instagram.flpb1-2.fna&_nc_gid=GJGuLQjrwC-_LELLIi4_vg&_nc_ss=7a22e&oh=00_AQOkcfbn23pvfr5joKqdgxhkySikiTX5ukyVYdc-RXxKXw&oe=6AC4CADD",
      messages: [
        { sender: "customer", text: "Tú: 🤪 (volviendo al porro te lo acabaste?)" },
      ],
    },
    {
      clientName: "⋆˚࿔ 𝓐𝓵𝓲𝜗𝜚˚⋆",
      phone: "340282366841710301244286777833813105241",
      channel: "Instagram",
      environment: "farfalina",
      status: "Por Responder",
      lastMessage: "JJAJAJAJAJAJA re salados",
      assignedAgent: "Agente General",
      profilePicUrl: "https://instagram.flpb1-2.fna.fbcdn.net/v/t51.82787-19/786755511_17997585276005953_8541111597902381927_n.jpg?stp=dst-jpg_s150x150_tt6&_nc_cat=110&_nc_map=urlgen_bucketless&ccb=7-5&_nc_sid=f7ccc5&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLnd3dy45MTUuQzMifQ%3D%3D&_nc_ohc=J4qcz1IZZNcQ7kNvwG7AjNd&_nc_oc=AdpHrzBiIr7ly2_uWXZA9bbhQ2lML7Dmq7dJiKcraJGqJYEOYYfyxjL32CZiRMKKHpnoALJ5NrfLXqLw0Qjmnq-j&_nc_ad=z-m&_nc_cid=0&_nc_zt=24&_nc_ht=instagram.flpb1-2.fna&_nc_gid=GJGuLQjrwC-_LELLIi4_vg&_nc_ss=7a22e&oh=00_AQPd8M35JJyz83082Q4Hc1j3KbDvW0s-oCY8A_1Nnizxug&oe=6AC4EA4A",
      messages: [
        { sender: "customer", text: "JJAJAJAJAJAJA re salados" },
        { sender: "customer", text: "Y pues solo puedo hoy luego mi mami no me deja salir" },
        { sender: "agent", text: "boeee y porque no finde, era que vayamos pues" },
        { sender: "customer", text: "Holiiii. Eraaa la verdad muy tranquis la fiesta" },
        { sender: "customer", text: "Ahorita ando camino al concierto de jess y joy. Los conoces?" },
        { sender: "agent", text: "jakaksjd si pues se separaron" },
        { sender: "customer", text: "Nonooo. Hoy es su último concierto juntos a" },
        { sender: "agent", text: "noooo q paja che y justo fue en bolivia xdd" },
        { sender: "customer", text: "JJAJAJAJAJAJA re salados" },
      ],
    },
  ];

  for (const contact of verifiedMetaContacts) {
    await prisma.chatThread.create({
      data: {
        clientName: contact.clientName,
        phone: contact.phone,
        channel: contact.channel,
        environment: contact.environment,
        status: contact.status,
        lastMessage: contact.lastMessage,
        assignedAgent: contact.assignedAgent,
        profilePicUrl: contact.profilePicUrl,
        messages: {
          create: contact.messages.map((m) => ({
            sender: m.sender,
            text: m.text,
            environment: contact.environment,
          })),
        },
      },
    });
  }

  console.log("Database seeded successfully with rich production demo data!");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
