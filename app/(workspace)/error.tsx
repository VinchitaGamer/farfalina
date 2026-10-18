"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[60dvh] flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-red-100 max-w-md w-full text-center">
        <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="h-8 w-8 text-red-500" />
        </div>
        <h2 className="text-2xl font-semibold text-warm-900 mb-2">Something went wrong</h2>
        <p className="text-warm-600 mb-8">
          {error.message || "An unexpected error occurred while loading this page."}
        </p>
        
        <div className="flex flex-col gap-3">
          <button
            onClick={() => reset()}
            className="w-full bg-brand-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-brand-700 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/floreria/catalog"
            className="w-full bg-warm-100 text-warm-800 px-4 py-2.5 rounded-lg font-medium hover:bg-warm-200 transition-colors"
          >
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
