import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Mail, Lock, Database, UserCheck, Trash2, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Política de Privacidad | Florería Farfalina & Carissma",
  description:
    "Política de privacidad y protección de datos personales para los canales de atención al cliente y mensajería de Florería Farfalina y Carissma.",
};

export default function PrivacyPolicyPage() {
  const lastUpdated = "6 de Octubre de 2026";

  return (
    <main className="min-h-screen bg-[#FAF7F2] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-[#EAE3D9] p-6 sm:p-10 md:p-14">
        {/* Header */}
        <div className="border-b border-[#EAE3D9] pb-8 mb-8">
          <Link
            href="/"
            className="inline-flex items-center text-sm font-medium text-[#C86D51] hover:text-[#A7543A] mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al inicio
          </Link>
          <div className="flex items-center space-x-3 mb-3">
            <span className="p-2.5 bg-[#FAF3EC] text-[#C86D51] rounded-xl border border-[#F3E3D3]">
              <ShieldCheck className="w-7 h-7" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#2B2625] tracking-tight">
              Política de Privacidad
            </h1>
          </div>
          <p className="text-sm text-[#7D7068]">
            Florería Farfalina & Carissma — Última actualización: {lastUpdated}
          </p>
        </div>

        {/* Introduction */}
        <div className="space-y-8 text-[#4A423D] leading-relaxed text-sm sm:text-base">
          <section>
            <h2 className="text-lg sm:text-xl font-semibold text-[#2B2625] mb-3 flex items-center">
              1. Introducción y Responsable del Tratamiento
            </h2>
            <p>
              En <strong>Florería Farfalina & Carissma</strong> (en adelante, &quot;la Empresa&quot; o &quot;nosotros&quot;), nos tomamos muy en serio la privacidad y la protección de los datos personales de nuestros clientes, visitantes y usuarios.
            </p>
            <p className="mt-2">
              Esta Política de Privacidad explica cómo recopilamos, utilizamos, almacenamos y protegemos la información cuando interactúas con nosotros a través de nuestro sitio web, catálogo en línea, o a través de nuestros canales integrados de mensajería (incluyendo <strong>Instagram Direct</strong>, <strong>Facebook Messenger</strong> y <strong>WhatsApp</strong>).
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-lg sm:text-xl font-semibold text-[#2B2625] mb-3 flex items-center">
              <Database className="w-5 h-5 mr-2 text-[#C86D51]" />
              2. Datos Personales que Recopilamos
            </h2>
            <p>
              A través de la integración oficial con la API de Meta (Instagram Graph API, Messenger API y WhatsApp Cloud API), recopilamos únicamente los datos necesarios para brindar soporte y atención al cliente:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>
                <strong>Identificador de Usuario (IGSID / PSID / Número):</strong> Identificador numérico público proporcionado por Meta para canalizar las respuestas a tu conversación.
              </li>
              <li>
                <strong>Nombre y Nombre de Usuario:</strong> Tu nombre público de perfil y nombre de usuario (@usuario) visible en Instagram o Facebook para identificar tu hilo de conversación.
              </li>
              <li>
                <strong>Contenido de los Mensajes:</strong> El texto, consultas sobre arreglos florales, vestidos, eventos, y los archivos adjuntos (imágenes o comprobantes) que decides enviarnos voluntariamente en el chat.
              </li>
              <li>
                <strong>Fecha y Hora de Interacción:</strong> Registro cronológico de tus consultas para coordinar entregas y pedidos oportunamente.
              </li>
            </ul>
            <p className="mt-3 text-sm text-[#7D7068] bg-[#FAF7F2] p-3 rounded-lg border border-[#EAE3D9]">
              <strong>Nota:</strong> Nunca solicitamos contraseñas de tus redes sociales ni accedemos a tus publicaciones privadas, lista de seguidores o mensajes fuera de los dirigidos directamente a nuestras cuentas oficiales.
            </p>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-lg sm:text-xl font-semibold text-[#2B2625] mb-3 flex items-center">
              <UserCheck className="w-5 h-5 mr-2 text-[#C86D51]" />
              3. Finalidad del Uso de los Datos
            </h2>
            <p>Los datos recopilados se utilizan exclusivamente para los siguientes fines legítimos:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>Responder a tus consultas sobre disponibilidad de arreglos florales, ramos de novia, alquiler de vestidos y presupuestos de eventos.</li>
              <li>Coordinar detalles de entrega, envíos a domicilio y reservas de fechas.</li>
              <li>Mantener el historial de la conversación para que nuestro equipo de asesores pueda brindarte atención personalizada y continua sin que tengas que repetir tu solicitud.</li>
              <li>Generar recibos, notas de venta o confirmaciones de pedido solicitadas por ti.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-lg sm:text-xl font-semibold text-[#2B2625] mb-3 flex items-center">
              <Lock className="w-5 h-5 mr-2 text-[#C86D51]" />
              4. Almacenamiento, Seguridad y Transferencia de Datos
            </h2>
            <p>
              Implementamos rigurosas medidas técnicas y administrativas de seguridad para proteger tu información personal contra accesos no autorizados, pérdida o alteración:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>
                <strong>Conexión Cifrada:</strong> Toda comunicación entre los servidores de Meta, nuestro túnel Cloudflare y nuestra plataforma se realiza mediante cifrado de grado bancario HTTPS/TLS.
              </li>
              <li>
                <strong>No Comercialización:</strong> <strong>Bajo ninguna circunstancia vendemos, alquilamos ni cedemos</strong> tus datos personales a empresas de publicidad ni a terceros no autorizados.
              </li>
              <li>
                <strong>Retención Limitada:</strong> Mantenemos los historiales de conversación únicamente durante el período necesario para atender tus pedidos y solicitudes de servicio.
              </li>
            </ul>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-lg sm:text-xl font-semibold text-[#2B2625] mb-3 flex items-center">
              <Trash2 className="w-5 h-5 mr-2 text-[#C86D51]" />
              5. Derechos del Usuario y Eliminación de Datos
            </h2>
            <p>
              De conformidad con las leyes de protección de datos y las políticas de la plataforma de Meta, tienes pleno derecho a acceder a tu información, solicitar su corrección o pedir la eliminación total y definitiva de tus datos y mensajes registrados en nuestro sistema.
            </p>
            <p className="mt-3">
              Para conocer el procedimiento detallado o solicitar el borrado de tu información, puedes visitar nuestra página dedicada de{" "}
              <Link
                href="/data-deletion"
                className="font-medium text-[#C86D51] hover:underline"
              >
                Instrucciones de Eliminación de Datos de Usuario
              </Link>
              , o comunicarte con nosotros directamente.
            </p>
          </section>

          {/* Section 6 */}
          <section className="bg-[#FAF3EC] border border-[#F3E3D3] p-5 sm:p-6 rounded-xl">
            <h2 className="text-lg sm:text-xl font-semibold text-[#2B2625] mb-2 flex items-center">
              <Mail className="w-5 h-5 mr-2 text-[#C86D51]" />
              6. Contacto y Consultas de Privacidad
            </h2>
            <p className="text-sm sm:text-base">
              Si tienes preguntas, inquietudes o deseas ejercer tus derechos sobre tus datos personales, por favor contáctanos a través de:
            </p>
            <div className="mt-3 space-y-1 text-sm sm:text-base">
              <p>
                <strong>Empresa:</strong> Florería Farfalina & Alquiler de Vestidos Carissma
              </p>
              <p>
                <strong>Correo electrónico:</strong>{" "}
                <a
                  href="mailto:contacto@farfalina.tech"
                  className="text-[#C86D51] font-medium hover:underline"
                >
                  contacto@farfalina.tech
                </a>
              </p>
              <p>
                <strong>Instagram oficial:</strong>{" "}
                <span className="font-mono text-sm bg-white px-2 py-0.5 rounded border border-[#EAE3D9]">
                  @sour_jhxn
                </span>
              </p>
              <p>
                <strong>Dominio del servicio:</strong>{" "}
                <a
                  href="https://omnichannel.farfalina.tech"
                  className="text-[#C86D51] font-medium hover:underline"
                >
                  https://omnichannel.farfalina.tech
                </a>
              </p>
            </div>
          </section>
        </div>

        {/* Footer links */}
        <div className="mt-12 pt-6 border-t border-[#EAE3D9] flex flex-wrap items-center justify-between text-xs text-[#7D7068] gap-4">
          <p>© {new Date().getFullYear()} Florería Farfalina & Carissma. Todos los derechos reservados.</p>
          <div className="flex space-x-4">
            <Link href="/privacy" className="hover:text-[#2B2625] underline">
              Política de Privacidad
            </Link>
            <Link href="/data-deletion" className="hover:text-[#2B2625] underline">
              Eliminación de Datos
            </Link>
            <Link href="/terms" className="hover:text-[#2B2625] underline">
              Condiciones del Servicio
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
