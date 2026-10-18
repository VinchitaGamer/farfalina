"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Instagram,
  MessageSquare,
  Send,
  Lock,
  Globe,
  RefreshCw,
  ExternalLink,
  Heart,
  MessageCircle,
  CheckCircle2,
  Clock,
  User,
  Image as ImageIcon,
  AlertCircle,
  Loader2,
  Sparkles,
  CornerDownRight,
  Search,
  Filter,
  Check,
} from "lucide-react";
import {
  getInstagramPostsAction,
  getInstagramCommentsAction,
  replyInstagramCommentAction,
  syncInstagramPostsAction,
} from "@/app/actions/omnichannel";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface InstagramPostItem {
  id: string;
  instagramId: string;
  caption: string | null;
  mediaType: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  commentsCount: number;
  likeCount: number;
  timestamp: string | Date | null;
  environment: string;
  createdAt: string | Date;
  comments?: InstagramCommentItem[];
  _count?: {
    comments: number;
  };
}

interface InstagramCommentItem {
  id: string;
  instagramId: string;
  postId: string;
  text: string;
  fromId: string | null;
  fromUsername: string | null;
  userProfilePic: string | null;
  parentId: string | null;
  isReply: boolean;
  isPrivateReplySent: boolean;
  privateReplyText: string | null;
  environment: string;
  timestamp: string | Date | null;
  createdAt: string | Date;
  replies?: InstagramCommentItem[];
}

interface InstagramPostsPanelProps {
  environment?: string;
  accentColor?: "terracotta" | "amberGold" | string;
}

