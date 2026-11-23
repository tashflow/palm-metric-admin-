import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytesResumable,
} from 'firebase/storage';

import {
  BOOTSTRAPPED_ADMIN_EMAILS,
  isBootstrappedAdminEmail,
} from './adminAllowlist';

export { BOOTSTRAPPED_ADMIN_EMAILS, isBootstrappedAdminEmail };
export const FIRESTORE_MEDIA_PREFIX = 'firestore-media://';
export const FIRESTORE_STORAGE_PATH_PREFIX = 'firestore-media/';

const firebaseConfig = {
  apiKey: 'AIzaSyBmmyvlE3GKl8PVc1LHNBZOsl_MkqCWPlo',
  authDomain: 'palm-metric-app.firebaseapp.com',
  projectId: 'palm-metric-app',
  storageBucket: 'palm-metric-app.firebasestorage.app',
  messagingSenderId: '522581928710',
  appId: '1:522581928710:web:993ecee99d938707fc8c87',
  measurementId: 'G-2JWQ84KMLT',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
storage.maxUploadRetryTime = 8000;
storage.maxOperationRetryTime = 8000;

void isAnalyticsSupported()
  .then((supported) => {
    if (supported) getAnalytics(app);
  })
  .catch(() => {});

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export interface UploadResult {
  downloadUrl: string;
  storagePath: string;
}

export const resolvedMediaCache = new Map<string, string>();
const inFlightMediaResolutions = new Map<string, Promise<string>>();

function base64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to read media file from device.'));
    reader.readAsDataURL(file);
  });
}

export async function resolveMediaUrl(url?: string | null): Promise<string> {
  if (!url) return '';
  if (!url.startsWith(FIRESTORE_MEDIA_PREFIX)) return url;

  const cached = resolvedMediaCache.get(url);
  if (cached) return cached;

  const existingPromise = inFlightMediaResolutions.get(url);
  if (existingPromise) return existingPromise;

  const assetId = url.slice(FIRESTORE_MEDIA_PREFIX.length);
  const promise = (async () => {
    try {
      const metaSnap = await getDoc(doc(db, 'mediaAssets', assetId));
      if (!metaSnap.exists()) return '';
      const meta = metaSnap.data() as {
        mimeType?: string;
        chunkCount?: number;
        inlineData?: string;
      };
      const mimeType = meta.mimeType || 'application/octet-stream';

      let blob: Blob;
      if (meta.inlineData) {
        blob = new Blob([base64ToUint8Array(meta.inlineData)], { type: mimeType });
      } else if (meta.chunkCount && meta.chunkCount > 0) {
        const chunkSnaps = await Promise.all(
          Array.from({ length: meta.chunkCount }, (_, idx) =>
            getDoc(doc(db, 'mediaAssets', assetId, 'chunks', String(idx)))
          )
        );
        const parts: Uint8Array<ArrayBuffer>[] = [];
        for (const snap of chunkSnaps) {
          if (!snap.exists()) return '';
          const chunk = snap.data() as { data?: string };
          if (!chunk.data) return '';
          parts.push(base64ToUint8Array(chunk.data));
        }
        blob = new Blob(parts, { type: mimeType });
      } else {
        return '';
      }

      const objectUrl = URL.createObjectURL(blob);
      resolvedMediaCache.set(url, objectUrl);
      return objectUrl;
    } catch (error) {
      console.warn('Unable to resolve Firestore media asset:', assetId, error);
      return '';
    } finally {
      inFlightMediaResolutions.delete(url);
    }
  })();

  inFlightMediaResolutions.set(url, promise);
  return promise;
}

async function optimizeImageForUpload(file: File): Promise<File> {
  if (
    !file.type.startsWith('image/') ||
    file.type === 'image/gif' ||
    file.type === 'image/svg+xml' ||
    file.size <= 120 * 1024
  ) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const maxDimension = 1400;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const targetWidth = Math.max(1, Math.round(bitmap.width * scale));
    const targetHeight = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return file;
    }

    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    bitmap.close();

    const compressedBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', 0.82)
    );

    if (compressedBlob && compressedBlob.size > 0 && compressedBlob.size < file.size) {
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      return new File([compressedBlob], `${baseName}.webp`, { type: 'image/webp' });
    }
    return file;
  } catch {
    return file;
  }
}

