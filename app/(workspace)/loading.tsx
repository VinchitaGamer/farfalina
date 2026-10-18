import React from "react";

export default function Loading() {
  return (
    <div className="w-full h-full p-4 animate-pulse">
      <div className="h-8 bg-warm-200 rounded w-1/4 mb-6"></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white p-6 rounded-lg shadow-sm border border-warm-100">
            <div className="h-6 bg-warm-200 rounded w-3/4 mb-4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-warm-100 rounded w-full"></div>
              <div className="h-4 bg-warm-100 rounded w-5/6"></div>
              <div className="h-4 bg-warm-100 rounded w-4/6"></div>
            </div>
            <div className="mt-6 h-10 bg-warm-200 rounded w-full"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
