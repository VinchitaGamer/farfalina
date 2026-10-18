"use client";

import React, { useState, useEffect } from "react";
import { X, Sparkles, Plus, Trash2, Image, Package, Check, Tag } from "lucide-react";
import { createArrangementAction, getRawIngredientsAction } from "@/app/actions/arrangements";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

interface RawIngredientItem {
  id: string;
  name: string;
  type: string;
  available: number;
  unit: string;
  costPerUnit: number;
}

interface NewArrangementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const STOCK_IMAGES = [
  { label: "Rosas Rojas Deluxe", url: "https://images.unsplash.com/photo-1561181286-d3fee7d55364?auto=format&fit=crop&w=800&q=80" },
  { label: "Girasoles y Lirios", url: "https://images.unsplash.com/photo-1597848212624-a19eb35e2651?auto=format&fit=crop&w=800&q=80" },
  { label: "Jarrón Cristal Mixto", url: "https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=800&q=80" },
  { label: "Tulipanes Primavera", url: "https://images.unsplash.com/photo-1520763185298-1b434c919102?auto=format&fit=crop&w=800&q=80" },
];

export default function NewArrangementModal({ isOpen, onClose, onSuccess }: NewArrangementModalProps) {
  const [ingredients, setIngredients] = useState<RawIngredientItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dynamic Arrangement Categories
  const DEFAULT_ARR_CATEGORIES = ["Rosas", "Girasoles", "Arreglos Mixtos", "Insumos & Jarrones"];
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  // Form Fields
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("Rosas");
  const [price, setPrice] = useState<number | string>(250);
  const [featured, setFeatured] = useState(false);
  const [image, setImage] = useState(STOCK_IMAGES[0].url);
  const [description, setDescription] = useState("");


  // Recipe items selected & Bento Grid controls
  const [recipe, setRecipe] = useState<{ rawIngredientId: string; quantityNeeded: number }[]>([]);
  const [recipeCategory, setRecipeCategory] = useState<string>("Todos");
  const [recipeSearch, setRecipeSearch] = useState<string>("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("floreria_arrangement_categories");
      if (saved) {
        setCustomCategories(JSON.parse(saved));
      }
    } catch {}
  }, []);

  const allCategories = Array.from(
    new Set([...DEFAULT_ARR_CATEGORIES, ...customCategories])
  );

  const handleAddCategory = () => {
    const trimmed = newCatName.trim();
    if (!trimmed) {
      toast.error("Ingresa el nombre de la categoría");
      return;
    }
    if (!allCategories.includes(trimmed)) {
      const updated = [...customCategories, trimmed];
      setCustomCategories(updated);
      try {
        localStorage.setItem("floreria_arrangement_categories", JSON.stringify(updated));
      } catch {}
    }
    setCategory(trimmed);
    setNewCatName("");
    setIsAddingCategory(false);
    toast.success(`Categoría "${trimmed}" agregada.`);
  };

  const handleDeleteCategory = (catToDelete: string) => {
    const updated = customCategories.filter((c) => c !== catToDelete);
    setCustomCategories(updated);
    try {
      localStorage.setItem("floreria_arrangement_categories", JSON.stringify(updated));
    } catch {}
    if (category === catToDelete) {
      setCategory("Rosas");
    }
    toast.success(`Categoría "${catToDelete}" eliminada.`);
  };

  useEffect(() => {
    if (isOpen) {
      loadIngredients();
    }
  }, [isOpen]);

  const loadIngredients = async () => {
    const res = await getRawIngredientsAction();
    if (res.success && Array.isArray(res.data)) {
      setIngredients(res.data as RawIngredientItem[]);
    }
  };

  if (!isOpen) return null;

  const addIngredientToRecipe = (ingredientId: string) => {
    setRecipe((prev) => {
      const existing = prev.find((r) => r.rawIngredientId === ingredientId);
      if (existing) {
        return prev.map((r) =>
          r.rawIngredientId === ingredientId ? { ...r, quantityNeeded: r.quantityNeeded + 1 } : r
        );
      }
      return [...prev, { rawIngredientId: ingredientId, quantityNeeded: 1 }];
    });
  };

  const updateRecipeQty = (ingredientId: string, qty: number) => {
    if (qty <= 0) {
      setRecipe((prev) => prev.filter((r) => r.rawIngredientId !== ingredientId));
      return;
    }
    setRecipe((prev) =>
      prev.map((r) => (r.rawIngredientId === ingredientId ? { ...r, quantityNeeded: qty } : r))
    );
  };

  // Filtered ingredients for Bento Grid
  const filteredIngredients = ingredients.filter((i) => {
    const matchesCategory = recipeCategory === "Todos" || i.type === recipeCategory;
    const matchesSearch = recipeSearch.trim() === "" || i.name.toLowerCase().includes(recipeSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Calculate total cost of selected ingredients
  const totalCost = recipe.reduce((acc, curr) => {
    const ing = ingredients.find((i) => i.id === curr.rawIngredientId);
    return acc + (ing ? ing.costPerUnit * curr.quantityNeeded : 0);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim()) {
      setError("Por favor completa los campos requeridos.");
      return;
    }

    setLoading(true);
    setError(null);

    const res = await createArrangementAction({
      name,
      category,
      price: Number(price),
      featured,
      image,
      description,
      recipeItems: recipe,
    });

    setLoading(false);

    if (res.success) {
      onSuccess();
      onClose();
    } else {
      setError(res.error || "Ocurrió un error al guardar el arreglo.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-warm-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 animate-in fade-in zoom-in duration-200 max-h-[85dvh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-warm-200">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-terracotta-100 text-terracotta-700 rounded-xl">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-warm-900">Crear Nuevo Arreglo Combinado</h3>
              <p className="text-xs text-warm-500">Combina flores base, follaje y recipientes con descuento de insumos.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-warm-400 hover:text-warm-700 rounded-xl hover:bg-warm-100 transition-colors touch-manipulation"
            aria-label="Cerrar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-warm-800">Nombre del Arreglo *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Ramos Rosas y Girasoles Amor..."
                className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base sm:text-xs md:text-sm text-warm-900 focus:outline-none focus:border-terracotta-500 font-medium"
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-warm-800 flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5 text-terracotta-600" />
                  <span>Categoría del Arreglo *</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddingCategory(!isAddingCategory)}
                  className="min-h-[32px] px-2 text-[11px] font-bold text-terracotta-600 hover:text-terracotta-800 flex items-center gap-0.5"
                >
                  <Plus className="h-3 w-3" />
                  <span>{isAddingCategory ? "Cerrar" : "Nueva Categoría"}</span>
                </button>
              </div>

              {isAddingCategory && (
                <div className="p-2.5 bg-terracotta-50/70 border border-terracotta-200 rounded-xl space-y-2 animate-in fade-in">
                  <span className="text-[10px] font-bold text-terracotta-800 block">Crear Categoría Personalizada</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddCategory();
                        }
                      }}
                      placeholder="Ej. Orquídeas, Cajas de Flores, Condolencias..."
                      className="flex-1 p-2 text-base sm:text-xs bg-white border border-terracotta-300 rounded-lg text-warm-900 focus:outline-none focus:border-terracotta-500 font-medium"
                    />
                    <button
                      type="button"
                      onClick={handleAddCategory}
                      className="min-h-[36px] px-3 py-1.5 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-lg text-xs font-bold transition-all whitespace-nowrap"
                    >
                      Guardar
                    </button>
                  </div>
                </div>
              )}

              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full min-h-[44px] sm:min-h-[38px] p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base sm:text-xs md:text-sm text-warm-900 focus:outline-none focus:border-terracotta-500 font-medium"
              >
                {allCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {customCategories.length > 0 && (
                <div className="pt-0.5 flex flex-wrap items-center gap-1">
                  <span className="text-[10px] text-warm-400 font-medium mr-1">Personalizadas:</span>
                  {customCategories.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-warm-100 text-warm-800 rounded-lg text-[10px] font-bold border border-warm-200"
                    >
                      <span>{c}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(c)}
                        className="hover:text-rose-600 text-warm-400 p-0.5 rounded"
                        title={`Eliminar categoría ${c}`}
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-warm-800">Precio Venta (Bs) *</label>
              <input
                type="text"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
                className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base sm:text-xs md:text-sm text-warm-900 focus:outline-none focus:border-terracotta-500 font-medium font-mono"
                required
              />
            </div>


            <div className="space-y-1 flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer p-2.5 min-h-[44px] bg-warm-50 border border-warm-200 rounded-xl">
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  className="rounded border-warm-300 text-terracotta-600 focus:ring-terracotta-500 h-5 w-5"
                />
                <span className="text-xs font-bold text-warm-800">Destacar en Catálogo Público</span>
              </label>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-warm-800">Descripción *</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalles del diseño floral, colores y presentación..."
              className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base sm:text-xs md:text-sm text-warm-900 focus:outline-none focus:border-terracotta-500 font-medium"
              required
            />
          </div>

          {/* Preset Images Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-warm-800 flex items-center gap-1">
              <Image className="h-3.5 w-3.5 text-terracotta-600" /> Imagen del Arreglo (Selecciona o escribe URL)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STOCK_IMAGES.map((img, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => setImage(img.url)}
                  className={`p-2 min-h-[38px] rounded-xl border text-[11px] font-semibold text-center transition-all touch-manipulation active:scale-95 ${
                    image === img.url ? "border-terracotta-500 bg-terracotta-50 text-terracotta-700 shadow-sm font-bold" : "border-warm-200 hover:bg-warm-50 text-warm-600"
                  }`}
                >
                  {img.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              className="w-full p-2.5 text-base sm:text-xs font-mono bg-warm-50 border border-warm-200 rounded-xl text-warm-700 focus:outline-none focus:border-terracotta-500"
            />
          </div>

          {/* Bento Grid Recipe Builder for All Insumos */}
          <div className="p-4 bg-warm-50/90 border border-warm-200 rounded-2xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-warm-200 pb-2">
              <div className="flex items-center gap-1.5 text-warm-900 font-bold text-xs">
                <Package className="h-4 w-4 text-terracotta-600" />
                <span>Bento Grid: Receta de Insumos Disponibles en Inventario</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-warm-500">Costo Materiales:</span>
                <span className="font-mono font-bold text-terracotta-700 bg-terracotta-50 px-2 py-0.5 rounded border border-terracotta-200">
                  {formatCurrency(totalCost)}
                </span>
              </div>
            </div>

            {/* Bento Filter & Search Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                {["Todos", ...Array.from(new Set(ingredients.map((i) => i.type).filter(Boolean)))].map((cat) => (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => {
                      setRecipeCategory(cat);
                    }}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors whitespace-nowrap ${
                      recipeCategory === cat
                        ? "bg-terracotta-500 text-white"
                        : "bg-white text-warm-700 hover:bg-warm-100 border border-warm-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={recipeSearch}
                onChange={(e) => setRecipeSearch(e.target.value)}
                placeholder="Buscar insumo..."
                className="p-2 text-base sm:text-xs bg-white border border-warm-200 rounded-lg text-warm-900 focus:outline-none focus:border-terracotta-500 w-full sm:w-44"
              />
            </div>

            {/* Bento Grid Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
              {filteredIngredients.map((ing) => {
                const recipeItem = recipe.find((r) => r.rawIngredientId === ing.id);
                const isSelected = !!recipeItem;
                const qty = recipeItem ? recipeItem.quantityNeeded : 0;

                return (
                  <div
                    key={ing.id}
                    className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between space-y-2 ${
                      isSelected
                        ? "bg-terracotta-50/70 border-terracotta-400 shadow-sm"
                        : "bg-white border-warm-200 hover:border-warm-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-warm-100 text-warm-700 rounded">
                          {ing.type}
                        </span>
                        <p className="text-xs font-bold text-warm-900 mt-1 line-clamp-1">{ing.name}</p>
                      </div>
                      {isSelected && (
                        <span className="p-0.5 bg-terracotta-500 text-white rounded-full">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-warm-500">
                      <span>Stock: <strong className="text-warm-800">{ing.available} {ing.unit}</strong></span>
                      <span className="font-mono text-warm-700">{formatCurrency(ing.costPerUnit)}/u</span>
                    </div>

                    <div className="pt-1.5 border-t border-warm-200/60 flex items-center justify-between">
                      {isSelected ? (
                        <div className="flex items-center justify-between w-full bg-white rounded-lg p-0.5 border border-terracotta-300">
                          <button
                            type="button"
                            onClick={() => updateRecipeQty(ing.id, qty - 1)}
                            className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center text-warm-600 hover:bg-warm-100 rounded active:scale-95 touch-manipulation"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                          </button>
                          <span className="font-bold text-xs text-terracotta-800 px-2">{qty}</span>
                          <button
                            type="button"
                            onClick={() => addIngredientToRecipe(ing.id)}
                            className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center text-warm-600 hover:bg-warm-100 rounded active:scale-95 touch-manipulation"
                          >
                            <Plus className="h-3.5 w-3.5 text-terracotta-600" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => addIngredientToRecipe(ing.id)}
                          className="w-full min-h-[38px] py-1 text-[11px] font-bold bg-warm-100 hover:bg-terracotta-500 hover:text-white text-warm-800 rounded-lg transition-all flex items-center justify-center gap-1 active:scale-95 touch-manipulation"
                        >
                          <Plus className="h-3.5 w-3.5" /> Agregar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-warm-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-xl text-xs font-bold transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-xl text-xs font-bold transition-all shadow-warm flex items-center gap-1.5 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {loading ? "Guardando..." : "Crear Arreglo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