let cachedStorageAvailable: boolean | null = null;

async function checkStorageBucketInitialized(): Promise<boolean> {
  if (cachedStorageAvailable !== null) return cachedStorageAvailable;
  const bucket = firebaseConfig.storageBucket;
  if (!bucket) {
    cachedStorageAvailable = false;
    return false;
  }
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(
      `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o?maxResults=1`,
      { method: 'GET', signal: controller.signal }
    );
    cachedStorageAvailable = res.status !== 404;
    return cachedStorageAvailable;
  } catch {
    cachedStorageAvailable = false;
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

async function uploadToFirestoreMedia(
  file: File,
  onProgress?: (percent: number) => void,
  lang: 'ar' | 'en' = 'ar'
): Promise<UploadResult> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error(
      lang === 'ar'
        ? 'يجب تسجيل الدخول أولاً قبل رفع الملفات.'
        : 'You must be signed in before uploading media.'
    );
  }

  const maxFirestoreBytes = 15 * 1024 * 1024;
  if (file.size > maxFirestoreBytes) {
    throw new Error(
      lang === 'ar'
        ? 'الحد الأقصى لحجم الفيديو في الخطة الحالية هو 15 ميجابايت. اختر ملفاً أصغر أو الصق رابطاً مباشراً.'
        : 'Maximum file size on the Starter plan is 15 MB. Please choose a smaller file or paste a direct URL.'
    );
  }

  onProgress?.(15);
  const base64 = await fileToBase64(file);
  const assetId = `asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const mimeType = file.type || 'application/octet-stream';
  const inlineLimit = 650000;
  const chunkSize = 600000;

  if (base64.length <= inlineLimit) {
    onProgress?.(55);
    const path = `mediaAssets/${assetId}`;
    try {
      await setDoc(doc(db, 'mediaAssets', assetId), {
        mimeType,
        totalBytes: file.size,
        chunkCount: 0,
        isPublic: true,
        inlineData: base64,
        createdBy: uid,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
    onProgress?.(100);
  } else {
    const chunks: string[] = [];
    for (let offset = 0; offset < base64.length; offset += chunkSize) {
      chunks.push(base64.slice(offset, offset + chunkSize));
    }
    if (chunks.length > 40) {
      throw new Error(
        lang === 'ar'
          ? 'الملف كبير جداً للحفظ المباشر. يرجى اختيار ملف أصغر.'
          : 'Media file exceeds the 40-chunk limit. Please choose a smaller file.'
      );
    }

    onProgress?.(25);
    const metaPath = `mediaAssets/${assetId}`;
    try {
      await setDoc(doc(db, 'mediaAssets', assetId), {
        mimeType,
        totalBytes: file.size,
        chunkCount: chunks.length,
        isPublic: true,
        createdBy: uid,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, metaPath);
    }

    const batchSize = 3;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const slice = chunks.slice(i, i + batchSize);
      await Promise.all(
        slice.map(async (chunkData, offsetIdx) => {
          const chunkIdx = i + offsetIdx;
          const chunkPath = `mediaAssets/${assetId}/chunks/${chunkIdx}`;
          try {
            await setDoc(doc(db, 'mediaAssets', assetId, 'chunks', String(chunkIdx)), {
              index: chunkIdx,
              data: chunkData,
              createdAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, chunkPath);
          }
        })
      );
      const completed = Math.min(chunks.length, i + slice.length);
      onProgress?.(25 + Math.round((completed / chunks.length) * 75));
    }
  }

  const downloadUrl = `${FIRESTORE_MEDIA_PREFIX}${assetId}`;
  const storagePath = `${FIRESTORE_STORAGE_PATH_PREFIX}${assetId}`;
  resolvedMediaCache.set(downloadUrl, URL.createObjectURL(file));

  return { downloadUrl, storagePath };
}

export async function uploadMediaFile(
  file: File,
  folder: 'menu-items' | 'billboards',
  onProgress?: (percent: number) => void,
  lang: 'ar' | 'en' = 'ar'
): Promise<UploadResult> {
  const fileToUpload = await optimizeImageForUpload(file);
  const bucketReady = await checkStorageBucketInitialized();

  if (!bucketReady) {
    return uploadToFirestoreMedia(fileToUpload, onProgress, lang);
  }

  return new Promise((resolve, reject) => {
    const safeName = fileToUpload.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${folder}/${Date.now()}_${safeName}`;
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, fileToUpload, {
      contentType: fileToUpload.type || undefined,
    });

    let settled = false;
    let lastBytes = -1;
    let stallTimer: number | null = null;

    const clearStallTimer = () => {
      if (stallTimer !== null) {
        window.clearTimeout(stallTimer);
        stallTimer = null;
      }
    };

    const resetStallTimer = (timeoutMs: number) => {
      clearStallTimer();
      stallTimer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        uploadTask.cancel();
        cachedStorageAvailable = false;
        void uploadToFirestoreMedia(fileToUpload, onProgress, lang).then(resolve).catch(reject);
      }, timeoutMs);
    };

    resetStallTimer(8000);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (snapshot.bytesTransferred > lastBytes) {
          lastBytes = snapshot.bytesTransferred;
          resetStallTimer(15000);
        }
        if (snapshot.totalBytes > 0 && onProgress) {
          const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          onProgress(percent);
        }
      },
      (error) => {
        clearStallTimer();
        if (settled) return;
        settled = true;
        if (
          error.code === 'storage/retry-limit-exceeded' ||
          error.code === 'storage/bucket-not-found' ||
          error.code === 'storage/unknown'
        ) {
          cachedStorageAvailable = false;
          void uploadToFirestoreMedia(fileToUpload, onProgress, lang).then(resolve).catch(reject);
          return;
        }
        if (error.code === 'storage/unauthorized') {
          reject(
            new Error(
              lang === 'ar'
                ? 'تم رفض الصلاحية في Firebase Storage. تأكد من قواعد Storage Rules.'
                : 'Firebase Storage permission denied. Check your Storage Rules.'
            )
          );
          return;
        }
        reject(
          new Error(
            error.message ||
              (lang === 'ar' ? 'فشل رفع الملف.' : 'Failed to upload media file.')
          )
        );
      },
      async () => {
        clearStallTimer();
        if (settled) return;
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          settled = true;
          resolve({ downloadUrl, storagePath });
        } catch (err) {
          settled = true;
          reject(
            err instanceof Error
              ? err
              : new Error(
                  lang === 'ar'
                    ? 'تم الرفع لكن تعذر جلب رابط التنزيل.'
                    : 'Upload finished, but failed to retrieve download URL.'
                )
          );
        }
      }
    );
  });
}

