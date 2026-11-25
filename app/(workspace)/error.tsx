"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const isCarissma = pathname?.startsWith("/carissma");
  const homeHref = isCarissma ? "/carissma/catalog" : "/floreria/catalog";

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[60dvh] flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-rose-100 max-w-md w-full text-center">
        <div className="mx-auto w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="h-8 w-8 text-rose-500" />
        </div>
        <h2 className="text-2xl font-bold text-warm-900 mb-2">Ocurrió un inconveniente</h2>
        <p className="text-sm text-warm-600 mb-8 leading-relaxed">
          {error.message || "Se produjo un error inesperado al cargar esta vista. Tus datos están a salvo."}
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => reset()}
            className="w-full bg-terracotta-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-terracotta-700 transition-colors shadow-sm"
          >
            Reintentar carga
          </button>
          <Link
            href={homeHref}
            className="w-full bg-warm-100 text-warm-800 px-4 py-2.5 rounded-xl font-semibold hover:bg-warm-200 transition-colors"
          >
            Volver al Catálogo
          </Link>
        </div>
      </div>
    </div>
  );
}
