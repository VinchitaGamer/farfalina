"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, Save, Trash2, Plus, Package, Sparkles, Tag, Search } from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { updateArrangementAction, deleteArrangementAction, getRawIngredientsAction } from "@/app/actions/arrangements";
import { toast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";

interface RawIngredientItem {
  id: string;
  name: string;
  type: string;
  available: number;
  unit: string;
  costPerUnit: number;
}

interface ArrangementItemData {
  id: string;
  name: string;
  category: string;
  price: number;
  featured: boolean;
  image: string;
  description: string;
  recipeItems?: {
    rawIngredientId: string;
    quantityNeeded: number;
    rawIngredient?: { name: string; unit: string; costPerUnit?: number };
  }[];
}

interface EditArrangementModalProps {
  isOpen: boolean;
  arrangement: ArrangementItemData | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditArrangementModal({
  isOpen,
  arrangement,
  onClose,
  onSuccess,
}: EditArrangementModalProps) {
  const confirm = useConfirm();
  // Dynamic Arrangement Categories
  const DEFAULT_ARR_CATEGORIES = ["Rosas", "Girasoles", "Arreglos Mixtos", "Insumos & Jarrones"];
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("Rosas");
  const [price, setPrice] = useState<number | string>(280);
  const [featured, setFeatured] = useState<boolean>(false);

  const [image, setImage] = useState("");
  const [description, setDescription] = useState("");

  const [availableIngredients, setAvailableIngredients] = useState<RawIngredientItem[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<{ rawIngredientId: string; quantityNeeded: number }[]>([]);

  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("floreria_arrangement_categories");
      if (saved) {
        setCustomCategories(JSON.parse(saved));
      }
    } catch {}
  }, []);

  const allCategories = Array.from(
    new Set([
      ...DEFAULT_ARR_CATEGORIES,
      ...customCategories,
      ...(arrangement ? [arrangement.category] : []),
    ])
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

  const [recipeCategory, setRecipeCategory] = useState<string>("Todos");
  const [recipeSearch, setRecipeSearch] = useState<string>("");

  useEffect(() => {
    if (isOpen && arrangement) {
      setName(arrangement.name);
      setCategory(arrangement.category);
      setPrice(arrangement.price);
      setFeatured(arrangement.featured);
      setImage(arrangement.image);
      setDescription(arrangement.description);
      setRecipeCategory("Todos");
      setRecipeSearch("");

      if (arrangement.recipeItems) {
        setSelectedRecipe(
          arrangement.recipeItems.map((r) => ({
            rawIngredientId: r.rawIngredientId,
            quantityNeeded: r.quantityNeeded,
          }))
        );
      }

      loadIngredients();
    }
  }, [isOpen, arrangement]);

  const loadIngredients = async () => {
    const res = await getRawIngredientsAction();
    if (res.success && Array.isArray(res.data)) {
      setAvailableIngredients(res.data as RawIngredientItem[]);
    }
  };

  const dynamicCategories = useMemo(() => {
    const rawTypes = availableIngredients
      .map((i) => (i.type || "").trim())
      .filter((t) => t.length > 0);
    const uniqueTypes = Array.from(new Set(rawTypes));
    return ["Todos", ...uniqueTypes];
  }, [availableIngredients]);

  const filteredIngredients = useMemo(() => {
    return availableIngredients.filter((i) => {
      const matchesCategory =
        recipeCategory === "Todos" ||
        (i.type || "").trim().toLowerCase() === recipeCategory.trim().toLowerCase();

      const q = recipeSearch.trim().toLowerCase();
      const matchesSearch =
        !q ||
        i.name.toLowerCase().includes(q) ||
        (i.unit && i.unit.toLowerCase().includes(q)) ||
        (i.type && i.type.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [availableIngredients, recipeCategory, recipeSearch]);

  if (!isOpen || !arrangement) return null;

  const addIngredient = (ingId: string) => {
    setSelectedRecipe((prev) => {
      const exists = prev.find((r) => r.rawIngredientId === ingId);
      if (exists) {
        return prev.map((r) => (r.rawIngredientId === ingId ? { ...r, quantityNeeded: r.quantityNeeded + 1 } : r));
      }
      return [...prev, { rawIngredientId: ingId, quantityNeeded: 1 }];
    });
  };

  const updateQuantity = (ingId: string, qty: number) => {
    if (qty <= 0) {
      setSelectedRecipe((prev) => prev.filter((r) => r.rawIngredientId !== ingId));
      return;
    }
    setSelectedRecipe((prev) =>
      prev.map((r) => (r.rawIngredientId === ingId ? { ...r, quantityNeeded: qty } : r))
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !image.trim() || !description.trim()) {
      setError("Por favor completa todos los campos requeridos.");
      return;
    }

    setLoading(true);
    setError(null);

    const res = await updateArrangementAction({
      id: arrangement.id,
      name,
      category,
      price: Number(price),
      featured,
      image,
      description,
      recipeItems: selectedRecipe,
    });

    setLoading(false);

    if (res.success) {
      toast.success("¡Arreglo actualizado exitosamente!");
      onSuccess();
      onClose();
    } else {
      setError(res.error || "No se pudo actualizar el arreglo.");
      toast.error(res.error || "Error al actualizar el arreglo.");
    }
  };

  const handleDelete = async () => {
    const ok = await confirm(`¿Estás seguro de eliminar "${arrangement.name}"?`);
    if (!ok) return;

    setDeleting(true);
    const res = await deleteArrangementAction(arrangement.id);
    setDeleting(false);

    if (res.success) {
      toast.success("Arreglo eliminado del catálogo.");
      onSuccess();
      onClose();
    } else {
      toast.error(res.error || "Error al eliminar el arreglo.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-3xl border border-warm-200 shadow-2xl max-w-xl w-full max-h-[90dvh] overflow-y-auto p-6 space-y-5 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-warm-200">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-terracotta-600" />
            <h3 className="font-bold text-base text-warm-900">Editar Arreglo: {arrangement.name}</h3>
          </div>
          <button onClick={onClose} className="p-1 text-warm-400 hover:text-warm-700 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-warm-800">Nombre del Arreglo *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs text-warm-900 focus:outline-none focus:border-terracotta-500"
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-warm-800 flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5 text-terracotta-600" />
                  <span>Categoría *</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddingCategory(!isAddingCategory)}
                  className="text-[11px] font-bold text-terracotta-600 hover:text-terracotta-800 flex items-center gap-0.5"
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
                      placeholder="Ej. Orquídeas, Cajas de Flores..."
                      className="flex-1 p-1.5 text-xs bg-white border border-terracotta-300 rounded-lg text-warm-900 focus:outline-none focus:border-terracotta-500 font-medium"
                    />
                    <button
                      type="button"
                      onClick={handleAddCategory}
                      className="px-2.5 py-1.5 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-lg text-xs font-bold transition-all whitespace-nowrap"
                    >
                      Guardar
                    </button>
                  </div>
                </div>
              )}

              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs text-warm-900 focus:outline-none focus:border-terracotta-500 font-medium"
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-warm-800">Precio Público (Bs) *</label>
              <input
                type="text"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
                className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs text-warm-900 focus:outline-none focus:border-terracotta-500 font-medium font-mono"
                required
              />
            </div>

            <div className="space-y-1 flex flex-col justify-end">
              <label className="flex items-center gap-2 text-xs font-bold text-warm-800 cursor-pointer p-2.5 bg-warm-50 rounded-xl border border-warm-200">
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  className="rounded text-terracotta-600 focus:ring-terracotta-500 h-4 w-4"
                />
                <span>Producto Destacado</span>
              </label>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-warm-800">URL Fotografía HD *</label>
            <input
              type="url"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs text-warm-900 focus:outline-none focus:border-terracotta-500 font-mono"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-warm-800">Descripción *</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs text-warm-900 focus:outline-none focus:border-terracotta-500"
              required
            />
          </div>

          {/* Section: Edit Recipe with Bento Grid */}
          <div className="p-3.5 bg-warm-50 border border-warm-200 rounded-2xl space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-warm-200 pb-2">
              <span className="text-xs font-bold text-warm-900 flex items-center gap-1.5">
                <Package className="h-4 w-4 text-terracotta-600" />
                Bento Grid: Receta de Insumos del Arreglo
              </span>
              <span className="text-[11px] font-mono text-terracotta-700 font-bold">
                Costo Receta: {formatCurrency(
                  selectedRecipe.reduce((acc, curr) => {
                    const ing = availableIngredients.find((i) => i.id === curr.rawIngredientId);
                    return acc + (ing ? ing.costPerUnit * curr.quantityNeeded : 0);
                  }, 0)
                )}
              </span>
            </div>

            {/* Bento Filter & Search Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
                {dynamicCategories.map((cat) => (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => setRecipeCategory(cat)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors whitespace-nowrap ${
                      recipeCategory === cat
                        ? "bg-terracotta-500 text-white shadow-xs"
                        : "bg-white text-warm-700 hover:bg-warm-100 border border-warm-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-44 shrink-0">
                <Search className="h-3 w-3 absolute left-2.5 top-2.5 text-warm-400" />
                <input
                  type="text"
                  value={recipeSearch}
                  onChange={(e) => setRecipeSearch(e.target.value)}
                  placeholder="Buscar insumo..."
                  className="w-full pl-7 pr-2 py-1 bg-white border border-warm-200 rounded-lg text-xs text-warm-900 focus:outline-none focus:border-terracotta-500 placeholder:text-warm-400"
                />
              </div>
            </div>

            {/* Bento Grid Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
              {filteredIngredients.map((ing) => {
                const recipeItem = selectedRecipe.find((r) => r.rawIngredientId === ing.id);
                const isSelected = !!recipeItem;
                const qty = recipeItem ? recipeItem.quantityNeeded : 0;

                return (
                  <div
                    key={ing.id}
                    className={`p-2 rounded-xl border text-left flex flex-col justify-between space-y-1 ${
                      isSelected
                        ? "bg-terracotta-50/70 border-terracotta-400 shadow-sm"
                        : "bg-white border-warm-200 hover:border-warm-300"
                    }`}
                  >
                    <div>
                      <span className="px-1 py-0.2 text-[8px] font-bold bg-warm-100 text-warm-700 rounded">
                        {ing.type}
                      </span>
                      <p className="text-[11px] font-bold text-warm-900 line-clamp-1 mt-0.5">{ing.name}</p>
                    </div>

                    <div className="flex items-center justify-between text-[9px] text-warm-500">
                      <span>{ing.available} {ing.unit}</span>
                      <span className="font-mono">{formatCurrency(ing.costPerUnit)}/u</span>
                    </div>

                    <div className="pt-1 border-t border-warm-200 flex items-center justify-between">
                      {isSelected ? (
                        <div className="flex items-center justify-between w-full bg-white rounded p-0.5 border border-terracotta-300">
                          <button
                            type="button"
                            onClick={() => updateQuantity(ing.id, qty - 1)}
                            className="p-0.5 text-warm-600 hover:bg-warm-100 rounded"
                          >
                            <Trash2 className="h-3 w-3 text-rose-500" />
                          </button>
                          <span className="font-bold text-[11px] text-terracotta-800 px-1">{qty}</span>
                          <button
                            type="button"
                            onClick={() => addIngredient(ing.id)}
                            className="p-0.5 text-warm-600 hover:bg-warm-100 rounded"
                          >
                            <Plus className="h-3 w-3 text-terracotta-600" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => addIngredient(ing.id)}
                          className="w-full py-0.5 text-[10px] font-bold bg-warm-100 hover:bg-terracotta-500 hover:text-white text-warm-800 rounded transition-all flex items-center justify-center gap-1"
                        >
                          <Plus className="h-3 w-3" /> Añadir
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-warm-200 flex items-center justify-between">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-2 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {deleting ? "Eliminando..." : "Eliminar Arreglo"}
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-xl text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-xl text-xs font-bold shadow-warm flex items-center gap-1.5"
              >
                <Save className="h-4 w-4" />
                {loading ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
