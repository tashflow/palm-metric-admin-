import React, { useMemo, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  Film,
  Image as ImageIcon,
  Megaphone,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { ResolvedImage, ResolvedVideo } from './ResolvedMedia';
import {
  OperationType,
  db,
  deleteMediaFile,
  handleFirestoreError,
  uploadMediaFile,
} from '../lib/firebase';
import {
  BillboardAd,
  BillboardMediaType,
  VALIDATION_LIMITS,
} from '../types';

interface BillboardManagerViewProps {
  billboards: BillboardAd[];
  loading: boolean;
  createModalOpen: boolean;
  onCloseCreateModal: () => void;
  onOpenCreateModal: () => void;
}

export function BillboardManagerView({
  billboards,
  loading,
  createModalOpen,
  onCloseCreateModal,
  onOpenCreateModal,
}: BillboardManagerViewProps) {
  const { lang, t } = useLanguage();
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [title, setTitle] = useState('');
  const [mediaType, setMediaType] = useState<BillboardMediaType>('image');
  const [isActive, setIsActive] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [manualMediaUrl, setManualMediaUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingAd, setEditingAd] = useState<BillboardAd | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmDeleteAd, setConfirmDeleteAd] = useState<BillboardAd | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isModalOpen = createModalOpen || editingAd !== null;

  const filteredBillboards = useMemo(() => {
    return billboards.filter((ad) => {
      if (statusFilter === 'active') return ad.isActive;
      if (statusFilter === 'inactive') return !ad.isActive;
      return true;
    });
  }, [billboards, statusFilter]);

  const activeCount = useMemo(
    () => billboards.filter((ad) => ad.isActive).length,
    [billboards]
  );

  const openEditModal = (ad: BillboardAd) => {
    setEditingAd(ad);
    setTitle(ad.title);
    setMediaType(ad.mediaType);
    setIsActive(ad.isActive);
    setSelectedFile(null);
    setManualMediaUrl(ad.storagePath ? '' : ad.mediaUrl);
    setPreviewUrl(ad.mediaUrl);
    setUploadProgress(null);
    setFormError(null);
  };

  const resetForm = () => {
    setEditingAd(null);
    setTitle('');
    setMediaType('image');
    setIsActive(true);
    setSelectedFile(null);
    setManualMediaUrl('');
    setPreviewUrl('');
    setUploadProgress(null);
    setFormError(null);
    onCloseCreateModal();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (mediaType === 'image' && !file.type.startsWith('image/')) {
      setFormError(
        lang === 'ar'
          ? 'نوع الوسائط المحدد هو صورة. اختر ملف صورة أو بدّل نوع الوسائط إلى فيديو.'
          : 'Selected media type is Image. Choose an image file or switch Media Type to Video.'
      );
      return;
    }
    if (mediaType === 'video' && !file.type.startsWith('video/')) {
      setFormError(
        lang === 'ar'
          ? 'نوع الوسائط المحدد هو فيديو. اختر ملف فيديو (MP4/WebM) أو بدّل نوع الوسائط إلى صورة.'
          : 'Selected media type is Video. Choose a video file (MP4/WebM) or switch Media Type to Image.'
      );
      return;
    }
    if (mediaType === 'video' && file.size > 15 * 1024 * 1024) {
      setFormError(
        lang === 'ar'
          ? 'يجب أن يكون حجم الفيديو أقل من 15 ميجابايت.'
          : 'Video file size must be under 15 MB.'
      );
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setFormError(
        lang === 'ar'
          ? 'يجب أن يكون حجم الملف أقل من 50 ميجابايت.'
          : 'Media file size must be under 50 MB.'
      );
      return;
    }

    setFormError(null);
    setSelectedFile(file);
    setManualMediaUrl('');
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleCreateBillboard = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedTitle = title.trim();
    const trimmedManualUrl = manualMediaUrl.trim();
    if (!trimmedTitle || trimmedTitle.length > VALIDATION_LIMITS.billboard.titleMaxLength) {
      setFormError(
        lang === 'ar'
          ? `يجب أن يكون عنوان العرض بين 1 و ${VALIDATION_LIMITS.billboard.titleMaxLength} حرفاً.`
          : `Offer title must be 1–${VALIDATION_LIMITS.billboard.titleMaxLength} characters.`
      );
      return;
    }
    if (!selectedFile && !trimmedManualUrl && !(editingAd && editingAd.mediaUrl)) {
      setFormError(
        lang === 'ar'
          ? 'يرجى رفع صورة ملصق أو فيديو ترويجي من جهازك، أو لصق رابط مباشر.'
          : 'Please upload a poster image or promotional video from your device, or paste a direct URL.'
      );
      return;
    }
    if (trimmedManualUrl.length > VALIDATION_LIMITS.billboard.mediaUrlMaxLength) {
      setFormError(
        lang === 'ar'
          ? `يجب ألا يتجاوز الرابط ${VALIDATION_LIMITS.billboard.mediaUrlMaxLength} حرفاً.`
          : `Media URL cannot exceed ${VALIDATION_LIMITS.billboard.mediaUrlMaxLength} characters.`
      );
      return;
    }

    setSaving(true);
    try {
      let mediaUrl = trimmedManualUrl || editingAd?.mediaUrl || '';
      let storagePath = trimmedManualUrl ? '' : editingAd?.storagePath || '';
      const oldStoragePath = editingAd?.storagePath;

      if (selectedFile) {
        setUploadProgress(0);
        const uploaded = await uploadMediaFile(
          selectedFile,
          'billboards',
          (pct) => {
            setUploadProgress(pct);
          },
          lang
        );
        mediaUrl = uploaded.downloadUrl;
        storagePath = uploaded.storagePath;
      }

      if (editingAd) {
        const path = `billboards/${editingAd.id}`;
        try {
          await updateDoc(doc(db, 'billboards', editingAd.id), {
            title: trimmedTitle,
            mediaType,
            mediaUrl,
            storagePath,
            isActive,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }

        if (
          oldStoragePath &&
          oldStoragePath !== storagePath &&
          (selectedFile || trimmedManualUrl)
        ) {
          await deleteMediaFile(oldStoragePath);
        }
      } else {
        const path = 'billboards';
        try {
          await addDoc(collection(db, 'billboards'), {
            title: trimmedTitle,
            mediaType,
            mediaUrl,
            storagePath,
            isActive,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      }

      resetForm();
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : lang === 'ar'
          ? 'تعذر حفظ العرض الترويجي.'
          : 'Unable to save promotional offer.'
      );
    } finally {
      setSaving(false);
      setUploadProgress(null);
    }
  };

  const handleToggleActive = async (ad: BillboardAd) => {
    setTogglingId(ad.id);
    const path = `billboards/${ad.id}`;
    try {
      await updateDoc(doc(db, 'billboards', ad.id), {
        isActive: !ad.isActive,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!confirmDeleteAd) return;
    setDeleting(true);
    const target = confirmDeleteAd;
    const path = `billboards/${target.id}`;
    try {
      await deleteDoc(doc(db, 'billboards', target.id));
      await deleteMediaFile(target.storagePath);
      setConfirmDeleteAd(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Filter & Summary Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-white border border-[#E1E5E0] rounded-xl w-fit">
          {(
            [
              { id: 'all', label: `${t.all} (${billboards.length})` },
              { id: 'active', label: `${t.activeCountLabel} (${activeCount})` },
              { id: 'inactive', label: `${t.inactiveCountLabel} (${billboards.length - activeCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-[#E8EFEA] text-[#223629]'
                  : 'text-[#4A584F] hover:text-[#162019] hover:bg-[#F5F6F4]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <p className="text-xs text-[#6B786F]">
          {t.activeBillboardHint}
        </p>
      </div>

      {/* Billboards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((n) => (
            <div
              key={n}
              className="bg-white border border-[#E1E5E0] rounded-xl overflow-hidden animate-pulse"
            >
              <div className="aspect-video bg-[#E8EFEA]" />
              <div className="p-4 space-y-2">
                <div className="h-5 w-1/2 bg-[#E8EFEA] rounded" />
                <div className="h-4 w-1/3 bg-[#F5F6F4] rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredBillboards.length === 0 ? (
        <div className="bg-white border border-[#E1E5E0] rounded-xl p-10 text-center space-y-4">
          <div className="w-11 h-11 rounded-xl bg-[#E8EFEA] text-[#2C4435] flex items-center justify-center mx-auto">
            <Megaphone className="w-5 h-5" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="font-display text-base font-semibold text-[#162019]">
              {billboards.length === 0
                ? t.noBillboardsTitle
                : t.noMatchingBillboardsTitle}
            </h3>
            <p className="text-sm text-[#6B786F]">
              {t.noBillboardsDesc}
            </p>
          </div>
          {billboards.length === 0 && (
            <button
              type="button"
              onClick={onOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2C4435] hover:bg-[#223629] text-white text-xs font-medium transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.uploadFirstOffer}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredBillboards.map((ad) => (
            <article
              key={ad.id}
              className="bg-white border border-[#E1E5E0] rounded-xl overflow-hidden flex flex-col justify-between transition-colors hover:border-[#BFCAC2]"
            >
              <div>
                <div className="aspect-video bg-[#162019] relative overflow-hidden border-b border-[#E1E5E0]">
                  {ad.mediaType === 'video' ? (
                    <ResolvedVideo
                      src={ad.mediaUrl}
                      controls
                      muted
                      loop
                      playsInline
                      className={`w-full h-full object-cover ${
                        ad.isActive ? 'opacity-100' : 'opacity-50'
                      }`}
                    />
                  ) : (
                    <ResolvedImage
                      src={ad.mediaUrl}
                      alt={ad.title}
                      className={`w-full h-full object-cover ${
                        ad.isActive ? 'opacity-100' : 'opacity-55 grayscale'
                      }`}
                    />
                  )}
                </div>

                <div className="p-4 space-y-1.5">
                  <h3 className="font-display text-base font-semibold text-[#162019]">
                    {ad.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B786F]">
                    <span className="inline-flex items-center gap-1">
                      {ad.mediaType === 'video' ? (
                        <Film className="w-3.5 h-3.5" />
                      ) : (
                        <ImageIcon className="w-3.5 h-3.5" />
                      )}
                      {ad.mediaType === 'video' ? t.promoVideo : t.posterImage}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className={ad.isActive ? 'text-[#2C4435] font-medium' : 'text-[#6B786F]'}>
                      {ad.isActive ? t.activeOnStorefront : t.inactiveLabel}
                    </span>
                  </div>
                </div>
              </div>

              <div className="px-4 py-3 border-t border-[#E1E5E0] bg-[#F9FAF8] flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={togglingId === ad.id}
                  onClick={() => handleToggleActive(ad)}
                  className="inline-flex items-center gap-2.5 text-xs font-medium text-[#162019] cursor-pointer disabled:opacity-50"
                  aria-pressed={ad.isActive}
                >
                  <span
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors flex items-center ${
                      ad.isActive ? 'bg-[#2C4435]' : 'bg-[#C7CEC9]'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        ad.isActive ? 'translate-x-4 rtl:-translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </span>
                  <span>{ad.isActive ? t.activeCountLabel : t.inactiveCountLabel}</span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEditModal(ad)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#39463D] hover:bg-[#E8EFEA] hover:text-[#223629] transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>{t.edit}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteAd(ad)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#6B786F] hover:bg-[#FEF2F2] hover:text-[#991B1B] transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t.deleteWord}</span>
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Upload / Edit Billboard Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editingAd ? t.editOffer : t.uploadPromoOffer}
          className="fixed inset-0 z-50 bg-[#162019]/40 backdrop-blur-[2px] flex items-center justify-center p-4"
        >
          <div className="bg-white border border-[#E1E5E0] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-[#E1E5E0] flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-[#162019]">
                {editingAd ? t.editOffer : t.uploadPromoOffer}
              </h2>
              <button
                type="button"
                onClick={resetForm}
                aria-label={t.cancel}
                className="p-1.5 rounded-lg text-[#6B786F] hover:bg-[#F5F6F4] hover:text-[#162019] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBillboard} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B]">
                  {formError}
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="offer-title" className="block text-xs font-medium text-[#39463D]">
                  {t.offerTitleLabel}
                </label>
                <input
                  id="offer-title"
                  type="text"
                  required
                  maxLength={VALIDATION_LIMITS.billboard.titleMaxLength}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t.offerTitlePlaceholder}
                  className="w-full px-3 py-2 rounded-xl border border-[#E1E5E0] bg-white text-sm text-[#162019] focus:outline-none focus:border-[#2C4435]"
                />
              </div>

              <div className="space-y-1.5">
                <span className="block text-xs font-medium text-[#39463D]">{t.mediaTypeLabel}</span>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: 'image', label: t.posterImage, icon: ImageIcon },
                      { id: 'video', label: t.promoVideo, icon: Film },
                    ] as const
                  ).map((opt) => {
                    const Icon = opt.icon;
                    const active = mediaType === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setMediaType(opt.id);
                          setSelectedFile(null);
                          setManualMediaUrl('');
                          setPreviewUrl('');
                          setFormError(null);
                        }}
                        className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#E8EFEA] border-[#2C4435] text-[#223629]'
                            : 'bg-white border-[#E1E5E0] text-[#4A584F] hover:bg-[#F5F6F4]'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <span className="block text-xs font-medium text-[#39463D]">
                  {t.fileUploadLabel} ({mediaType === 'image' ? t.posterImage : t.promoVideo})
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={mediaType === 'image' ? 'image/*' : 'video/*'}
                  onChange={handleFileChange}
                  className="hidden"
                />

                {previewUrl ? (
                  <div className="rounded-xl border border-[#E1E5E0] overflow-hidden bg-[#162019] space-y-2">
                    <div className="aspect-video relative">
                      {mediaType === 'video' ? (
                        <video
                          src={previewUrl}
                          controls
                          muted
                          playsInline
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <img
                          src={previewUrl}
                          alt={t.offerTitleLabel}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="px-3 py-2 bg-[#F9FAF8] flex items-center justify-between text-xs">
                      <span className="text-[#39463D] truncate">{selectedFile?.name}</span>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[#2C4435] font-medium hover:underline shrink-0 ms-2 cursor-pointer"
                      >
                        {t.changeFile}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-8 px-4 rounded-xl border border-dashed border-[#B6C4BA] bg-[#F5F6F4] hover:bg-[#E8EFEA] transition-colors flex flex-col items-center justify-center gap-2 text-center cursor-pointer"
                  >
                    <Upload className="w-5 h-5 text-[#2C4435]" />
                    <span className="text-xs font-medium text-[#162019]">
                      {t.selectFileDevice}
                    </span>
                    <span className="text-xs text-[#6B786F]">
                      {mediaType === 'image' ? t.imageHint : t.videoHint}
                    </span>
                  </button>
                )}

                {uploadProgress !== null && (
                  <div className="pt-1 space-y-1">
                    <div className="flex justify-between text-xs text-[#2C4435] tabular-nums">
                      <span>{t.uploadingStorage}</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#E8EFEA] overflow-hidden">
                      <div
                        className="h-full bg-[#2C4435] transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="pt-1 space-y-1">
                  <label htmlFor="billboard-media-url" className="block text-xs font-medium text-[#39463D]">
                    {t.orMediaUrlLabel}
                  </label>
                  <input
                    id="billboard-media-url"
                    type="url"
                    dir="ltr"
                    maxLength={VALIDATION_LIMITS.billboard.mediaUrlMaxLength}
                    value={manualMediaUrl}
                    onChange={(e) => {
                      const val = e.target.value;
                      setManualMediaUrl(val);
                      if (selectedFile) {
                        setSelectedFile(null);
                      }
                      setPreviewUrl(val.trim());
                    }}
                    placeholder={t.orMediaUrlPlaceholder}
                    className="w-full px-3 py-2 rounded-xl border border-[#E1E5E0] bg-white text-xs text-[#162019] focus:outline-none focus:border-[#2C4435]"
                  />
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setIsActive((v) => !v)}
                  className="inline-flex items-center gap-3 text-sm font-medium text-[#162019] cursor-pointer"
                >
                  <span
                    className={`w-10 h-6 rounded-full p-0.5 transition-colors flex items-center ${
                      isActive ? 'bg-[#2C4435]' : 'bg-[#C7CEC9]'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        isActive ? 'translate-x-4 rtl:-translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </span>
                  <span>{isActive ? t.publishImmediately : t.saveAsDraft}</span>
                </button>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-[#E1E5E0]">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 rounded-xl border border-[#E1E5E0] text-xs font-medium text-[#4A584F] hover:bg-[#F5F6F4] cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-[#2C4435] hover:bg-[#223629] disabled:opacity-60 text-white text-xs font-medium transition-colors cursor-pointer"
                >
                  {saving
                    ? t.uploading
                    : editingAd
                    ? t.saveOfferChanges
                    : t.publishOffer}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteAd && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.deleteOfferTitle}
          className="fixed inset-0 z-50 bg-[#162019]/40 backdrop-blur-[2px] flex items-center justify-center p-4"
        >
          <div className="bg-white border border-[#E1E5E0] rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-display text-base font-semibold text-[#162019]">
              {lang === 'ar'
                ? `حذف "${confirmDeleteAd.title}"؟`
                : `Delete "${confirmDeleteAd.title}"?`}
            </h3>
            <p className="text-sm text-[#4A584F]">
              {t.deleteOfferBody}
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDeleteAd(null)}
                className="px-4 py-2 rounded-xl border border-[#E1E5E0] text-xs font-medium text-[#4A584F] hover:bg-[#F5F6F4] cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteConfirmed}
                className="px-4 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-60 text-white text-xs font-medium cursor-pointer"
              >
                {deleting ? t.deleting : t.deleteOfferAction}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
