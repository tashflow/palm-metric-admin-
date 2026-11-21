import React, { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { ShieldCheck, Trash2, UserPlus, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  BOOTSTRAPPED_ADMIN_EMAILS,
  OperationType,
  db,
  handleFirestoreError,
} from '../lib/firebase';

interface AdminRecord {
  uid: string;
  email: string;
  displayName: string;
}

interface AdminAccessModalProps {
  open: boolean;
  onClose: () => void;
}

const UID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

export function AdminAccessModal({ open, onClose }: AdminAccessModalProps) {
  const { lang, t } = useLanguage();
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [uidInput, setUidInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [removingUid, setRemovingUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const unsubscribe = onSnapshot(
      collection(db, 'admins'),
      (snapshot) => {
        const list: AdminRecord[] = snapshot.docs.map((d) => {
          const data = d.data() as { email?: string; displayName?: string };
          return {
            uid: d.id,
            email: data.email || '',
            displayName: data.displayName || '',
          };
        });
        setAdmins(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'admins');
      }
    );

    return () => unsubscribe();
  }, [open]);

  if (!open) return null;

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const uid = uidInput.trim();
    const email = emailInput.trim();
    const displayName = nameInput.trim();

    if (!UID_PATTERN.test(uid)) {
      setError(
        lang === 'ar'
          ? 'معرّف Firebase UID غير صالح (يجب أن يحتوي على أحرف أو أرقام أو _ أو - فقط).'
          : 'Invalid Firebase UID (letters, numbers, _ or - only, 1–128 chars).'
      );
      return;
    }
    if (email.length < 3 || email.length > 160 || !email.includes('@')) {
      setError(
        lang === 'ar'
          ? 'يرجى إدخال بريد إلكتروني صالح.'
          : 'Please enter a valid email address.'
      );
      return;
    }
    if (displayName.length < 1 || displayName.length > 80) {
      setError(
        lang === 'ar'
          ? 'يرجى إدخال اسم المدير (1–80 حرفاً).'
          : 'Please enter a display name (1–80 chars).'
      );
      return;
    }

    setSaving(true);
    const path = `admins/${uid}`;
    try {
      await setDoc(doc(db, 'admins', uid), {
        email,
        displayName,
        createdAt: serverTimestamp(),
      });
      setUidInput('');
      setEmailInput('');
      setNameInput('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : lang === 'ar'
          ? 'تعذر حفظ صلاحية المدير.'
          : 'Unable to save admin access.'
      );
      handleFirestoreError(err, OperationType.CREATE, path);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAdmin = async (uid: string) => {
    setError(null);
    setRemovingUid(uid);
    const path = `admins/${uid}`;
    try {
      await deleteDoc(doc(db, 'admins', uid));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : lang === 'ar'
          ? 'تعذر إزالة المدير.'
          : 'Unable to remove admin.'
      );
      handleFirestoreError(err, OperationType.DELETE, path);
    } finally {
      setRemovingUid(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#162019]/45 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-admins-title"
        className="bg-white border border-[#E1E5E0] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl"
      >
        <div className="px-6 py-4 border-b border-[#E1E5E0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#2C4435]" />
            <h2 id="manage-admins-title" className="font-display text-base font-semibold text-[#162019]">
              {t.manageAdmins}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6B786F] hover:bg-[#F5F6F4] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-xs text-[#4A584F] leading-relaxed">{t.manageAdminsDesc}</p>

          {/* Primary Bootstrapped Admins */}
          <div className="p-3 rounded-xl bg-[#F5F6F4] border border-[#E1E5E0] space-y-1.5">
            <p className="text-[11px] font-medium text-[#6B786F]">{t.primaryAdminLabel}</p>
            <div className="space-y-1">
              {BOOTSTRAPPED_ADMIN_EMAILS.map((email) => (
                <p key={email} className="text-xs font-medium font-mono text-[#162019]" dir="ltr">
                  {email}
                </p>
              ))}
            </div>
          </div>

          {/* Add Admin Form */}
          <form onSubmit={handleAddAdmin} className="space-y-3">
            {error && (
              <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B]">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#162019] mb-1">
                {t.adminUidLabel}
              </label>
              <input
                type="text"
                required
                dir="ltr"
                value={uidInput}
                onChange={(e) => setUidInput(e.target.value)}
                placeholder={t.adminUidPlaceholder}
                className="w-full px-3 py-2 rounded-xl border border-[#CBD4CD] text-xs font-mono text-[#162019] focus:outline-none focus:border-[#2C4435]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#162019] mb-1">
                  {t.adminEmailLabel}
                </label>
                <input
                  type="email"
                  required
                  dir="ltr"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="staff@palmmetric.com"
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD4CD] text-xs text-[#162019] focus:outline-none focus:border-[#2C4435]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#162019] mb-1">
                  {t.adminNameLabel}
                </label>
                <input
                  type="text"
                  required
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder={lang === 'ar' ? 'مدير الفرع' : 'Store Manager'}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD4CD] text-xs text-[#162019] focus:outline-none focus:border-[#2C4435]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#2C4435] hover:bg-[#223629] disabled:opacity-60 text-white text-xs font-medium cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{saving ? t.addingAdminBtn : t.addAdminBtn}</span>
            </button>
          </form>

          {/* Existing Additional Admins */}
          <div className="space-y-2 pt-2 border-t border-[#E1E5E0]">
            {admins.length === 0 ? (
              <p className="text-xs text-[#6B786F] text-center py-3">{t.noExtraAdmins}</p>
            ) : (
              admins.map((admin) => (
                <div
                  key={admin.uid}
                  className="p-3 rounded-xl border border-[#E1E5E0] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[#162019] truncate">
                      {admin.displayName}
                    </p>
                    <p dir="ltr" className="text-[11px] text-[#6B786F] truncate text-start">
                      {admin.email}
                    </p>
                    <p dir="ltr" className="text-[10px] font-mono text-[#89948C] truncate text-start">
                      {admin.uid}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={removingUid === admin.uid}
                    onClick={() => handleRemoveAdmin(admin.uid)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#FECACA] text-[#991B1B] hover:bg-[#FEF2F2] text-xs font-medium shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>{t.removeWord}</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
