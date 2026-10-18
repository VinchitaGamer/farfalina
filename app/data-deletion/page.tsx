import type { Metadata } from "next";
import Link from "next/link";
import { Trash2, Mail, ArrowLeft, CheckCircle2, ShieldAlert } from "lucide-react";

export const metadata: Metadata = {
  title: "Instrucciones de Eliminación de Datos | Florería Farfalina & Carissma",
  description:
    "Instrucciones detalladas para que los usuarios de Instagram y Facebook puedan solicitar la eliminación total de sus datos almacenados en Florería Farfalina y Carissma.",
};

export default function DataDeletionPage() {
  const lastUpdated = "6 de Octubre de 2026";

  return (
    <main className="min-h-screen bg-[#FAF7F2] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-[#EAE3D9] p-6 sm:p-10 md:p-14">
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
            <span className="p-2.5 bg-[#FDEEED] text-[#D94F4F] rounded-xl border border-[#F8D2D2]">
              <Trash2 className="w-7 h-7" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#2B2625] tracking-tight">
              Instrucciones de Eliminación de Datos de Usuario
            </h1>
          </div>
          <p className="text-sm text-[#7D7068]">
            Florería Farfalina & Carissma — Plataforma Omnicanal | Actualizado: {lastUpdated}
          </p>
        </div>

        {/* Content */}
        <div className="space-y-8 text-[#4A423D] leading-relaxed text-sm sm:text-base">
          <section>
            <p>
              De conformidad con las Políticas de la Plataforma de Meta y las regulaciones vigentes de privacidad, en <strong>Florería Farfalina & Carissma</strong> respetamos plenamente el control que nuestros usuarios tienen sobre sus datos personales. Si has interactuado con nuestras cuentas a través de <strong>Instagram Direct</strong> o <strong>Facebook Messenger</strong>, puedes solicitar la eliminación completa de toda información asociada a tu perfil en cualquier momento.
            </p>
          </section>

          {/* Option 1: Direct Request via Email / WhatsApp */}
          <section className="border border-[#EAE3D9] rounded-xl p-5 sm:p-6 bg-[#FAF7F2]">
            <h2 className="text-lg font-semibold text-[#2B2625] mb-3 flex items-center">
              <CheckCircle2 className="w-5 h-5 mr-2 text-[#2E7D32]" />
              Método 1: Solicitud Directa a Nuestro Equipo de Soporte (Recomendado)
            </h2>
            <p className="mb-3">
              Puedes solicitar la eliminación inmediata de tu historial de chat y datos de cliente enviando un correo o mensaje con los siguientes datos:
            </p>
            <ol className="list-decimal pl-6 space-y-2 mb-4 text-sm sm:text-base">
              <li>
                Envía un correo electrónico a:{" "}
                <a
                  href="mailto:contacto@farfalina.tech?subject=Solicitud%20de%20Eliminaci%C3%B3n%20de%20Datos"
                  className="font-semibold text-[#C86D51] hover:underline"
                >
                  contacto@farfalina.tech
                </a>
              </li>
              <li>
                Indica en el asunto: <strong>&quot;Solicitud de Eliminación de Datos de Usuario&quot;</strong>.
              </li>
              <li>
                En el cuerpo del mensaje, proporciona tu nombre de usuario de Instagram (por ejemplo, <code className="bg-white px-2 py-0.5 rounded border border-[#EAE3D9]">@tu_usuario</code>) o el identificador utilizado en tu conversación.
              </li>
            </ol>
            <div className="bg-white p-3 rounded-lg border border-[#EAE3D9] text-sm text-[#5C524B]">
              <strong>Plazo de Respuesta:</strong> Nuestro equipo procesará la eliminación en nuestra base de datos local y servidores en un plazo máximo de <strong>48 horas hábiles</strong>, confirmándote por correo una vez finalizado el borrado total.
            </div>
          </section>

          {/* Option 2: Revoke Access via Instagram / Meta Settings */}
          <section className="border border-[#EAE3D9] rounded-xl p-5 sm:p-6 bg-white">
            <h2 className="text-lg font-semibold text-[#2B2625] mb-3 flex items-center">
              <ShieldAlert className="w-5 h-5 mr-2 text-[#C86D51]" />
              Método 2: Revocar Permisos desde tu Cuenta de Instagram / Facebook
            </h2>
            <p className="mb-3">
              Si deseas desconectar tus interacciones y revocar los permisos concedidos a nuestra aplicación directamente desde Meta:
            </p>
            <ol className="list-decimal pl-6 space-y-2 text-sm sm:text-base">
              <li>Abre la aplicación de Instagram o ingresa a tu cuenta desde el navegador web.</li>
              <li>Ve a tu <strong>Perfil</strong> ➔ <strong>Configuración y actividad</strong>.</li>
              <li>Busca la sección <strong>&quot;Permisos de sitios web&quot;</strong> o <strong>&quot;Apps y sitios web&quot;</strong>.</li>
              <li>Selecciona la aplicación asociada a <strong>Florería Farfalina & Carissma</strong>.</li>
              <li>Haz clic en <strong>&quot;Eliminar&quot;</strong> o <strong>&quot;Revocar acceso&quot;</strong>.</li>
            </ol>
          </section>

          {/* What gets deleted */}
          <section>
            <h2 className="text-lg font-semibold text-[#2B2625] mb-3">
              ¿Qué datos se eliminan tras tu solicitud?
            </h2>
            <ul className="list-disc pl-6 space-y-1 text-sm sm:text-base">
              <li>Historial de mensajes de chat enviados y recibidos.</li>
              <li>Registro de tu usuario en nuestro CRM interno (nombre de perfil, IGSID y notas asociadas).</li>
              <li>Imágenes o archivos adjuntos temporales recibidos en el chat.</li>
            </ul>
          </section>

          {/* Contact Box */}
          <section className="bg-[#FAF3EC] border border-[#F3E3D3] p-5 rounded-xl">
            <h3 className="font-semibold text-[#2B2625] mb-1 flex items-center">
              <Mail className="w-4 h-4 mr-2 text-[#C86D51]" />
              ¿Tienes dudas adicionales?
            </h3>
            <p className="text-sm">
              Escríbenos a{" "}
              <a
                href="mailto:contacto@farfalina.tech"
                className="text-[#C86D51] font-medium hover:underline"
              >
                contacto@farfalina.tech
              </a>{" "}
              o consulta nuestra{" "}
              <Link href="/privacy" className="text-[#C86D51] font-medium hover:underline">
                Política de Privacidad completa
              </Link>
              .
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-[#EAE3D9] flex flex-wrap items-center justify-between text-xs text-[#7D7068] gap-4">
          <p>© {new Date().getFullYear()} Florería Farfalina & Carissma.</p>
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
