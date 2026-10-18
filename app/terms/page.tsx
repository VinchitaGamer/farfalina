import type { Metadata } from "next";
import Link from "next/link";
import { FileText, ArrowLeft, Mail, Scale } from "lucide-react";

export const metadata: Metadata = {
  title: "Condiciones del Servicio | Florería Farfalina & Carissma",
  description:
    "Términos y condiciones del servicio para los canales digitales y de atención al cliente de Florería Farfalina y Carissma.",
};

export default function TermsPage() {
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
            <span className="p-2.5 bg-[#FAF3EC] text-[#C86D51] rounded-xl border border-[#F3E3D3]">
              <FileText className="w-7 h-7" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#2B2625] tracking-tight">
              Condiciones del Servicio
            </h1>
          </div>
          <p className="text-sm text-[#7D7068]">
            Florería Farfalina & Carissma — Última actualización: {lastUpdated}
          </p>
        </div>

        {/* Content */}
        <div className="space-y-8 text-[#4A423D] leading-relaxed text-sm sm:text-base">
          <section>
            <h2 className="text-lg font-semibold text-[#2B2625] mb-2 flex items-center">
              1. Aceptación de los Términos
            </h2>
            <p>
              Al interactuar con nuestros canales de atención (sitio web, WhatsApp, Instagram Direct y Facebook Messenger), aceptas cumplir con los presentes Términos y Condiciones de Servicio de <strong>Florería Farfalina & Carissma</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2B2625] mb-2 flex items-center">
              2. Servicios Ofrecidos
            </h2>
            <p>
              Nuestra plataforma proporciona cotizaciones, catálogo de productos, venta de arreglos florales, alquiler de vestidos para eventos sociales y atención de consultas comerciales a través de asistentes y asesores autorizados.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2B2625] mb-2 flex items-center">
              <Scale className="w-5 h-5 mr-2 text-[#C86D51]" />
              3. Uso Adecuado de los Canales de Mensajería
            </h2>
            <p>
              El usuario se compromete a hacer un uso respetuoso y conforme a la ley de nuestros canales. No está permitido el envío de spam, contenido ofensivo o uso automatizado malicioso de nuestros chats. Nos reservamos el derecho de bloquear comunicaciones abusivas.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2B2625] mb-2">
              4. Pedidos, Cotizaciones y Precios
            </h2>
            <p>
              Los precios informados en las conversaciones y catálogos corresponden a cotizaciones vigentes al momento de la consulta. La confirmación formal de un pedido de flores o reserva de alquiler queda sujeta a la disponibilidad del producto y al abono del anticipo acordado.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#2B2625] mb-2">
              5. Propiedad Intelectual
            </h2>
            <p>
              Todos los diseños florales, catálogos fotográficos, marcas comerciales y contenidos expuestos en nuestras plataformas son propiedad exclusiva de Florería Farfalina & Carissma.
            </p>
          </section>

          <section className="bg-[#FAF3EC] border border-[#F3E3D3] p-5 rounded-xl">
            <h2 className="text-lg font-semibold text-[#2B2625] mb-2 flex items-center">
              <Mail className="w-5 h-5 mr-2 text-[#C86D51]" />
              6. Contacto
            </h2>
            <p className="text-sm">
              Para cualquier consulta sobre estos términos, escríbenos a{" "}
              <a href="mailto:contacto@farfalina.tech" className="text-[#C86D51] font-medium hover:underline">
                contacto@farfalina.tech
              </a>
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
