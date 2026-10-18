"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Plus,
  Edit2,
  Trash2,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Check,
  Loader2,
  Sparkles,
  Search
} from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  getQuickRepliesAction,
  createQuickReplyAction,
  updateQuickReplyAction,
  deleteQuickReplyAction,
} from "@/app/actions/omnichannel";
import { toast } from "@/components/ui/toast";

export interface QuickReplyItem {
  id: string;
  title: string;
  category: string;
  text: string;
  mediaUrl?: string | null;
  mediaName?: string | null;
  mediaType?: string | null;
  shortcut?: string | null;
  createdAt?: string | Date;
}

interface QuickRepliesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectReply?: (reply: QuickReplyItem) => void;
  onUpdated?: () => void;
}

const CATEGORIES = ["Todas", "General", "Catálogo", "Pagos", "Envíos", "Saludos", "Otros"];

export default function QuickRepliesModal({
  isOpen,
  onClose,
  onSelectReply,
  onUpdated,
}: QuickRepliesModalProps) {
  const [replies, setReplies] = useState<QuickReplyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [searchQuery, setSearchQuery] = useState("");

  const confirm = useConfirm();

  // Create/Edit form state
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState("General");
  const [formText, setFormText] = useState("");
  const [formShortcut, setFormShortcut] = useState("");
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    type: string;
    base64: string;
    previewUrl?: string;
    existingUrl?: string;
  } | null>(null);

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadReplies();
      resetForm();
    }
  }, [isOpen]);

  const loadReplies = async () => {
    setLoading(true);
    const res = await getQuickRepliesAction();
    if (res.success && Array.isArray(res.data)) {
      setReplies(res.data as QuickReplyItem[]);
    } else {
      toast.error(res.error || "Error al cargar respuestas predeterminadas");
    }
    setLoading(false);
  };

  const resetForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormTitle("");
    setFormCategory("General");
    setFormText("");
    setFormShortcut("");
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startEdit = (reply: QuickReplyItem) => {
    setIsEditing(true);
    setEditingId(reply.id);
    setFormTitle(reply.title);
    setFormCategory(reply.category || "General");
    setFormText(reply.text);
    setFormShortcut(reply.shortcut || "");
    if (reply.mediaUrl) {
      setAttachedFile({
        name: reply.mediaName || "Archivo adjunto",
        type: reply.mediaType || "document",
        base64: "",
        previewUrl: reply.mediaType === "image" ? reply.mediaUrl : undefined,
        existingUrl: reply.mediaUrl,
      });
    } else {
      setAttachedFile(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast.error("El archivo supera el límite de 15MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const isImage = file.type.startsWith("image/");
      setAttachedFile({
        name: file.name,
        type: file.type,
        base64,
        previewUrl: isImage ? base64 : undefined,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formText.trim()) {
      toast.error("Por favor completa el título y el texto del mensaje");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        // Update
        const res = await updateQuickReplyAction({
          id: editingId,
          title: formTitle,
          category: formCategory,
          text: formText,
          shortcut: formShortcut || null,
          mediaBase64: attachedFile?.base64 || null,
          mediaFileName: attachedFile?.name || null,
          mediaMimeType: attachedFile?.type || null,
          mediaUrl: attachedFile?.existingUrl || null,
          mediaName: attachedFile?.name || null,
          mediaType: attachedFile?.type?.startsWith("image/") ? "image" : "document",
        });

        if (res.success) {
          toast.success("Respuesta predeterminada actualizada");
          resetForm();
          await loadReplies();
          onUpdated?.();
        } else {
          toast.error(res.error || "Error al actualizar respuesta");
        }
      } else {
        // Create
        const res = await createQuickReplyAction({
          title: formTitle,
          category: formCategory,
          text: formText,
          shortcut: formShortcut || null,
          mediaBase64: attachedFile?.base64 || null,
          mediaFileName: attachedFile?.name || null,
          mediaMimeType: attachedFile?.type || null,
          mediaType: attachedFile?.type?.startsWith("image/") ? "image" : "document",
        });

        if (res.success) {
          toast.success("Nueva respuesta predeterminada creada");
          resetForm();
          await loadReplies();
          onUpdated?.();
        } else {
          toast.error(res.error || "Error al crear respuesta");
        }
      }
    } catch {
      toast.error("Error de conexión al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm("¿Seguro que deseas eliminar este mensaje predeterminado?");
    if (!ok) return;
    setDeletingId(id);
    const res = await deleteQuickReplyAction(id);
    if (res.success) {
      toast.success("Mensaje eliminado");
      await loadReplies();
      if (editingId === id) resetForm();
      onUpdated?.();
    } else {
      toast.error(res.error || "Error al eliminar");
    }
    setDeletingId(null);
  };

  if (!isOpen) return null;

  const filteredReplies = replies.filter((r) => {
    const matchesCategory = selectedCategory === "Todas" || r.category === selectedCategory;
    const matchesSearch =
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.shortcut && r.shortcut.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-warm-200 shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-warm-50 border-b border-warm-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-terracotta-100 text-terracotta-700 rounded-xl shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base text-warm-900 truncate">
                Gestión de Mensajes Predeterminados y Catálogos
              </h3>
              <p className="text-[11px] sm:text-xs text-warm-500 truncate">
                Crea plantillas rápidas con documentos (PDFs, listas de precios) e imágenes adjuntas.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 hover:bg-warm-100 text-warm-500 hover:text-warm-900 rounded-xl transition-colors shrink-0"
            aria-label="Cerrar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body: Split Grid (List / Form) */}
        <div className="grid grid-cols-1 md:grid-cols-12 overflow-hidden flex-1 divide-y md:divide-y-0 md:divide-x divide-warm-200">
          {/* Left Column: List of Quick Replies */}
          <div className="md:col-span-7 p-4 flex flex-col min-h-0 space-y-3 overflow-hidden">
            {/* Search & Categories Bar */}
            <div className="space-y-2 shrink-0">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-warm-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar respuesta rápida o atajo (/catalogo)..."
                  className="w-full pl-9 pr-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-xs text-warm-900 focus:outline-none focus:border-terracotta-500"
                />
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                      selectedCategory === cat
                        ? "bg-terracotta-500 text-white shadow-xs"
                        : "bg-warm-100 text-warm-700 hover:bg-warm-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[420px]">
              {loading ? (
                <div className="py-12 text-center text-xs text-warm-400 flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando mensajes predeterminados...
                </div>
              ) : filteredReplies.length === 0 ? (
                <div className="py-10 text-center text-xs text-warm-400 bg-warm-50 rounded-2xl border border-dashed border-warm-200 p-6">
                  No hay mensajes predeterminados en esta sección.
                </div>
              ) : (
                filteredReplies.map((r) => (
                  <div
                    key={r.id}
                    className={`p-3.5 rounded-2xl border transition-all text-xs space-y-2 ${
                      editingId === r.id
                        ? "bg-terracotta-50/70 border-terracotta-400 shadow-xs"
                        : "bg-white border-warm-200 hover:border-warm-300 hover:shadow-xs"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-warm-900 text-xs">{r.title}</span>
                          <span className="px-2 py-0.5 bg-warm-100 text-warm-700 rounded-md text-[10px] font-semibold">
                            {r.category}
                          </span>
                          {r.shortcut && (
                            <span className="font-mono text-[10px] text-terracotta-600 bg-terracotta-50 px-1.5 py-0.5 rounded border border-terracotta-200">
                              {r.shortcut}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        {onSelectReply && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectReply(r);
                              onClose();
                            }}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[11px] font-bold transition-colors"
                            title="Usar en chat actual"
                          >
                            Usar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => startEdit(r)}
                          className="p-1.5 hover:bg-warm-100 text-warm-600 hover:text-warm-900 rounded-lg transition-colors"
                          title="Editar mensaje"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(r.id)}
                          disabled={deletingId === r.id}
                          className="p-1.5 hover:bg-rose-50 text-warm-400 hover:text-rose-600 rounded-lg transition-colors"
                          title="Eliminar mensaje"
                        >
                          {deletingId === r.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <p className="text-warm-600 text-[11px] leading-relaxed line-clamp-3 bg-warm-50/60 p-2 rounded-xl border border-warm-100">
                      {r.text}
                    </p>

                    {/* Media Attachment Badge */}
                    {r.mediaUrl && (
                      <div className="flex items-center gap-2 p-1.5 bg-warm-100 rounded-lg text-[11px] text-warm-800 font-medium w-fit max-w-full">
                        {r.mediaType === "image" ? (
                          <ImageIcon className="h-3.5 w-3.5 text-pink-600 shrink-0" />
                        ) : (
                          <FileText className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                        )}
                        <span className="truncate max-w-[220px]">{r.mediaName || "Archivo adjunto"}</span>
                        <a
                          href={r.mediaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-terracotta-600 underline font-bold"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Ver
                        </a>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Column: Form to Create or Edit */}
          <div className="md:col-span-5 p-4 sm:p-5 bg-warm-50/40 flex flex-col justify-between overflow-y-auto max-h-[500px]">
            <form onSubmit={handleSave} className="space-y-3.5">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs sm:text-sm text-warm-900 flex items-center gap-1.5">
                  {isEditing ? <Edit2 className="h-4 w-4 text-terracotta-600" /> : <Plus className="h-4 w-4 text-terracotta-600" />}
                  <span>{isEditing ? "Editar Mensaje" : "Nuevo Mensaje Predeterminado"}</span>
                </h4>
                {isEditing && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-[11px] font-bold text-warm-500 hover:text-warm-900"
                  >
                    Cancelar Edición
                  </button>
                )}
              </div>

              {/* Title */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-warm-700 block">Título / Nombre:</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ej: Catálogo 2026, Precios de Envío..."
                  className="w-full p-2.5 bg-white border border-warm-200 rounded-xl text-xs text-warm-900 focus:outline-none focus:border-terracotta-500 shadow-2xs"
                  required
                />
              </div>

              {/* Category & Shortcut */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-warm-700 block">Categoría:</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full p-2 bg-white border border-warm-200 rounded-xl text-xs text-warm-900 font-bold focus:outline-none"
                  >
                    {CATEGORIES.filter((c) => c !== "Todas").map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-warm-700 block">Atajo (Opcional):</label>
                  <input
                    type="text"
                    value={formShortcut}
                    onChange={(e) => setFormShortcut(e.target.value)}
                    placeholder="/catalogo"
                    className="w-full p-2 bg-white border border-warm-200 rounded-xl text-xs text-warm-900 font-mono focus:outline-none"
                  />
                </div>
              </div>

              {/* Message Text */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-warm-700 block">Texto del Mensaje:</label>
                <textarea
                  value={formText}
                  onChange={(e) => setFormText(e.target.value)}
                  rows={4}
                  placeholder="Escribe el mensaje que se enviará automáticamente..."
                  className="w-full p-2.5 bg-white border border-warm-200 rounded-xl text-xs text-warm-900 leading-relaxed focus:outline-none focus:border-terracotta-500 shadow-2xs resize-none"
                  required
                />
              </div>

              {/* Attachment Picker */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-warm-700 block flex items-center justify-between">
                  <span>Documento o Foto Adjunta (PDF, Catálogo, QR):</span>
                  <span className="text-[10px] text-warm-400 font-normal">Máx 15MB</span>
                </label>

                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx"
                  className="hidden"
                />

                {attachedFile ? (
                  <div className="flex items-center justify-between p-2.5 bg-warm-100 rounded-xl border border-warm-200 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      {attachedFile.previewUrl ? (
                        <img
                          src={attachedFile.previewUrl}
                          alt="Preview"
                          className="h-8 w-8 object-cover rounded-lg border border-warm-300 shrink-0"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-lg bg-warm-200 flex items-center justify-center text-warm-700 shrink-0">
                          <FileText className="h-4 w-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-warm-900 truncate max-w-[170px]">{attachedFile.name}</p>
                        <p className="text-[10px] text-warm-500 uppercase">{attachedFile.type || "Documento"}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setAttachedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="p-1 hover:bg-warm-200 text-warm-500 hover:text-warm-900 rounded-lg transition-colors"
                      title="Quitar archivo"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2.5 px-3 bg-white hover:bg-warm-100 border border-dashed border-warm-300 hover:border-terracotta-400 rounded-xl text-xs font-semibold text-warm-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Paperclip className="h-4 w-4 text-terracotta-500" />
                    <span>Adjuntar Catálogo PDF o Imagen</span>
                  </button>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-2.5 bg-terracotta-500 hover:bg-terracotta-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-warm flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isEditing ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  <span>{isEditing ? "Guardar Cambios" : "Crear Mensaje Predeterminado"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