export async function deleteMediaFile(storagePath?: string | null): Promise<void> {
  if (!storagePath) return;

  if (storagePath.startsWith(FIRESTORE_STORAGE_PATH_PREFIX)) {
    const assetId = storagePath.slice(FIRESTORE_STORAGE_PATH_PREFIX.length);
    const cacheKey = `${FIRESTORE_MEDIA_PREFIX}${assetId}`;
    resolvedMediaCache.delete(cacheKey);
    try {
      const metaRef = doc(db, 'mediaAssets', assetId);
      const metaSnap = await getDoc(metaRef);
      if (metaSnap.exists()) {
        const meta = metaSnap.data() as { chunkCount?: number };
        if (meta.chunkCount && meta.chunkCount > 0) {
          await Promise.all(
            Array.from({ length: meta.chunkCount }, (_, idx) =>
              deleteDoc(doc(db, 'mediaAssets', assetId, 'chunks', String(idx)))
            )
          );
        }
        await deleteDoc(metaRef);
      }
    } catch (error) {
      console.warn('Firestore media cleanup warning:', error);
    }
    return;
  }

  try {
    const fileRef = ref(storage, storagePath);
    await deleteObject(fileRef);
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code !== 'storage/object-not-found') {
      console.warn('Storage cleanup warning:', error);
    }
  }
}