export default function InstagramPostsPanel({
  environment = "farfalina",
  accentColor = "terracotta",
}: InstagramPostsPanelProps) {
  const [posts, setPosts] = useState<InstagramPostItem[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<InstagramCommentItem[]>([]);
  const [loadingPosts, setLoadingPosts] = useState<boolean>(true);
  const [loadingComments, setLoadingComments] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Reply Composer State
  const [replyingComment, setReplyingComment] = useState<InstagramCommentItem | null>(null);
  const [replyText, setReplyText] = useState<string>("");
  const [replyType, setReplyType] = useState<"public" | "private">("public");
  const [isSubmittingReply, setIsSubmittingReply] = useState<boolean>(false);

  const isTerra = accentColor === "terracotta";
  const theme = {
    badgeBg: isTerra ? "bg-terracotta-100" : "bg-amberGold-100",
    badgeText: isTerra ? "text-terracotta-800" : "text-amberGold-800",
    borderActive: isTerra ? "border-terracotta-500" : "border-amberGold-500",
    bgActive: isTerra ? "bg-terracotta-50/70" : "bg-amberGold-50/70",
    btnPrimary: isTerra
      ? "bg-terracotta-600 hover:bg-terracotta-700 text-white"
      : "bg-amberGold-600 hover:bg-amberGold-700 text-white",
    btnSecondary: isTerra
      ? "bg-terracotta-50 text-terracotta-700 hover:bg-terracotta-100 border border-terracotta-200"
      : "bg-amberGold-50 text-amberGold-800 hover:bg-amberGold-100 border border-amberGold-200",
    indicator: isTerra ? "bg-terracotta-500" : "bg-amberGold-500",
    focusRing: isTerra ? "focus:ring-terracotta-500" : "focus:ring-amberGold-500",
  };

  const loadPosts = useCallback(
    async (preserveSelected = true) => {
      try {
        setLoadingPosts(true);
        const res = await getInstagramPostsAction({ environment });
        if (res.success && Array.isArray(res.data)) {
          const fetchedPosts = res.data as InstagramPostItem[];
          setPosts(fetchedPosts);

          if (!preserveSelected || !selectedPostId) {
            if (fetchedPosts.length > 0) {
              setSelectedPostId(fetchedPosts[0].id);
            } else {
              setSelectedPostId(null);
            }
          }
        } else {
          toast.error(res.error || "No se pudieron cargar las publicaciones");
        }
      } catch (err) {
        console.error("[InstagramPostsPanel] Error al cargar posts:", err);
        toast.error("Error al cargar publicaciones de Instagram");
      } finally {
        setLoadingPosts(false);
      }
    },
    [environment, selectedPostId]
  );

  const loadComments = useCallback(
    async (postId: string) => {
      try {
        setLoadingComments(true);
        const res = await getInstagramCommentsAction({ postId, environment });
        if (res.success && Array.isArray(res.data)) {
          setComments(res.data as InstagramCommentItem[]);
        } else {
          setComments([]);
        }
      } catch (err) {
        console.error("[InstagramPostsPanel] Error al cargar comentarios:", err);
        setComments([]);
      } finally {
        setLoadingComments(false);
      }
    },
    [environment]
  );

  useEffect(() => {
    loadPosts(false);
  }, [environment]);

  useEffect(() => {
    if (selectedPostId) {
      loadComments(selectedPostId);
      setReplyingComment(null);
      setReplyText("");
    } else {
      setComments([]);
    }
  }, [selectedPostId, loadComments]);

  const handleSyncPosts = async () => {
    try {
      setIsSyncing(true);
      toast.info("Consultando Meta Graph API para sincronizar publicaciones...");
      const res = await syncInstagramPostsAction({ environment });
      if (res.success) {
        const data = res.data as { syncedPosts: number; syncedComments: number };
        toast.success(`Sincronización completa: ${data.syncedPosts} posts, ${data.syncedComments} comentarios.`);
        await loadPosts(true);
      } else {
        toast.error(res.error || "Error al sincronizar con Meta");
      }
    } catch {
      toast.error("Error de conexión al sincronizar con Meta");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyingComment) {
      toast.error("Selecciona un comentario para responder");
      return;
    }
    if (!replyText.trim()) {
      toast.error("El texto de la respuesta no puede estar vacío");
      return;
    }

    try {
      setIsSubmittingReply(true);
      const res = await replyInstagramCommentAction({
        commentId: replyingComment.id,
        text: replyText.trim(),
        replyType,
        environment,
      });

      if (res.success) {
        if (replyType === "public") {
          toast.success("¡Respuesta pública enviada a Instagram!");
          // Append local reply comment
          if (res.data) {
            const newReply = res.data as InstagramCommentItem;
            setComments((prev) => [newReply, ...prev]);
          }
        } else {
          toast.success("¡Mensaje privado (DM) enviado exitosamente al comentarista!");
          // Mark comment as private reply sent
          setComments((prev) =>
            prev.map((c) =>
              c.id === replyingComment.id
                ? { ...c, isPrivateReplySent: true, privateReplyText: replyText.trim() }
                : c
            )
          );
        }

        setReplyText("");
        setReplyingComment(null);

        // Refresh comments list
        if (selectedPostId) {
          loadComments(selectedPostId);
        }
      } else {
        toast.error(res.error || "No se pudo despachar la respuesta");
      }
    } catch {
      toast.error("Error de conexión al responder el comentario");
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const filteredPosts = posts.filter((p) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      (p.caption && p.caption.toLowerCase().includes(query)) ||
      p.instagramId.includes(query)
    );
  });

  const selectedPost = posts.find((p) => p.id === selectedPostId);

  // Group top-level comments and nested replies
  const topLevelComments = comments.filter((c) => !c.isReply && !c.parentId);
  const repliesMap = new Map<string, InstagramCommentItem[]>();
  for (const c of comments) {
    if (c.parentId) {
      if (!repliesMap.has(c.parentId)) repliesMap.set(c.parentId, []);
      repliesMap.get(c.parentId)!.push(c);
    }
  }

  // Format date helper
  const formatDate = (dateVal: string | Date | null | undefined): string => {
    if (!dateVal) return "Fecha desconocida";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "Fecha desconocida";
    return d.toLocaleDateString("es-BO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-warm-200 shadow-sm overflow-hidden flex flex-col min-h-[720px]">
      {/* 1. TOP HEADER BAR */}
      <div className="p-4 sm:p-5 border-b border-warm-200 bg-gradient-to-r from-warm-50 via-white to-pink-50/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white rounded-xl shadow-sm">
            <Instagram className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-warm-900">
                Publicaciones y Comentarios de Instagram
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-pink-100 text-pink-700 rounded-md uppercase tracking-wider">
                Graph API v22.0
              </span>
            </div>
            <p className="text-xs text-warm-500 mt-0.5">
              Monitoreo en tiempo real de interacciones, comentarios de clientes y despacho de respuestas públicas o privadas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={handleSyncPosts}
            disabled={isSyncing}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-warm-100 hover:bg-warm-200 text-warm-800 transition-all flex items-center gap-1.5 disabled:opacity-50"
            title="Sincronizar publicaciones y comentarios desde Meta Graph API"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin text-pink-600")} />
            <span>{isSyncing ? "Sincronizando..." : "Sincronizar Meta"}</span>
          </button>

          <button
            onClick={() => loadPosts(true)}
            disabled={loadingPosts}
            className="p-2 text-warm-600 hover:text-warm-900 bg-warm-100 hover:bg-warm-200 rounded-xl transition-all"
            title="Recargar bandeja local"
          >
            <RefreshCw className={cn("h-4 w-4", loadingPosts && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* 2. MAIN 2-COLUMN WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-[640px]">
        {/* ===================================================================== */}
        {/* LEFT COLUMN: POSTS FEED (col-span-5 or 4)                            */}
        {/* ===================================================================== */}
        <div className="lg:col-span-4 xl:col-span-4 border-r border-warm-200 flex flex-col bg-warm-50/40">
          {/* Search bar */}
          <div className="p-3 border-b border-warm-200 bg-white">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-warm-400" />
              <input
                type="text"
                placeholder="Buscar por texto o ID de post..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-warm-100/60 border border-warm-200 rounded-xl text-xs text-warm-900 placeholder:text-warm-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-pink-500"
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-warm-500 mt-2 px-1">
              <span>{filteredPosts.length} publicaciones</span>
              <span className="font-mono text-[10px]">@{environment === "carissma" ? "carissma_vestidos" : "sour_jhxn"}</span>
            </div>
          </div>

          {/* Posts list */}
          <div className="flex-1 overflow-y-auto divide-y divide-warm-100 p-2 space-y-2">
            {loadingPosts ? (
              <div className="flex flex-col items-center justify-center p-12 text-warm-400 gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-pink-500" />
                <span className="text-xs">Cargando publicaciones...</span>
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center text-warm-400">
                <div className="p-3 bg-warm-100 rounded-full mb-3 text-warm-400">
                  <ImageIcon className="h-6 w-6" />
                </div>
                <p className="text-xs font-semibold text-warm-700">Sin publicaciones registradas</p>
                <p className="text-[11px] text-warm-400 mt-1 max-w-[220px]">
                  Las publicaciones aparecerán automáticamente cuando lleguen comentarios vía Webhook o al presionar "Sincronizar Meta".
                </p>
              </div>
            ) : (
              filteredPosts.map((post) => {
                const isSelected = post.id === selectedPostId;
                return (
                  <div
                    key={post.id}
                    onClick={() => setSelectedPostId(post.id)}
                    className={cn(
                      "p-3 rounded-xl border transition-all cursor-pointer flex gap-3 text-left group",
                      isSelected
                        ? "bg-white border-pink-500 shadow-sm ring-1 ring-pink-500"
                        : "bg-white hover:bg-warm-100/60 border-warm-200/80"
                    )}
                  >
                    {/* Media Thumbnail */}
                    <div className="w-16 h-16 rounded-lg bg-warm-100 border border-warm-200 shrink-0 overflow-hidden relative flex items-center justify-center">
                      {post.mediaUrl || post.thumbnailUrl ? (
                        <img
                          src={post.thumbnailUrl || post.mediaUrl || ""}
                          alt="Media preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <Instagram className="h-6 w-6 text-pink-400 opacity-60" />
                      )}
                      <span className="absolute bottom-1 right-1 px-1 py-0.2 bg-black/70 text-white text-[8px] font-bold rounded">
                        {post.mediaType || "POST"}
                      </span>
                    </div>

                    {/* Post Snippet Info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-1 text-[10px] text-warm-400">
                          <span className="font-mono truncate">ID: {post.instagramId.slice(-8)}</span>
                          <span>{formatDate(post.timestamp || post.createdAt)}</span>
                        </div>
                        <p className="text-xs text-warm-800 line-clamp-2 mt-0.5 leading-snug">
                          {post.caption || "(Sin pie de foto / Reel publicado)"}
                        </p>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-warm-500">
                        <div className="flex items-center gap-1 font-medium text-pink-600">
                          <MessageCircle className="h-3 w-3" />
                          <span>{post.commentsCount || 0}</span>
                        </div>
                        <div className="flex items-center gap-1 font-medium text-rose-500">
                          <Heart className="h-3 w-3" />
                          <span>{post.likeCount || 0}</span>
                        </div>
                        {post.permalink && (
                          <a
                            href={post.permalink}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="ml-auto text-warm-400 hover:text-pink-600 transition-colors"
                            title="Ver en Instagram"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ===================================================================== */}
        {/* RIGHT COLUMN: COMMENTS THREAD & RESPONSE COMPOSER (col-span-7 or 8)  */}
        {/* ===================================================================== */}
        <div className="lg:col-span-8 xl:col-span-8 flex flex-col bg-white">
          {!selectedPost ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-warm-400">
              <div className="p-4 bg-warm-100 rounded-2xl mb-3 text-warm-400">
                <MessageSquare className="h-8 w-8" />
              </div>
              <h3 className="text-sm font-bold text-warm-700">Selecciona una publicación</h3>
              <p className="text-xs text-warm-400 mt-1 max-w-sm">
                Haz clic en una publicación del feed izquierdo para inspeccionar los comentarios de los usuarios y despachar respuestas públicas o mensajes privados.
              </p>
            </div>
          ) : (
            <>
              {/* Post Summary Header */}
              <div className="p-4 border-b border-warm-200 bg-warm-50/50 flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-warm-100 border border-warm-200 shrink-0 overflow-hidden flex items-center justify-center">
                  {selectedPost.mediaUrl || selectedPost.thumbnailUrl ? (
                    <img
                      src={selectedPost.thumbnailUrl || selectedPost.mediaUrl || ""}
                      alt="Thumbnail"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Instagram className="h-6 w-6 text-pink-500" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono text-warm-400">
                      ID Meta: {selectedPost.instagramId}
                    </span>
                    {selectedPost.permalink && (
                      <a
                        href={selectedPost.permalink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-pink-600 hover:text-pink-700 font-semibold flex items-center gap-1 group"
                      >
                        <span>Abrir en Instagram</span>
                        <ExternalLink className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                      </a>
                    )}
                  </div>
                  <p className="text-xs font-medium text-warm-900 mt-1 line-clamp-3 leading-relaxed">
                    {selectedPost.caption || "(Publicación sin texto / multimedia directa)"}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-[11px] text-warm-500">
                    <span>Publicado: {formatDate(selectedPost.timestamp || selectedPost.createdAt)}</span>
                    <span>•</span>
                    <span className="font-semibold text-pink-600">{comments.length} comentarios registrados</span>
                  </div>
                </div>
              </div>

              {/* Comments Thread List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50/40">
                {loadingComments ? (
                  <div className="flex flex-col items-center justify-center p-12 text-warm-400 gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-pink-500" />
                    <span className="text-xs">Cargando comentarios...</span>
                  </div>
                ) : comments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center text-warm-400">
                    <MessageCircle className="h-7 w-7 mb-2 opacity-50" />
                    <p className="text-xs font-semibold text-warm-700">Sin comentarios en esta publicación</p>
                    <p className="text-[11px] text-warm-400 mt-1 max-w-xs">
                      Cuando un usuario comente en Instagram, el Webhook capturará el evento en tiempo real.
                    </p>
                  </div>
                ) : (
                  topLevelComments.map((comment) => {
                    const isTarget = replyingComment?.id === comment.id;
                    const subReplies = repliesMap.get(comment.id) || [];

                    return (
                      <div
                        key={comment.id}
                        className={cn(
                          "p-3.5 rounded-2xl border transition-all text-left bg-white shadow-xs space-y-2.5",
                          isTarget
                            ? "border-pink-500 ring-2 ring-pink-500/20 bg-pink-50/20"
                            : "border-warm-200"
                        )}
                      >
                        {/* Author Header */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            {/* Avatar */}
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-500 to-amber-500 p-0.5 shrink-0">
                              <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                                {comment.userProfilePic ? (
                                  <img
                                    src={comment.userProfilePic}
                                    alt={comment.fromUsername || "avatar"}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span className="text-xs font-bold text-pink-600 uppercase">
                                    {(comment.fromUsername || "U").charAt(0)}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-warm-900">
                                  @{comment.fromUsername || "usuario_instagram"}
                                </span>
                                {comment.fromId && (
                                  <span className="font-mono text-[9px] text-warm-400">
                                    ({comment.fromId.slice(-4)})
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-warm-400">
                                {formatDate(comment.timestamp || comment.createdAt)}
                              </span>
                            </div>
                          </div>

                          {/* Action badges */}
                          <div className="flex items-center gap-1.5">
                            {comment.isPrivateReplySent && (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>DM Enviado</span>
                              </span>
                            )}
                            <button
                              onClick={() => {
                                setReplyingComment(comment);
                                setReplyType("public");
                              }}
                              className="px-2.5 py-1 text-[11px] font-semibold text-pink-700 bg-pink-50 hover:bg-pink-100 border border-pink-200 rounded-lg transition-colors flex items-center gap-1"
                            >
                              <CornerDownRight className="h-3 w-3" />
                              <span>Responder</span>
                            </button>
                          </div>
                        </div>

                        {/* Comment text */}
                        <p className="text-xs text-warm-800 pl-10 leading-relaxed font-normal">
                          {comment.text}
                        </p>

                        {/* Private Reply snippet audit */}
                        {comment.isPrivateReplySent && comment.privateReplyText && (
                          <div className="ml-10 p-2 rounded-xl bg-emerald-50/70 border border-emerald-200 text-[11px] text-emerald-900 flex items-start gap-2">
                            <Lock className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold">Respuesta privada despachada por DM:</span>
                              <p className="italic text-emerald-800 mt-0.5 font-sans">
                                "{comment.privateReplyText}"
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Sub-replies */}
                        {subReplies.length > 0 && (
                          <div className="ml-10 pl-3 border-l-2 border-pink-200 space-y-2 pt-1">
                            {subReplies.map((reply) => (
                              <div key={reply.id} className="p-2.5 rounded-xl bg-warm-50 border border-warm-100 text-xs">
                                <div className="flex items-center justify-between text-[10px] text-warm-500 mb-1">
                                  <span className="font-bold text-warm-800">
                                    @{reply.fromUsername || "asesor_farfalina"}
                                  </span>
                                  <span>{formatDate(reply.timestamp || reply.createdAt)}</span>
                                </div>
                                <p className="text-xs text-warm-700">{reply.text}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Response Composer Dock */}
              <div className="p-4 border-t border-warm-200 bg-white">
                {replyingComment ? (
                  <div className="space-y-3">
                    {/* Active target banner */}
                    <div className="flex items-center justify-between bg-warm-50 px-3 py-1.5 rounded-xl border border-warm-200 text-xs">
                      <div className="flex items-center gap-1.5 text-warm-700">
                        <CornerDownRight className="h-3.5 w-3.5 text-pink-600" />
                        <span>
                          Respondiendo a{" "}
                          <strong className="text-pink-700">
                            @{replyingComment.fromUsername || "usuario_instagram"}
                          </strong>
                        </span>
                      </div>
                      <button
                        onClick={() => setReplyingComment(null)}
                        className="text-[11px] text-warm-400 hover:text-warm-700 font-semibold"
                      >
                        Cancelar
                      </button>
                    </div>

                    {/* Mode Switch: Public Reply vs Private Reply */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setReplyType("public")}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border",
                          replyType === "public"
                            ? "bg-pink-600 text-white border-pink-600 shadow-sm"
                            : "bg-warm-100 hover:bg-warm-200 text-warm-700 border-warm-200"
                        )}
                      >
                        <Globe className="h-3.5 w-3.5" />
                        <span>Respuesta Pública</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setReplyType("private")}
                        disabled={replyingComment.isPrivateReplySent}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border",
                          replyType === "private"
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                            : replyingComment.isPrivateReplySent
                            ? "bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed opacity-60"
                            : "bg-warm-100 hover:bg-warm-200 text-warm-700 border-warm-200"
                        )}
                      >
                        <Lock className="h-3.5 w-3.5" />
                        <span>Mensaje Privado (DM)</span>
                      </button>

                      <span className="text-[11px] text-warm-400 ml-auto hidden sm:inline">
                        {replyType === "public"
                          ? "Visible bajo el post en Instagram"
                          : "Abre chat privado en Direct Message (máx. 1 vez)"}
                      </span>
                    </div>

                    {/* Text input area */}
                    <div className="relative">
                      <textarea
                        rows={2}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={
                          replyType === "public"
                            ? `Escribe tu respuesta pública para @${replyingComment.fromUsername || "usuario"}...`
                            : `Escribe el mensaje directo privado para @${replyingComment.fromUsername || "usuario"}...`
                        }
                        className="w-full p-3 pr-24 bg-warm-50/60 border border-warm-200 rounded-xl text-xs text-warm-900 placeholder:text-warm-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all resize-none"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendReply();
                          }
                        }}
                      />

                      <div className="absolute right-2 bottom-2.5 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleSendReply}
                          disabled={isSubmittingReply || !replyText.trim()}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50",
                            replyType === "public"
                              ? "bg-pink-600 hover:bg-pink-700 text-white"
                              : "bg-emerald-600 hover:bg-emerald-700 text-white"
                          )}
                        >
                          {isSubmittingReply ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                          <span>Enviar</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-warm-50 rounded-xl border border-warm-200 text-center text-xs text-warm-500">
                    Selecciona un comentario arriba y presiona <strong className="text-pink-600">"Responder"</strong> para redactar una respuesta pública o privada.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
