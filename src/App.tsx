import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import dayjs from 'dayjs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { VisualPortionPicker } from './VisualPortionPicker';
import { generateShareImage } from './services/generateShareImage';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

// 🟢 新增：引入掃描器元件與型別
import BarcodeScanner from './components/BarcodeScanner';
import { ScannedFood } from './services/foodApi';
import { analyzeImage } from './services/aiService';

import femalePng from './assets/female.png';
import malePng from './assets/male.png';

import logoV1 from './assets/logo_v1.png';


// 🟢 新增：匯入手掌法圖片
import palmImg from './assets/palm.png';
import fistImg from './assets/fist.png';
import thumbImg from './assets/thumb.png';
import milkImg from './assets/milk.png';


// 🖐️ 手掌法圖示（與 VisualPortionPicker 共用的 6 張 img）
import proteinImg from './assets/protein.png';
import veggieImg from './assets/veggie.png';
import grainsImg from './assets/grains.png';
import fruitImg from './assets/fruit.png';
import fatImg from './assets/fat.png';
import dairyImg from './assets/dairy.png';

// 🆕 新增：運動強度圖示
import lowIntensityImg from './assets/low_intensity.png';
import mediumIntensityImg from './assets/medium_intensity.png';
import highIntensityImg from './assets/high_intensity.png';

// 🆕 新增:掃描按鈕圖示
import barcodeIcon from './assets/barcode.png';
import nutritionIcon from './assets/nutrition.png';

interface UserSubscription {
  userId: string;
  type: 'free' | 'monthly' | 'yearly' | 'founder';
  aiCredits: number;
  aiCreditsResetDate: string;
  founderTier?: 'super-early-bird' | 'early-bird' | 'founder'; // 創始會員階段
  founderCode?: string; // 創始會員兌換碼（例如：FOUNDER-A7K2-001）
  referralCode?: string; // 親友推薦碼（例如：REF001）
}

// 產生唯一用戶 ID
function generateUserId(): string {
  let userId = localStorage.getItem('JU_USER_ID');
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('JU_USER_ID', userId);
  }
  return userId;
}

// 取得訂閱狀態
function getSubscription(): UserSubscription {
  const userId = generateUserId();
  const savedSub = localStorage.getItem('JU_SUBSCRIPTION');

  if (savedSub) {
    return JSON.parse(savedSub);
  }

  // 預設為免費版
  const defaultSub: UserSubscription = {
    userId,
    type: 'free',
    aiCredits: 0,
    aiCreditsResetDate: '',
  };

  localStorage.setItem('JU_SUBSCRIPTION', JSON.stringify(defaultSub));
  return defaultSub;
}

// 更新訂閱狀態
function updateSubscription(updates: Partial<UserSubscription>) {
  const current = getSubscription();
  const updated = { ...current, ...updates };
  localStorage.setItem('JU_SUBSCRIPTION', JSON.stringify(updated));
}

// 呼叫 Worker API
async function callWorkerAPI(
  imageBase64: string,
  mode: 'nutrition' | 'label' = 'nutrition'
): Promise<any> {
  const subscription = getSubscription();

  // 🆕 生成裝置指紋
function generateDeviceFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillText('jusmile', 0, 0);
    }
    
    const components = [
      navigator.userAgent,
      navigator.language,
      `${screen.width}x${screen.height}`,
      String(new Date().getTimezoneOffset()),
      canvas.toDataURL(),
      String(navigator.hardwareConcurrency || 'unknown'),
      navigator.platform,
    ];
    
    const fingerprint = components.join('|');
    
    // 簡單的 hash（用 btoa）
    const hash = btoa(fingerprint).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
    
    return hash;
  } catch (error) {
    console.error('生成裝置指紋失敗:', error);
    return `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 🆕 取得裝置資訊
function getDeviceInfo() {
  const platform = Capacitor.getPlatform();
  const ua = navigator.userAgent;
  
  let browser = 'Unknown';
  if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  
  return {
    platform,
    browser,
    os: navigator.platform,
  };
}

  const WORKER_URL = 'https://api.jusmilespace.com';

  try {
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64: imageBase64.replace(/^data:image\/\w+;base64,/, ''), // 移除 data:image 前綴
        userId: subscription.userId,
        subscriptionType: subscription.type,
        mode,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      // 額度用完
      if (response.status === 429) {
        return {
          error: 'quota_exceeded',
          message: data.error || '額度已用完',
          remaining: 0,
        };
      }

      throw new Error(data.error || 'API 呼叫失敗');
    }

    // 更新本地訂閱狀態（同步剩餘額度）
    updateSubscription({
      aiCredits: data.remaining,
      aiCreditsResetDate: data.resetDate,
    });

    return {
      success: true,
      result: data.result,
      remaining: data.remaining,
    };

  } catch (error) {
    console.error('❌ Worker API Error:', error);
    throw error;
  }
}

const ICON_MAP: { [key: string]: string } = {
  protein: proteinImg,
  veggie: veggieImg,
  grains: grainsImg,
  fruit: fruitImg,
  fat: fatImg,
  dairy: dairyImg,
};


// 🆕 ===== Toast 動畫樣式（加在這裡）=====
// 使用 useEffect 確保在元件掛載後注入樣式
const ToastStyles: React.FC = () => {
  useEffect(() => {
    const styleId = 'toast-animations-styles';

    // 避免重複加入
    if (document.getElementById(styleId)) {
      return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(400px);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);

    console.log('✅ Toast 動畫樣式已加入');
  }, []);

  return null;
};



// ======== 型別定義 ========
// 🆕 通用數字鍵盤 (NumberPadModal)
type NumberPadModalProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  value: string;
  onChange: (val: string) => void; // 這裡接收字串，方便處理小數點
  unit?: string;
  allowDecimal?: boolean;
  onConfirm?: () => void;
};
const NumberPadModal: React.FC<NumberPadModalProps> = ({
  visible,
  onClose,
  title,
  value,
  onChange,
  unit = '',
  allowDecimal = true,
  onConfirm,
}) => {
  if (!visible) return null;

  const handleNumClick = (num: number | string) => {
    if (num === '.') {
      if (allowDecimal && !value.includes('.')) {
        onChange(value + '.');
      }
    } else {
      onChange((value === '0' || value === '') ? String(num) : value + num);
    }
  };

  const handleBackspace = () => {
    onChange(value.slice(0, -1));
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.0)',
        zIndex: 200,
        pointerEvents: 'auto'
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'absolute',
          bottom: 'calc(70px + env(safe-area-inset-bottom))',
          left: 0,
          right: 0,
          maxWidth: 420,
          margin: '0 auto',
          background: '#f0f2f5',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: '24px 20px 24px 20px',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
          animation: 'slideInUp 0.2s ease-out',
          pointerEvents: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' }}>
          {/* 🟢 移除 X，只留標題 */}
          <span style={{ fontSize: 16, fontWeight: 600, color: '#666' }}>{title}</span>

          <div style={{ fontSize: 28, fontWeight: 700, color: '#1f2937' }}>
            {value || '0'} <span style={{ fontSize: 16, fontWeight: 500, color: '#888' }}>{unit}</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0].map((num) => (
            <button
              key={num}
              onClick={() => handleNumClick(num)}
              disabled={num === '.' && !allowDecimal}
              style={{
                padding: '16px 0', borderRadius: 16, border: 'none',
                background: '#fff', fontSize: 24, fontWeight: 600, color: '#333',
                boxShadow: '0 2px 0 #e5e7eb', cursor: 'pointer',
                opacity: (num === '.' && !allowDecimal) ? 0.3 : 1
              }}
            >
              {num}
            </button>
          ))}
          <button
            onClick={handleBackspace}
            style={{
              padding: '16px 0', borderRadius: 16, border: 'none',
              background: '#e5e7eb', fontSize: 22, color: '#333',
              boxShadow: '0 2px 0 #d1d5db', cursor: 'pointer'
            }}
          >
            ⌫
          </button>
        </div>

        <button
          onClick={() => {
            if (onConfirm) onConfirm(); // 先存檔
            onClose();      // 再關閉
          }}
          style={{
            width: '100%', marginTop: 16, padding: '16px 0', borderRadius: 16, border: 'none',
            background: 'var(--mint-dark, #5c9c84)', color: '#fff', fontSize: 18, fontWeight: 700,
            cursor: 'pointer', boxShadow: '0 4px 12px rgba(92, 156, 132, 0.3)'
          }}
        >
          完成
        </button>
      </div>
    </div>
  );
};

type TypeRow = {
  Type: string;
  kcal: string | number;
  'protein (g)': string | number;
  'carb (g)': string | number;
  'fat (g)': string | number;
  'Weight per serving (g)': string | number;
  note?: string;
};

type UnitMapRow = {
  Food: string;
  Unit: string;
  ServingsPerUnit: string | number;
  Type: string;
  Notes?: string;
  'Weight per serving (g)'?: string | number;
  Kcal_per_serv?: string | number;
  'Prot_per_serv (g)'?: string | number;
  'Carb_per_serv (g)'?: string | number;
  'Fat_per_serv (g)'?: string | number;
  Source?: string;
};

type FoodDbRow = {
  food: string;
  unit: string;
  kcal: string | number;
  'protein (g)': string | number;
  'carb (g)': string | number;
  'fat (g)': string | number;
  source?: string;
};

type ExerciseMetRow = {
  intensity: string;
  活動: string;
  MET: string | number;
};

type DaySummary = {
  date: string;
  weight?: number;
  bodyFat?: number;
  visceralFat?: number;
  skeletalMuscle?: number; // 🆕 骨骼肌率
  waterMl: number;
  /** 當日的目標攝取熱量（kcal），只影響這一天，不會改到其他日期 */
  calorieGoalKcal?: number;
};


type MealEntry = {
  id: string;
  date: string;
  mealType: '早餐' | '午餐' | '晚餐' | '點心';
  label: string;
  kcal: number;
  protein?: number;
  carb?: number;
  fat?: number;
  /** 顯示用份量，例如 "1 碗"、"80 g" */
  amountText?: string;
  counts?: { [key: string]: number };
};

type ExerciseEntry = {
  id: string;
  date: string;
  name: string;
  kcal: number;
  minutes?: number;
};

type Settings = {
  targetWeight?: number;
  calorieGoal?: number;
  proteinGoal?: number;
  waterGoalMl?: number;
  bodyFatGoal?: number;
  visceralFatGoal?: number;
  skeletalMuscleGoal?: number; // 🆕 骨骼肌率目標
  exerciseMinutesGoal?: number;
  startDate?: string;
  targetDate?: string;
};
// 🆕 新增：運動表單的暫存狀態 (為了解決 Toast 重整導致資料消失的問題)
type ExerciseFormState = {
  mode: 'quick' | 'detail';
  quickExercise: { name: string; met: number } | null;
  name: string;
  minutes: string;
  weight: string;
  customMet: string;
  metRow: ExerciseMetRow | null;
  editId: string | null;
};

type Tab = 'today' | 'records' | 'settings' | 'plan' | 'trends' | 'about';
type RecordSubTab = 'food' | 'exercise';

// 🆕 新增：常用組合結構
type ComboItem = {
  // 紀錄當時的名稱，可能來自 Food Name 欄位或 Type Name
  label: string;
  // 記錄當時計算出的營養素
  kcal: number;
  protein?: number;
  carb?: number;
  fat?: number;
  amountText?: string;
  counts?: { [key: string]: number };
};

type MealCombo = {
  id: string;
  name: string;
  items: ComboItem[];
};





function renderPalmAmountText(amountText?: string, counts?: { [key: string]: number }): React.ReactNode {
  if (!amountText) return null;

  // 如果有 counts 資料，就用類別 ID 來顯示圖案
  if (counts) {
    const segments: React.ReactNode[] = [];
    Object.entries(counts).forEach(([typeId, count]) => {
      if (count > 0) {
        const cfg = ICON_MAP[typeId];  // 👈 改用 ICON_MAP（已經存在的）
        if (cfg) {
          segments.push(
            <span
              key={typeId}
              style={{ display: 'inline-flex', alignItems: 'center', marginRight: 8 }}
            >
              <img
                src={cfg}
                alt={typeId}
                style={{
                  width: 24,
                  height: 24,
                  marginRight: 4,
                  objectFit: 'contain',
                }}
              />
              <span>×{count}</span>
            </span>
          );
        }
      }
    });

    if (segments.length > 0) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
          {segments}
        </span>
      );
    }
  }

  return amountText;
}
type ToastType = 'success' | 'error' | 'warning' | 'info';


// ======== 常數 & 工具 ========
// After：新增一個小工具函式（放在 component 外面或前面就好）
function sanitizeCsvSrc(saved: string | null, fallback: string): string {
  if (!saved) return fallback;
  // 如果舊設定裡含有 "ju-smile-calorie-app"，視為無效，改用預設
  if (saved.includes('ju-smile-calorie-app')) return fallback;
  return saved;
}

// 可客製字體大小的下拉，且互斥展開（選了值/打開時會關閉其他）
type BigOption = { value: string; label: string };
// App.tsx 約 55 行附近，替換整個 BigSelect 元件的定義

const BigSelect: React.FC<{
  options: BigOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  width?: number | string;
}> = ({ options, value, onChange, placeholder, width }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const idRef = useRef<string>(Math.random().toString(36).slice(2));

  // 點擊元件外部收合的邏輯 (保留)
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  // 互斥開啟/收合的邏輯 (優化，讓它能接受任何非自身 ID 的廣播來關閉)
  useEffect(() => {
    function onAnyOpen(ev: Event) {
      const detail = (ev as CustomEvent<any>).detail;
      // 如果收到的 ID 不是自己，就關閉
      if (detail !== idRef.current) setOpen(false);
    }
    document.addEventListener('bigselect:open', onAnyOpen as EventListener);
    return () =>
      document.removeEventListener('bigselect:open', onAnyOpen as EventListener);
  }, []);

  const current = options.find((o) => o.value === value);

  return (
    <div ref={rootRef} style={{ position: 'relative', width: width ?? '100%' }}>
      <button
        type="button"
        className="big-select-btn"
        onClick={() => {
          // 在打開前，先廣播自己的 ID，讓其他元件關閉
          if (!open) {
            document.dispatchEvent(
              new CustomEvent('bigselect:open', { detail: idRef.current })
            );
          }
          setOpen((o) => !o);
        }}
      >
        {current ? current.label : (placeholder ?? '請選擇')}
        <span style={{ float: 'right' }}>▾</span>
      </button>

      {open ? (
        <div>
          {options.map((opt) => (
            <div
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setTimeout(() => {
                  setOpen(false);
                }, 0);
              }}
              style={{
                padding: '12px 14px',
                fontSize: 20,
                cursor: 'pointer',
                background: opt.value === value ? '#eef6ff' : '#fff',
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

const STORAGE_KEYS = {
  SETTINGS: 'JU_SETTINGS',
  DAYS: 'JU_DAYS',
  MEALS: 'JU_MEALS',
  EXERCISES: 'JU_EXERCISES',
  // 🆕 新增：常用組合的儲存 Key
  COMBOS: 'JU_COMBOS',
  SRC_TYPE: 'JU_SRC_TYPE',
  SRC_UNIT: 'JU_SRC_UNIT',
  SRC_FOOD: 'JU_SRC_FOOD',
  SRC_MET: 'JU_SRC_MET',
} as const;

const CSV_DEFAULT_URLS = {
  TYPE_TABLE: 'data/Type_Table.csv',
  UNIT_MAP: 'data/Unit_Map.csv',
  FOOD_DB: 'data/Food_DB.csv',
  EXERCISE_MET: 'data/Exercise_Met.csv',
} as const;

// 🔹 App 版本（之後要改版本號可以只改這裡）
const APP_VERSION = '1.0.3';

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJSON<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function round1(v: number | undefined | null): number {
  if (v == null || isNaN(Number(v))) return 0;
  return Math.round(Number(v) * 10) / 10;
}

function uuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function normalizeText(v: unknown): string {
  if (v == null) return '';
  return String(v).trim().toLowerCase();
}

// 用 Vite 提供的 BASE_URL，確保 dev / build / GitHub Pages 一致
// 例如：
// - 本機 dev + base 設定為 /ju-smile-app/ 時：  import.meta.env.BASE_URL === '/ju-smile-app/'
// - GitHub Pages：                           同樣是 '/ju-smile-app/'
const APP_BASE_URL = import.meta.env.BASE_URL || '/';

// 🟢 新增：將檔案轉為 Base64 DataURL
function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 把呼叫傳進來的字串，轉成真正要拿去 fetch 的 URL
function resolveCsvUrl(input: string): string {
  // 已經是 http / https 完整網址，就原樣用
  if (input.startsWith('http://') || input.startsWith('https://')) {
    return input;
  }

  // 這裡處理像 "data/Food_DB.csv" 或 "/data/Food_DB.csv" 這種
  // 1. 去掉 base 尾部斜線
  const base = APP_BASE_URL.endsWith('/')
    ? APP_BASE_URL.slice(0, -1)
    : APP_BASE_URL;
  // 2. 去掉 input 開頭斜線
  const cleanInput = input.startsWith('/') ? input.slice(1) : input;

  // 3. 組合結果：/ju-smile-app/ + data/Food_DB.csv
  // 結果會是： /ju-smile-app/data/Food_DB.csv (正確！)
  return `${base}/${cleanInput}`;
}



async function fetchCsv<T = any>(url: string): Promise<T[]> {
  const finalUrl = resolveCsvUrl(url);

  // 💡 加上時間戳記，強迫瀏覽器認為這是全新的請求，無視快取
  const cacheBusterUrl = `${finalUrl}?t=${new Date().getTime()}`;

  try {
    const res = await fetch(cacheBusterUrl, {
      cache: 'no-store', // 強制不存快取
      headers: {
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache'
      }
    });

    if (!res.ok) {
      throw new Error(`無法下載: ${finalUrl} (HTTP ${res.status})`);
    }

    const text = await res.text();
    const parsed = Papa.parse<T>(text, {
      header: true,
      skipEmptyLines: true,
    });

    if (parsed.errors.length) {
      console.warn('CSV parse errors for', finalUrl, parsed.errors);
    }

    return parsed.data;
  } catch (err) {
    console.error('fetchCsv 失敗，URL =', finalUrl, err);
    throw err; // 讓上層 decide 要不要顯示「同步失敗」之類訊息
  }
}

const InstallGuideWidget: React.FC = () => {
  const [open, setOpen] = useState(false); // 教學 Modal 是否開啟
  const [showHint, setShowHint] = useState(false); // 底部提醒 bar
  const [platformTab, setPlatformTab] = useState<'ios' | 'android' | 'desktop'>('ios');

  useEffect(() => {
    // 已安裝的情況，就不用顯示提示 bar
    let standalone = false;
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      standalone = true;
    }
    if ((window.navigator as any).standalone) {
      standalone = true; // iOS Safari PWA
    }
    if (standalone) return;

    // 如果使用者勾過「不再顯示」，就不要再出現提醒 bar
    const dismissed = localStorage.getItem('JU_INSTALL_HINT_DISMISSED');
    if (dismissed === '1') return;

    // 根據 userAgent 粗略選一個預設平台 tab
    const ua = window.navigator.userAgent.toLowerCase();
    if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) {
      setPlatformTab('ios');
    } else if (ua.includes('android')) {
      setPlatformTab('android');
    } else {
      setPlatformTab('desktop');
    }

    setShowHint(true);
  }, []);

  function openModal() {
    setOpen(true);
    setShowHint(false);
  }

  function handleNeverShow() {
    localStorage.setItem('JU_INSTALL_HINT_DISMISSED', '1');
    setShowHint(false);
  }

  return (
    <>
      {/* 設定頁中的卡片 */}


      <section className="card">
        <h2>安裝到手機主畫面</h2>
        <div className="form-section">
          <p style={{ marginBottom: 8 }}>
            將 Ju Smile App 加到主畫面，就能像一般 App 一樣從桌面開啟。
          </p>
          <button
            type="button"
            className="secondary"
            onClick={openModal}
            style={{ borderRadius: 999, padding: '8px 16px', cursor: 'pointer' }}
          >
            查看安裝教學
          </button>
        </div>
      </section>

      {/* 第一次開啟時的小提醒 bar */}
      {showHint && (
        <div className="install-prompt-toast">
          <div className="install-content">
            {/* 加個小圖示更生動 */}
            <span className="install-icon">📲</span>
            <div className="install-text">
              <div className="install-title">安裝小撇步</div>
              <div className="install-desc">加到手機主畫面，使用更流暢！</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              type="button"
              onClick={openModal}
              className="install-btn"
            >
              看教學
            </button>

            {/* 將「不再顯示」改成一個簡單的 X 關閉按鈕，節省空間且更美觀 */}
            <button
              type="button"
              onClick={handleNeverShow}
              className="install-close"
              aria-label="不再顯示"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 安裝教學 Modal */}
      {open && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 40,
            padding: '20px 0',
          }}
        >
          <div
            className="modal"
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 16,
              maxWidth: 420,
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>安裝到主畫面教學</h3>

            {/* 平台切換按鈕 */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => setPlatformTab('ios')}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  borderRadius: 999,
                  border: '1px solid var(--line)',
                  background: platformTab === 'ios' ? 'var(--accent, #eee)' : '#fff',
                  cursor: 'pointer',
                }}
              >
                iPhone / iPad
              </button>
              <button
                type="button"
                onClick={() => setPlatformTab('android')}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  borderRadius: 999,
                  border: '1px solid var(--line)',
                  background: platformTab === 'android' ? 'var(--accent, #eee)' : '#fff',
                  cursor: 'pointer',
                }}
              >
                Android
              </button>
              <button
                type="button"
                onClick={() => setPlatformTab('desktop')}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  borderRadius: 999,
                  border: '1px solid var(--line)',
                  background: platformTab === 'desktop' ? 'var(--accent, #eee)' : '#fff',
                  cursor: 'pointer',
                }}
              >
                電腦瀏覽器
              </button>
            </div>

            {platformTab === 'ios' && (
              <div>
                <p>使用 Safari 開啟本頁：</p>
                <ol style={{ paddingLeft: 20, margin: 0 }}>
                  <li>點畫面下方中間的「分享」按鈕（⏫ 的圖示）。</li>
                  <li>在選單中往下滑，找到並點選「加入主畫面」。</li>
                  <li>確認名稱為「Ju Smile App」，再點右上角「加入」。</li>
                  <li>之後就可以從主畫面像一般 App 一樣開啟。</li>
                </ol>
              </div>
            )}

            {platformTab === 'android' && (
              <div>
                <p>使用 Chrome 開啟本頁：</p>
                <ol style={{ paddingLeft: 20, margin: 0 }}>
                  <li>點畫面右上角「⋮」選單。</li>
                  <li>
                    點選「安裝 App」或「加到主畫面」（不同手機可能顯示文字略有差異）。
                  </li>
                  <li>如有需要可以修改名稱，然後按「新增」或「安裝」。</li>
                  <li>主畫面會出現 Ju Smile App 圖示，之後可直接點開。</li>
                </ol>
              </div>
            )}

            {platformTab === 'desktop' && (
              <div>
                <p>在電腦瀏覽器（Chrome / Edge）：</p>
                <ol style={{ paddingLeft: 20, margin: 0 }}>
                  <li>在網址列右側尋找「安裝」或「+」圖示。</li>
                  <li>點擊後選擇「安裝」或「安裝應用程式」。</li>
                  <li>安裝後，可以在桌面或開始選單找到 Ju Smile App。</li>
                </ol>
              </div>
            )}

            <div
              className="btn-row"
              style={{
                marginTop: 16,
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
              }}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  borderRadius: 999,
                  padding: '6px 12px',
                  border: '1px solid var(--line)',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};


const AboutPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  return (
    <div className="page page-settings" style={{ paddingBottom: '90px' }}>
      <section className="card">
        <div className="form-section" style={{ lineHeight: 1.6 }}>
          <h2>關於 Ju Smile App</h2>
          <p>
            Ju Smile App 是一個幫助你記錄體重、飲食與運動的個人熱量管理工具，
            讓你更有意識地照顧自己的身體狀態與日常習慣。
          </p>
        </div>
      </section>

      <section className="card">
        <div className="form-section" style={{ lineHeight: 1.6 }}>
          <h2>資料儲存與隱私</h2>
          <ul style={{ paddingLeft: 20, marginBottom: 0 }}>
            <li>所有紀錄（體重、飲食、運動…）都只儲存在你目前使用裝置的瀏覽器本機。</li>
            <li>不會自動上傳到任何伺服器或雲端，也不會與其他裝置同步。</li>
            <li>清除瀏覽器資料、重灌或換裝置時，紀錄都有可能一併被刪除。</li>
          </ul>
        </div>
      </section>

      <section className="card">
        <div className="form-section" style={{ lineHeight: 1.6 }}>
          <h2>建議操作：定期備份（匯出 JSON）</h2>
          <ol style={{ paddingLeft: 20, marginBottom: 0 }}>
            <li>在 App 中點選「匯出 JSON」。</li>
            <li>會下載一個 <code>.json</code> 檔案（內含體重、飲食、運動紀錄）。</li>
            <li>建議存到雲端硬碟、寄到自己 Email，或放在平常會備份的資料夾。</li>
          </ol>
        </div>
      </section>

      <section className="card">
        <div className="form-section" style={{ lineHeight: 1.6 }}>
          <h2>還原紀錄：匯入 JSON</h2>
          <ol style={{ paddingLeft: 20, marginBottom: 0 }}>
            <li>在新裝置上打開 Ju Smile App。</li>
            <li>點選「匯入 JSON」。</li>
            <li>選擇之前備份的 <code>.json</code> 檔案，即可還原紀錄。</li>
          </ol>
        </div>
      </section>

      <section className="card">
        <div className="form-section" style={{ lineHeight: 1.6 }}>
          <h2>精準資料同步（進階功能）</h2>
          <p>
            如果你有自行更新以下 CSV 檔案：
            Type Table / Unit Map / Food DB / Exercise MET，
            請在設定頁更新網址後按一次「同步精準資料」，讓 App 重新載入最新版內容。
          </p>
          <p style={{ fontSize: 'var(--font-xs)', color: '#666', marginBottom: 0 }}>
            一般使用者如果沒有自己改 CSV，可以忽略「同步精準資料」，照平常使用即可。
          </p>
        </div>
      </section>
      <section className="card">
  <div className="form-section" style={{ lineHeight: 1.6 }}>
    <h2>❓ 常見問題</h2>
    
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontWeight: 'bold', marginBottom: 8, color: '#1f2937' }}>
        Q: 如何購買創始會員？
      </p>
      <p style={{ marginBottom: 0, paddingLeft: 16, color: '#6b7280' }}>
        A: 請前往官網 <strong style={{ color: '#5c9c84' }}>jusmilespace.com</strong> 查看方案，
        購買後將收到兌換碼 Email，即可在 App 內「我的」→「訂閱與升級」中輸入兌換碼完成升級。
      </p>
    </div>

    <div style={{ marginBottom: 16 }}>
      <p style={{ fontWeight: 'bold', marginBottom: 8, color: '#1f2937' }}>
        Q: 創始會員有哪些權益？
      </p>
      <ul style={{ paddingLeft: 32, marginBottom: 0, color: '#6b7280' }}>
        <li>3,600 次終身智能輔助額度</li>
        <li>專屬創始會員編號</li>
        <li>獨家禮物與 VIP 折扣權益</li>
        <li>未來新功能搶先體驗</li>
      </ul>
    </div>

    <div>
      <p style={{ fontWeight: 'bold', marginBottom: 8, color: '#1f2937' }}>
        Q: 如何使用兌換碼？
      </p>
      <ol style={{ paddingLeft: 32, marginBottom: 0, color: '#6b7280' }}>
        <li>進入「🦋 我的」頁面</li>
        <li>找到「💎 訂閱與升級」區塊</li>
        <li>在「🎁 有兌換碼？」欄位輸入兌換碼</li>
        <li>點擊「兌換」按鈕即可完成升級</li>
      </ol>
    </div>
  </div>
</section>

      <section className="card">
        <div className="form-section" style={{ lineHeight: 1.6 }}>
          <h2>版本資訊</h2>
          <p style={{ marginBottom: 4 }}>
            目前版本：<b>Ju Smile App v{APP_VERSION}</b>
          </p>
          <ul style={{ paddingLeft: 20, marginBottom: 0, fontSize: 'var(--font-xs)' }}>
            <li>v1.0.3：修正更新提示被導航列擋住的問題，提升介面穩定性。</li>
            <li>v1.0.2：修正上架語言設定為繁中。</li>
            <li>v1.0.1：初始版本，提供體重 / 飲食 / 運動紀錄與 JSON 匯出 / 匯入功能。</li>
            {/* 未來可以在這裡往下加 v0.1.1, v0.2.0 ... */}
          </ul>
        </div>
      </section>

      <div style={{ padding: '0 16px 24px' }}>
        <button
          type="button"
          onClick={onBack}
          className="secondary"
          style={{
            borderRadius: 999,
            padding: '8px 16px',
            cursor: 'pointer',
          }}
        >
          ← 回到「我的」頁
        </button>
      </div>
    </div>
  );
};


// Toast 元件（放在 App 元件外面）
const ToastContainer: React.FC<{
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}> = ({ toasts, onDismiss }) => {
  return (
    <div
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: '90vw',
        width: 320,
      }}
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const Toast: React.FC<ToastMessage & { onDismiss: (id: string) => void }> = ({
  id,
  type,
  message,
  onDismiss,
}) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onDismiss(id), 300);
    }, 3000);

    return () => clearTimeout(timer);
  }, [id, onDismiss]);

  const bgColors = {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
  };

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  return (
    <div
      style={{
        background: bgColors[type],
        color: '#fff',
        padding: '12px 16px',
        borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 14,
        animation: isExiting
          ? 'slideOut 0.3s ease-out forwards'
          : 'slideIn 0.3s ease-out',
        cursor: 'pointer',
      }}
      onClick={() => {
        setIsExiting(true);
        setTimeout(() => onDismiss(id), 300);
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          flexShrink: 0,
        }}
      >
        {icons[type]}
      </div>
      <div style={{ flex: 1 }}>{message}</div>
    </div>
  );
};

// ======== App 主元件 ========
// ======== Toast Context（放在 App 元件之前）========

// 建立 Context
const ToastContext = React.createContext<{
  showToast: (type: ToastType, message: string) => void;
}>({
  showToast: () => { },
});

type RecordsPageProps = {
  recordTab: RecordSubTab;
  setRecordTab: (tab: RecordSubTab) => void;
  defaultMealType: '早餐' | '午餐' | '晚餐' | '點心';
  foodMealType: '早餐' | '午餐' | '晚餐' | '點心';
  setFoodMealType: (type: '早餐' | '午餐' | '晚餐' | '點心') => void;
  selectedDate: string;
  setSelectedDate: (d: string) => void;
  weekStart: string;
  setWeekStart: (d: string) => void;
  exForm: ExerciseFormState;
  onUpdateExForm: (patch: Partial<ExerciseFormState>) => void;
  // 👇 這些是原本直接讀取 App 變數，現在改由 Props 傳入
  meals: MealEntry[];
  setMeals: React.Dispatch<React.SetStateAction<MealEntry[]>>;
  exercises: ExerciseEntry[];
  setExercises: React.Dispatch<React.SetStateAction<ExerciseEntry[]>>;
  combos: MealCombo[];
  setCombos: React.Dispatch<React.SetStateAction<MealCombo[]>>;
  days: DaySummary[];
  todayLocal: string;
  typeTable: TypeRow[];
  unitMap: UnitMapRow[];
  foodDb: FoodDbRow[];
  exerciseMet: ExerciseMetRow[];
};
// ======== 運動記錄工具函數 ========

// 🆕 MET 強度視覺化工具函數
function getIntensityInfo(met: number): {
  color: string;
  label: string;
  level: 'low' | 'medium' | 'high';
} {
  if (met < 3) {
    return { color: '#10b981', label: '低強度', level: 'low' };
  }
  if (met < 6) {
    return { color: '#f59e0b', label: '中強度', level: 'medium' };
  }
  return { color: '#ef4444', label: '高強度', level: 'high' };
}

// 🆕 更新的常見運動列表（由低到高排序）
const COMMON_EXERCISES = [
  { name: '散步', met: 2.5 },
  { name: '走路', met: 3.0 },
  { name: '瑜珈', met: 3.0 },
  { name: '快走', met: 4.3 },
  { name: '有氧運動', met: 4.5 },
  { name: '騎自行車', met: 5.5 },
  { name: '重訓', met: 6.0 },
  { name: '爬山', met: 6.5 },
  { name: '游泳', met: 7.0 },
  { name: '飛輪有氧', met: 7.5 },
  { name: '慢跑', met: 8.0 },
  { name: 'HIIT', met: 8.5 },
];
// ======== 記錄頁 ========


const RecordsPage: React.FC<RecordsPageProps> = ({
  // 👇 這些是從 Props 解構出來的變數，要拿來用的 (不能刪)
  recordTab, setRecordTab,
  defaultMealType,
  foodMealType, setFoodMealType,
  selectedDate, setSelectedDate,
  weekStart, setWeekStart,
  exForm, onUpdateExForm,

  // 👇 這些是我們這次新增的資料，也要解構出來
  meals, setMeals,
  exercises, setExercises,
  combos, setCombos,
  days, todayLocal,
  typeTable, unitMap, foodDb, exerciseMet
}) => {
  const { showToast } = React.useContext(ToastContext);

  // 👇 [新增] 用於控制「快速加入」區塊的顯示分頁 ('history' 或 'combo')
  const [quickAddTab, setQuickAddTab] = useState<'history' | 'combo'>('history');

  // 👇 [新增] 1. 建立一個本地 State 來管理表單選中的餐別，避免觸發 App 重繪
  const [formMealType, setFormMealType] = useState(foodMealType);



  // 👇 [新增] 2. 監聽 props 變化：如果從外部(如首頁)切換進來，同步更新本地 State
  useEffect(() => {
    setFormMealType(foodMealType);
  }, [foodMealType]);

  // 紀錄頁用的週曆滑動區域 & 動畫狀態（邏輯跟 Today 頁一樣）
  const recordsWeekSwipeRef = useRef<HTMLDivElement | null>(null);
  const [recordsWeekSwipeOffset, setRecordsWeekSwipeOffset] = useState(0);


  // 週曆左右滑動（touch 事件）
  useEffect(() => {
    const el = recordsWeekSwipeRef.current;
    if (!el) return;

    let touchStartX = 0;
    let touchCurrentX = 0; // 改個名字比較清楚

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchCurrentX = touchStartX;
      setRecordsWeekSwipeOffset(0); // 歸零動畫位移
    };

    const handleTouchMove = (e: TouchEvent) => {
      touchCurrentX = e.touches[0].clientX;
      // 🟢 新增：即時更新位移，讓使用者看到滑動效果 (跟首頁一樣)
      setRecordsWeekSwipeOffset(touchCurrentX - touchStartX);
    };

    const handleTouchEnd = () => {
      const diff = touchStartX - touchCurrentX; // diff > 0 代表手指往左滑 (想看下一週)
      const threshold = 50;

      if (Math.abs(diff) > threshold) {
        if (diff > 0) {
          // 左滑 → 下一週
          // 🟢 關鍵修正：使用 prev => ... 確保拿到最新的日期，解決閉包舊值問題
          setWeekStart(prev => dayjs(prev).add(7, 'day').format('YYYY-MM-DD'));
        } else {
          // 右滑 → 上一週
          setWeekStart(prev => dayjs(prev).subtract(7, 'day').format('YYYY-MM-DD'));
        }
      }

      // 放手後歸位
      setRecordsWeekSwipeOffset(0);
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, []); // 這裡維持空陣列是安全的，因為我們改用了 functional update

  const jumpToToday = () => {
    const today = dayjs().format('YYYY-MM-DD');
    setSelectedDate(today);
    setWeekStart(dayjs().startOf('week').format('YYYY-MM-DD'));
  };
  const recordsWeekStart = dayjs(weekStart);
  const recordsWeekCenter = recordsWeekStart.add(3, 'day');
  const recordsWeekEnd = recordsWeekStart.add(6, 'day');
  const recordsSelectedDay = dayjs(selectedDate);

  const isRecordsSelectedInThisWeek =
    recordsSelectedDay.diff(recordsWeekStart, 'day') >= 0 &&
    recordsSelectedDay.diff(recordsWeekEnd, 'day') <= 0;

  const recordsMonthLabel =
    isRecordsSelectedInThisWeek &&
      (
        recordsSelectedDay.month() !== recordsWeekCenter.month() ||
        recordsSelectedDay.year() !== recordsWeekCenter.year()
      )
      ? recordsSelectedDay.format('MMMM, YYYY')  // ← 跟 Today 月份格式一樣
      : recordsWeekCenter.format('MMMM, YYYY');

  // 點月份標題時打開原生 date picker（跟 Today 頁同樣行為）
  const recordsDateInputRef = useRef<HTMLInputElement | null>(null);
  const openRecordsDatePicker = () => {
    const input = recordsDateInputRef.current;
    if (!input) return;

    const withPicker = input as HTMLInputElement & { showPicker?: () => void };

    if (withPicker.showPicker) {
      withPicker.showPicker();
    } else {
      input.focus();
      input.click();
    }
  };

  // 🟢 新增：AI 掃描相關狀態
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const aiInputRef = useRef<HTMLInputElement>(null);

  // 🟢 [新增] 1. 新增標籤掃描用的 Ref
  const labelInputRef = useRef<HTMLInputElement>(null);
  const aiInputRefGallery = useRef<HTMLInputElement>(null);
  const labelInputRefGallery = useRef<HTMLInputElement>(null);

  // 🟢 新增：AI 結果確認視窗狀態
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null); // 暫存 AI 回傳的結果

  // 🆕 新增:儲存 AI 辨識的「每份」基準營養素
  const [aiBaseNutrition, setAiBaseNutrition] = useState<{
    kcalPerServing: number;
    proteinPerServing: number;
    carbsPerServing: number;
    fatPerServing: number;
    servingSize: number;
  } | null>(null);

  // 🟢 新增：處理圖片選擇與 AI 分析
  const handleAiImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;



    try {
      setIsAiAnalyzing(true);
      showToast('info', '🤖 AI 正在分析食物圖片...');

      const base64 = await fileToDataURL(file);

      // 🟢 改用 Worker API
      const apiResult = await callWorkerAPI(base64, 'nutrition');

      // 🟢 檢查額度
      if (apiResult.error === 'quota_exceeded') {
        showToast('warning', apiResult.message);
        showUpgradeModal(); // 顯示升級提示
        return;
      }

      const result = apiResult.result;

      // 🟢 顯示剩餘額度（可選）
      const subscription = getSubscription();
      if (subscription.type === 'free' && apiResult.remaining !== undefined) {
        console.log(`✅ AI 辨識成功，今日剩餘 ${apiResult.remaining} 次`);
      }

      // 💡 UX 改善：分析完畢後，不直接填入，而是存入 State 並開啟確認視窗
      setAiResult({
        ...result,
        id: uuid(),
        actualRatio: 1.0  // 🆕 預設吃了全部
      });

      // 🆕 儲存「每份」的基準營養素
      setAiBaseNutrition({
        kcalPerServing: result.kcal || 0,
        proteinPerServing: result.protein || 0,
        carbsPerServing: result.carbs || 0,
        fatPerServing: result.fat || 0,
        servingSize: result.servingSize || 100
      });

      console.log('AI 回傳資料:', result);

      setShowAiModal(true);

      // 注意：這裡不呼叫 showToast('success')，改在 Modal 出現後讓使用者看到結果

    } catch (err: any) {
      console.error('AI Error:', err);
      showToast('error', err.message || 'AI 辨識失敗');
      // 如果失敗，當然要立刻關閉遮罩
      setIsAiAnalyzing(false);
    } finally {
      // 成功的情況：因為 setShowAiModal(true) 已經執行，
      // React 會在同一次 render cycle 處理這兩個狀態改變。
      // 但為了保險起見（避免閃爍），我們可以保留 isAiAnalyzing 為 true，
      // 直到 Modal 出現後，我們不需要手動關閉它嗎？

      // 💡 修正邏輯：
      // 在「成功」的路徑裡，我們其實不需要急著 setIsAiAnalyzing(false)。
      // 我們可以在 setShowAiModal(true) 的同時， setIsAiAnalyzing(false)。
      // 這樣 React 會批次處理，達成無縫切換。

      // 只需要確認 catch 裡有關閉它即可。
      // 所以原本的 finally 寫法其實也是 OK 的（React 18 自動批次更新）。
      // 這裡只需加上上面的 Overlay UI 即可解決感知問題。

      setIsAiAnalyzing(false);
      if (aiInputRef.current) aiInputRef.current.value = '';
    }
  };

  // 🟢 [新增] 2. 新增標籤掃描處理函式 (與 AI 食物辨識類似，但模式不同)
  const handleLabelImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsAiAnalyzing(true);
      showToast('info', '📄 正在讀取營養標示...');

      const base64 = await fileToDataURL(file);

      // 🟢 改用 Worker API（OCR 模式）
      const apiResult = await callWorkerAPI(base64, 'label');

      // 🟢 檢查額度
      if (apiResult.error === 'quota_exceeded') {
        showToast('warning', apiResult.message);
        showUpgradeModal(); // 顯示升級提示
        return;
      }

      const result = apiResult.result;

      // 🟢 顯示剩餘額度（可選）
      const subscription = getSubscription();
      if (subscription.type === 'free' && apiResult.remaining !== undefined) {
        console.log(`✅ OCR 辨識成功，今日剩餘 ${apiResult.remaining} 次`);
      }

      // 🟢 原本的邏輯繼續（不變）
      setScannedServingData(result);
      setServingCount(1);
      showToast('success', `✅ 讀取成功:${result.name} (每份 ${result.servingSize}g)`);

    } catch (err: any) {
      console.error('OCR Error:', err);
      showToast('error', err.message || '辨識失敗');
    } finally {
      setIsAiAnalyzing(false);
      if (labelInputRef.current) labelInputRef.current.value = '';
    }
    };
    // 🟢 新增：使用者在 Modal 點擊「確認加入」後執行的動作
    const confirmAiResult = (finalData: any) => {
      const ratio = finalData.actualRatio || 1;
      const actualWeight = Math.round((finalData.servingSize || 100) * ratio);
      const ratioPercent = ratio * 100;

      // 🆕 即時計算營養素
      const kcal = Math.round((aiBaseNutrition?.kcalPerServing || 0) * ratio);
      const protein = Number(((aiBaseNutrition?.proteinPerServing || 0) * ratio).toFixed(1));
      const carbs = Number(((aiBaseNutrition?.carbsPerServing || 0) * ratio).toFixed(1));
      const fat = Number(((aiBaseNutrition?.fatPerServing || 0) * ratio).toFixed(1));

      // 根據比例顯示不同的文字
      let amountText = '';
      if (ratioPercent === 100) {
        amountText = `${actualWeight}g`;
      } else if (ratioPercent === 75) {
        amountText = `大部分 (${actualWeight}g)`;
      } else if (ratioPercent === 50) {
        amountText = `一半 (${actualWeight}g)`;
      } else if (ratioPercent === 25) {
        amountText = `一些 (${actualWeight}g)`;
      } else {
        amountText = `${actualWeight}g (${ratioPercent.toFixed(0)}%)`;
      }

      const newEntry: MealEntry = {
        id: uuid(),
        date: selectedDate,
        mealType: formMealType,
        label: finalData.name,
        kcal: kcal,
        protein: protein,
        carb: carbs,
        fat: fat,
        amountText: amountText,
      };

      setMeals((prev) => [...prev, newEntry]);

      setShowAiModal(false);
      setAiResult(null);
      setAiBaseNutrition(null); // 🆕 清理基準營養素

      showToast('success', `已加入:${finalData.name}`);
    };

    // 🟢 新增：用來暫存掃描到的 100g 原始資料，作為計算基準
    const [scannedBaseData, setScannedBaseData] = useState<ScannedFood | null>(null);

    // OCR 掃描專用:暫存「每份」數據
    interface ServingBasedFood {
      name: string;
      servingSize: number;  // 每份重量(g)
      kcal: number;         // 每份熱量
      protein: number;      // 每份蛋白質
      carb: number;         // 每份碳水
      fat: number;          // 每份脂肪
      found: boolean;
      dataType?: 'serving' | '100g';
    }
    const [scannedServingData, setScannedServingData] = useState<ServingBasedFood | null>(null);
    const [servingCount, setServingCount] = useState<number>(1); // 使用者選擇的份數

    // 🆕 份量彈窗專用的 State
    const [showServingsModal, setShowServingsModal] = useState(false);
    const [servingsTab, setServingsTab] = useState<'dec' | 'frac'>('dec'); // 控制彈窗內的 Tab
    // 🆕 Unit Map (數量) 與 Food DB (重量) 的彈窗開關
    const [showUnitQtyModal, setShowUnitQtyModal] = useState(false);
    const [showGramModal, setShowGramModal] = useState(false);

    // 🆕 通用的 Tab 狀態 (控制彈窗內是顯示小數還是分數)
    const [inputTab, setInputTab] = useState<'dec' | 'frac'>('dec');



    // 🆕 分數滾輪的 Ref (用於自動捲動)
    const servingsPickerRef = useRef<HTMLDivElement>(null);

    // 👇 [新增] 給快速搜尋用的分數滾輪 Ref
    const unitQtyPickerRef = useRef<HTMLDivElement>(null);
    const gramPickerRef = useRef<HTMLDivElement>(null);

    // 定義分數選項 (顯示標籤 vs 實際數值)
    const fractionList = [
      { label: '1/8', value: '0.125' },
      { label: '1/4', value: '0.25' },
      { label: '1/3', value: '0.333' },
      { label: '1/2', value: '0.5' },
      { label: '2/3', value: '0.666' },
      { label: '3/4', value: '0.75' },
      { label: '5/6', value: '0.833' },
    ];




    // 🔧 修正：移除 local state，改用從 App 傳入的 props
    // 這樣餐別就不會在切換頁籤時消失

    // 🔧 只在從 Today 頁面點擊不同餐別進入時才更新餐別
    // 使用 useRef 追蹤上一次的 defaultMealType，避免每次 render 都觸發
    const prevDefaultMealTypeRef = useRef(defaultMealType);

    useEffect(() => {
      // 只有當 defaultMealType 真的改變時才更新（例如從 Today 點擊不同餐別進入）
      if (prevDefaultMealTypeRef.current !== defaultMealType) {
        setFoodMealType(defaultMealType);
        prevDefaultMealTypeRef.current = defaultMealType;
      }
    }, [defaultMealType, setFoodMealType]);


    const [foodName, setFoodName] = useState('');

    // A / B：Unit_Map、Food_DB
    const [selectedUnitFood, setSelectedUnitFood] =
      useState<UnitMapRow | null>(null);
    const [selectedFoodDbRow, setSelectedFoodDbRow] =
      useState<FoodDbRow | null>(null);
    // 🆕 1. 建立一個 Ref 來定位搜尋欄的位置
    const searchTopRef = useRef<HTMLDivElement>(null);

    // 🆕 2. 監聽：當選中 Unit Map 或 Food DB 食物時，自動捲動到搜尋欄
    useEffect(() => {
      if (selectedUnitFood || selectedFoodDbRow) {
        // 稍微延遲一點點，確保畫面渲染完成後再捲動
        setTimeout(() => {
          searchTopRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'center' // 捲動到畫面中間，確保不會被頂部導航列擋住
          });
        }, 100);
      }
    }, [selectedUnitFood, selectedFoodDbRow]);
    const [unitQuantity, setUnitQuantity] = useState('1');
    const [foodAmountG, setFoodAmountG] = useState('');

    // C：類別估算 / 其他類 / 自定義熱量
    const [fallbackType, setFallbackType] = useState<string>('');
    const [fallbackServings, setFallbackServings] = useState(''); // 幾份
    const [fallbackQty, setFallbackQty] = useState('');           // 參考數量, 例如 2
    const [fallbackUnitLabel, setFallbackUnitLabel] = useState('份'); // 參考單位, 例如 片、碗…

    // UX-07：份量 / 數量輸入模式（十進位 or 分數）
    const [servingsInputMode, setServingsInputMode] =
      useState<'dec' | 'frac'>('dec');
    const [unitQtyInputMode, setUnitQtyInputMode] =
      useState<'dec' | 'frac'>('dec');

    // C2：其他類 - 每份 P/C/F
    const [fallbackProtPerServ, setFallbackProtPerServ] = useState('');
    const [fallbackCarbPerServ, setFallbackCarbPerServ] = useState('');
    const [fallbackFatPerServ, setFallbackFatPerServ] = useState('');

    // C3：自定義熱量 - 每份 kcal
    const [fallbackKcalPerServ, setFallbackKcalPerServ] = useState('');

    // 保留舊有「直接輸入總熱量」
    const [manualFoodKcal, setManualFoodKcal] = useState('');

    // 編輯中的紀錄 id
    const [editingMealId, setEditingMealId] = useState<string | null>(null);

    // 🆕 自訂鍵盤 / 單位選擇器 開關
    const [showQtyPad, setShowQtyPad] = useState(false);
    const [showUnitPicker, setShowUnitPicker] = useState(false);

    // 👇 [新增] 用於控制 P/C/F 鍵盤的狀態
    const [editingMacro, setEditingMacro] = useState<'p' | 'c' | 'f' | null>(null);
    const [editingCustomKcal, setEditingCustomKcal] = useState<'servings' | 'kcal' | null>(null);



    // 單位列表 (固定順序，方便計算索引)
    const unitList = [
      '個', '杯', '碗', '盤', '片', '瓶', '包', 'g', 'ml', '湯匙', '茶匙',
      '根', '粒', '張', '米杯', '瓣',
    ];

    // 用來捲動「單位滾輪」的位置
    const unitPickerRef = useRef<HTMLDivElement>(null);

    // 3. 當彈窗打開時，自動捲動至目前選擇的單位
    useEffect(() => {
      if (showUnitPicker && unitPickerRef.current) {
        const targetLabel = fallbackUnitLabel || '份';
        const index = unitList.indexOf(targetLabel);
        if (index >= 0) {
          // 使用 setTimeout 確保在畫面渲染後執行
          setTimeout(() => {
            unitPickerRef.current?.scrollTo({
              top: index * 50, // 修正為 50 (對應 CSS 高度)
              behavior: 'auto', // 開啟時直接跳轉，不需要滑動動畫
            });
          }, 0);
        }
      }
      // 只在開啟 (showUnitPicker) 時執行一次，滑動變更數值時不觸發
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showUnitPicker]);

    // 🆕 飲食輸入模式（快速搜尋 vs 手掌法）
    const [foodInputMode, setFoodInputMode] = useState<'search' | 'palm'>('search');

    // 🟢 新增：控制掃描器開關
    const [showScanner, setShowScanner] = useState(false);

    // 🟢 新增：處理掃描結果的函式
    // 修改這個函式
    const handleScanResult = (food: ServingBasedFood) => {
      // 🆕 根據資料類型決定處理方式
      if (food.dataType === 'serving') {
        // ✅ 有「每份」資料 → 使用 OCR 的份數調整介面
        setScannedServingData(food);
        setServingCount(1);
        showToast('success', `✅ ${food.name} (每份 ${food.servingSize}g)`);
      } else {
        // ⚠️ 只有「每 100g」資料 → 使用舊的重量調整方式
        setFoodName(food.name);

        // 🟢 修正：使用 'as any' 避免型別衝突，確保能存入 state
        setScannedBaseData(food as any);

        setFallbackType('其他類');
        setFallbackServings('1');
        setFallbackQty('100');
        setFallbackUnitLabel('g');
        setFallbackProtPerServ(String(food.protein));
        setFallbackCarbPerServ(String(food.carb));
        setFallbackFatPerServ(String(food.fat));
        showToast('success', `✅ ${food.name} (每 100g 資料)`);
      }

      // 清除其他狀態
      setSelectedUnitFood(null);
      setSelectedFoodDbRow(null);
      setEditingMealId(null);

      setShowScanner(false);
      // showToast('success', `已載入：${food.name}`); // 這行可以註解掉，避免重複跳 Toast
    };

    // 🟢 新增：當「重量」改變時，如果是掃描的食物，自動依比例計算營養素
    useEffect(() => {
      // 只有當「有掃描基準資料」且「有輸入重量」時才執行
      if (scannedBaseData && fallbackQty) {
        const weight = parseFloat(fallbackQty);

        // 避免輸入非數字或負數時出錯
        if (!isNaN(weight) && weight > 0) {
          // 計算比例 (例如輸入 38g，比例就是 38/100 = 0.38)
          const ratio = weight / 100;

          // 格式化函式：保留一位小數
          const fmt = (val: number) => (val * ratio).toFixed(1);

          // 自動更新 P/C/F 欄位
          setFallbackProtPerServ(fmt(scannedBaseData.protein));
          setFallbackCarbPerServ(fmt(scannedBaseData.carb));
          setFallbackFatPerServ(fmt(scannedBaseData.fat));
        }
      }
    }, [fallbackQty, scannedBaseData]); // 監聽這兩個變數



    const recentMealsForQuickAdd = useMemo(() => {
      if (!meals.length) return [] as MealEntry[];

      const base = dayjs(selectedDate || todayLocal);
      const cutoff = base.subtract(14, 'day');
      const map = new Map<string, MealEntry>();

      // 🟢 修改：先淺拷貝並反轉陣列，讓最新的紀錄排在前面
      const reversedMeals = [...meals].reverse();

      for (const m of reversedMeals) {
        const d = dayjs(m.date);
        // 過濾掉太久以前的，保持介面乾淨
        if (d.isBefore(cutoff)) continue;

        const key = `${m.label}|${m.amountText || ''}|${m.kcal}`;

        // 因為我們已經是由新到舊跑迴圈，如果 Map 還沒這個 key，代表這是最新的
        if (!map.has(key)) {
          map.set(key, m);
        }
      }

      // Map 的 values 會依照插入順序排出，所以這裡直接取前 20 筆即可
      return Array.from(map.values()).slice(0, 20);
    }, [meals, selectedDate, todayLocal]);
    // 🆕 常用組合相關狀態
    const [selectedMealIds, setSelectedMealIds] = useState<string[]>([]);
    const [comboNameInput, setComboNameInput] = useState('');
    const [showSaveComboModal, setShowSaveComboModal] = useState(false);

    // ======== 運動相關 state (連接到 exForm) ========

    // 1. 運動記錄模式
    const recordMode = exForm.mode;
    const setRecordMode = (mode: 'quick' | 'detail') => {
      if (mode === 'detail') {
        // 切換到精確模式：清空名稱與 MET，不預帶快速模式的資料
        // 但保留體重與時間 (exWeight, exMinutes)，因為這兩者通常不變
        onUpdateExForm({
          mode,
          name: '',
          customMet: '',
          metRow: null,
          quickExercise: null
        });
      } else {
        // 切換回快速模式：也清空，讓使用者重新點選卡片
        onUpdateExForm({
          mode,
          name: '',
          customMet: '',
          metRow: null
        });
      }
    };

    // 2. 快速記錄選中的運動 (Wrapper)
    const quickExercise = exForm.quickExercise;
    // 簡化版 wrapper，直接更新表單
    const setQuickExercise = (value: any) => {
      onUpdateExForm({ quickExercise: value });
    };

    // 3. 運動表單欄位映射
    const exName = exForm.name;
    const setExName = (val: string) => onUpdateExForm({ name: val });

    const exMinutes = exForm.minutes;
    const setExMinutes = (val: string) => onUpdateExForm({ minutes: val });

    const exWeight = exForm.weight;
    const setExWeight = (val: string) => onUpdateExForm({ weight: val });

    const customMet = exForm.customMet;
    const setCustomMet = (val: string) => onUpdateExForm({ customMet: val });

    const selectedMetRow = exForm.metRow;
    const setSelectedMetRow = (val: any) => onUpdateExForm({ metRow: val });

    const editingExerciseId = exForm.editId;
    const setEditingExerciseId = (val: string | null) => onUpdateExForm({ editId: val });

    // 資料過濾 (維持不變，放在這裡方便讀取)
    const dayMeals = meals.filter((m) => m.date === selectedDate);
    const dayExercises = exercises.filter((e) => e.date === selectedDate);

    // 🆕 數字鍵盤控制開關 (放在這裡)
    const [showWeightPad, setShowWeightPad] = useState(false);
    const [showTimePad, setShowTimePad] = useState(false);
    const [showMetPad, setShowMetPad] = useState(false);


    // 🆕 4. 體重自動帶入邏輯 (智慧同步版)
    useEffect(() => {
      // 只有在「運動頁籤」時才執行
      if (recordTab !== 'exercise') return;

      // 1. 取得今日體重
      const day = days.find((d) => d.date === selectedDate);
      const todayW = (day && day.weight != null && day.weight > 0) ? String(day.weight) : null;

      // 2. 取得最近一次「非今日」的舊體重 (Fallback)
      // 用來判斷目前欄位裡的值，是不是之前自動帶入的舊資料
      const pastDays = days
        .filter((d) => d.weight != null && d.weight > 0 && d.date !== selectedDate)
        .sort((a, b) => dayjs(b.date).diff(dayjs(a.date)));
      const pastW = pastDays.length > 0 ? String(pastDays[0].weight) : null;

      // === 決策邏輯 ===

      // A. 如果欄位是空的 -> 有今日用今日，沒今日用舊的
      if (exWeight === '') {
        if (todayW) setExWeight(todayW);
        else if (pastW) setExWeight(pastW);
        return;
      }

      // B. 如果欄位有值，但跟今日體重不同 -> 檢查是否為「舊體重殘留」
      // 如果目前的值等於舊體重 (代表它可能是之前自動帶入的) -> 幫使用者更新為今日體重
      if (todayW && exWeight !== todayW) {
        if (exWeight === pastW) {
          setExWeight(todayW);
        }
      }

      // ⚠️ 重要：依賴陣列中移除了 exWeight，這樣您手動刪除/修改時才不會一直跳回來
    }, [selectedDate, days, recordTab]);

    // 🆕 5. 編輯運動邏輯 (包含智慧模式切換)
    function startEditExercise(e: ExerciseEntry) {
      setSelectedDate(e.date);
      setExName(e.name);
      setExMinutes(e.minutes != null ? String(e.minutes) : '');

      // 設定 MET (這會讓快速模式的卡片自動亮起)
      const metStr = e.met ? String(e.met) : '';
      setCustomMet(metStr);

      setEditingExerciseId(e.id);
      setRecordTab('exercise'); // 切換到運動頁籤

      // 🌟 智慧判斷：檢查 MET 是否屬於預設的三種強度
      // 如果是 (2.5 / 4.0 / 7.0) -> 切換到快速模式
      // 如果不是 -> 切換到精確模式
      const isQuickOption = ['2.5', '4', '4.0', '7', '7.0'].includes(metStr);

      if (isQuickOption) {
        setRecordMode('quick');
      } else {
        setRecordMode('detail');
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // 飲食搜尋：Unit_Map + Food_DB
    const foodSearchResults = useMemo(() => {
      const kw = foodName.trim().toLowerCase();

      // 🆕 從歷史記錄中搜尋（排除今天的記錄）
      const historyMatches = kw
        ? meals
          .filter((m) => {
            // 排除今天的記錄
            if (m.date === selectedDate) return false;
            // 搜尋名稱
            return normalizeText(m.label).includes(kw);
          })
          // 去重：相同名稱+份量+熱量只顯示一次
          .reduce((acc, m) => {
            const key = `${m.label}|${m.amountText || ''}|${m.kcal}`;
            if (!acc.some((item) => `${item.label}|${item.amountText || ''}|${item.kcal}` === key)) {
              acc.push(m);
            }
            return acc;
          }, [] as MealEntry[])
          // 按日期排序，最近的在前面
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 10) // 最多顯示 10 筆
        : [];

      // 🆕 常用組合搜尋
      const comboMatches = combos.filter((c) =>
        normalizeText(c.name).includes(kw)
      );

      // 如果沒有關鍵字，則顯示全部常用組合
      if (!kw) {
        return {
          unitMatches: [] as UnitMapRow[],
          foodMatches: [] as FoodDbRow[],
          comboMatches: combos,
          historyMatches: [], // 沒有關鍵字時不顯示歷史
        };
      }

      const unitMatches = unitMap.filter((u) =>
        normalizeText(u.Food).includes(kw)
      );
      const foodMatches = foodDb.filter((f) =>
        normalizeText(f.food).includes(kw)
      );

      return {
        unitMatches,
        foodMatches,
        comboMatches,
        historyMatches, // 🆕 加入歷史記錄
      };
    }, [foodName, unitMap, foodDb, combos, meals, selectedDate]);

    const typeOptions = useMemo(
      () => Array.from(new Set(typeTable.map((t) => t.Type))),
      [typeTable]
    );

    // 目前選到的 TypeRow（給 類別/估算模式 顯示 Weight per serving & note）
    const currentTypeRow = useMemo(
      () => typeTable.find((t) => t.Type === fallbackType),
      [typeTable, fallbackType]
    );

    // 🔹 根據 Type 顯示「視覺參照」提示
    const visualReference = useMemo(() => {
      if (fallbackType === '豆魚蛋肉類（低脂）') return '一份約三根手指大小';
      if (fallbackType === '豆魚蛋肉類（中脂）') return '一份約三根手指大小';
      if (fallbackType === '豆魚蛋肉類（高脂）') return '一份約三根手指大小';
      if (fallbackType === '水果類') return '一份約一個拳頭大小';
      if (fallbackType === '全穀雜糧類') return '一份約一個手掌大小';
      if (fallbackType === '蔬菜類') return '一份約一個拳頭大小';
      return '';
    }, [fallbackType]);

    // 依照目前選項計算 kcal + P/C/F + 顯示用份量
    const autoFoodInfo = useMemo(() => {
      const zero = {
        kcal: 0,
        protein: 0,
        carb: 0,
        fat: 0,
        amountText: '',
      };

      // === A. Unit_Map：以「份」為基準 ===
      if (selectedUnitFood) {
        // 🟢 修改：將 || '0' 改為 || '1' (若未輸入，預設為 1 份)
        const qty = Number(unitQuantity || '1');
        if (!qty || isNaN(qty)) return zero;


        const perUnitServ =
          Number(selectedUnitFood.ServingsPerUnit || '0') || 0;
        const servings = perUnitServ * qty;

        let kcalPerServ = 0;
        let protPerServ = 0;
        let carbPerServ = 0;
        let fatPerServ = 0;

        // 🆕 優先使用 Unit_Map 自身攜帶的精準營養素 (用於組合餐或調整過的項目)
        if (selectedUnitFood.Kcal_per_serv != null) {
          kcalPerServ = Number(selectedUnitFood.Kcal_per_serv || '0') || 0;
          protPerServ = Number(selectedUnitFood['Prot_per_serv (g)'] || '0') || 0;
          carbPerServ = Number(selectedUnitFood['Carb_per_serv (g)'] || '0') || 0;
          fatPerServ = Number(selectedUnitFood['Fat_per_serv (g)'] || '0') || 0;
        } else {
          // ⬇️ Fallback: 若無精準數據，則使用 Type_Table 進行估算
          const typeLabel = selectedUnitFood.Type?.trim();
          if (typeLabel) {
            const typeRow = typeTable.find((t) => t.Type === typeLabel);
            if (typeRow) {
              kcalPerServ = Number(typeRow.kcal || 0) || 0;
              protPerServ =
                Number(typeRow['protein (g)'] || 0) || 0;
              carbPerServ = Number(typeRow['carb (g)'] || 0) || 0;
              fatPerServ = Number(typeRow['fat (g)'] || 0) || 0;
            }
          }
        }
        const kcal = Math.round(servings * kcalPerServ);
        const protein = servings * protPerServ;
        const carb = servings * carbPerServ;
        const fat = servings * fatPerServ;

        return {
          kcal,
          protein,
          carb,
          fat,
          amountText: `${qty} ${selectedUnitFood.Unit}`,
        };
      }

      // === B. Food_DB：每 100g 精準資料 ===
      if (selectedFoodDbRow) {
        // 🟢 修改：將 || '0' 改為 || '100' (若未輸入，預設為 100g)
        const g = Number(foodAmountG || '100');
        if (!g || isNaN(g)) return zero;

        const kcal100 = Number(selectedFoodDbRow.kcal || 0) || 0;
        const prot100 =
          Number(selectedFoodDbRow['protein (g)'] || 0) || 0;
        const carb100 =
          Number(selectedFoodDbRow['carb (g)'] || 0) || 0;
        const fat100 =
          Number(selectedFoodDbRow['fat (g)'] || 0) || 0;

        const kcal1g = kcal100 / 100;
        const prot1g = prot100 / 100;
        const carb1g = carb100 / 100;
        const fat1g = fat100 / 100;

        const kcal = Math.round(g * kcal1g);
        const protein = g * prot1g;
        const carb = g * carb1g;
        const fat = g * fat1g;

        return {
          kcal,
          protein,
          carb,
          fat,
          amountText: `${g} g`,
        };
      }

      // === C. 類別估算 / 其他類 / 自定義熱量 ===
      const name = foodName.trim();
      if (!name || !fallbackType) return zero;

      // 🟢 修改：將 || '0' 改為 || '1' (若未輸入，預設為 1 份)
      const servings = Number(fallbackServings || '1');
      if (!servings || isNaN(servings)) return zero;

      let kcalPerServ = 0;
      let protPerServ = 0;
      let carbPerServ = 0;
      let fatPerServ = 0;
      let amountText = '';

      if (fallbackType === '其他類') {
        const p =
          Number(fallbackProtPerServ || '0') || 0;
        const c =
          Number(fallbackCarbPerServ || '0') || 0;
        const f =
          Number(fallbackFatPerServ || '0') || 0;

        kcalPerServ = p * 4 + c * 4 + f * 9;
        protPerServ = p;
        carbPerServ = c;
        fatPerServ = f;

        if (fallbackQty.trim()) {
          amountText = `${servings} 份 (${fallbackQty}${fallbackUnitLabel})`;
        } else {
          amountText = `${servings} 份`;
        }
      } else if (fallbackType === '自定義熱量') {
        const kk =
          Number(fallbackKcalPerServ || '0') || 0;
        kcalPerServ = kk;
        protPerServ = 0;
        carbPerServ = 0;
        fatPerServ = 0;
        amountText = `${servings} 份`;
      } else {
        const typeRow = typeTable.find(
          (t) => t.Type === fallbackType
        );
        if (!typeRow) return zero;

        kcalPerServ = Number(typeRow.kcal || 0) || 0;
        protPerServ =
          Number(typeRow['protein (g)'] || 0) || 0;
        carbPerServ =
          Number(typeRow['carb (g)'] || 0) || 0;
        fatPerServ =
          Number(typeRow['fat (g)'] || 0) || 0;
        amountText = `${servings} 份`;
      }

      const kcal = Math.round(servings * kcalPerServ);
      const protein = servings * protPerServ;
      const carb = servings * carbPerServ;
      const fat = servings * fatPerServ;

      return {
        kcal,
        protein,
        carb,
        fat,
        amountText,
      };
    }, [
      selectedUnitFood,
      selectedFoodDbRow,
      unitQuantity,
      foodAmountG,
      foodName,
      fallbackType,
      fallbackServings,
      fallbackQty,
      fallbackUnitLabel,
      fallbackProtPerServ,
      fallbackCarbPerServ,
      fallbackFatPerServ,
      fallbackKcalPerServ,
      typeTable,
    ]);

    const effectiveFoodKcal =
      selectedUnitFood ||
        selectedFoodDbRow ||
        fallbackType
        ? autoFoodInfo.kcal || 0
        : (() => {
          const v = Number(manualFoodKcal || '0');
          return isNaN(v) ? 0 : v;
        })();

    // 👇 [修改] 4. 修正 saveMeal：存檔時使用 formMealType
    function saveMeal() {
      if (!foodName.trim()) {
        showToast('error', '請先輸入食物名稱');
        return;
      }

      let kcal = 0;
      let protein = 0;
      let carb = 0;
      let fat = 0;
      let amountText = '';

      const usingAuto =
        !!selectedUnitFood ||
        !!selectedFoodDbRow ||
        !!fallbackType;

      if (usingAuto) {
        if (!autoFoodInfo.kcal || isNaN(autoFoodInfo.kcal)) {
          showToast('請先輸入正確的份量 / 克數 / 份量,才能計算熱量。');
          return;
        }
        kcal = autoFoodInfo.kcal;
        protein = autoFoodInfo.protein;
        carb = autoFoodInfo.carb;
        fat = autoFoodInfo.fat;
        amountText = autoFoodInfo.amountText;
      } else {
        if (!manualFoodKcal.trim()) {
          showToast('error', '請先輸入估算總熱量(kcal)。');
          return;
        }
        kcal = Number(manualFoodKcal);
        if (!kcal || isNaN(kcal)) {
          showToast('error', '請輸入正確的熱量數字。');
          return;
        }
      }

      if (editingMealId) {
        // 編輯既有紀錄
        setMeals((prev) =>
          prev.map((m) =>
            m.id === editingMealId
              ? {
                ...m,
                date: selectedDate,
                mealType: formMealType, // 🟢 改用 formMealType
                label: foodName.trim(),
                kcal,
                protein: protein || m.protein,
                carb: carb || m.carb,
                fat: fat || m.fat,
                amountText: amountText || m.amountText,
              }
              : m
          )
        );
        setEditingMealId(null);
      } else {
        const entry: MealEntry = {
          id: uuid(),
          date: selectedDate,
          mealType: formMealType, // 🟢 改用 formMealType
          label: foodName.trim(),
          kcal,
          protein,
          carb,
          fat,
          amountText,
        };
        setMeals((prev) => [...prev, entry]);
      }
      // 重置部分欄位
      setUnitQuantity('1');
      setFoodAmountG('');
      setManualFoodKcal('');
      setSelectedUnitFood(null);
      setSelectedFoodDbRow(null);
      setFoodName(''); // 清空搜尋欄位

      // 🆕 清空類別估算相關欄位
      setFallbackType('');
      setFallbackServings('');
      setFallbackQty('');
      setFallbackProtPerServ('');
      setFallbackCarbPerServ('');
      setFallbackFatPerServ('');
      setFallbackKcalPerServ('');
    }

    // 👇 [修改] 3. 修正 startEditMeal：編輯時只更新本地 State，不觸發 App 重繪
    function startEditMeal(m: MealEntry) {
      setSelectedDate(m.date);
      setFormMealType(m.mealType); // 🟢 改用 setFormMealType
      setFoodName(m.label);
      setManualFoodKcal(String(m.kcal));
      setSelectedUnitFood(null);
      setSelectedFoodDbRow(null);
      setUnitQuantity('1');
      setFoodAmountG('');
      setEditingMealId(m.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setRecordTab('food');
      // 🟢 修改：針對 mainContentRef 進行滾動，並加上一點延遲確保頁面切換完成
    setTimeout(() => {
      document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
    }

    // 🆕 處理選擇常用組合中的品項
    function toggleMealSelection(id: string) {
      setSelectedMealIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    }

    // 🆕 儲存為常用組合
    function handleSaveCombo() {
      if (!selectedMealIds.length) {
        showToast('warning', '請先選擇至少一個飲食紀錄品項');
        return;
      }
      if (!comboNameInput.trim()) {
        showToast('error', '請為常用組合命名');
        return;
      }

      const selectedMeals = meals.filter((m) =>
        selectedMealIds.includes(m.id)
      );

      const newCombo: MealCombo = {
        id: uuid(),
        name: comboNameInput.trim(),
        items: selectedMeals.map((m) => ({
          label: m.label,
          kcal: m.kcal,
          protein: m.protein,
          carb: m.carb,
          fat: m.fat,
          amountText: m.amountText,
        })),
      };

      setCombos((prev) => [...prev, newCombo]);
      setSelectedMealIds([]);
      setComboNameInput('');
      setShowSaveComboModal(false);
      showToast('success', `已成功儲存常用組合: ${newCombo.name}`);
    }

    // 🆕 載入常用組合
    // 👇 [修改] 5. 修正 addComboToMeals：使用 formMealType
    function addComboToMeals(combo: MealCombo, multiplier: number = 1) {
      const newEntries = combo.items.map((item) => ({
        id: uuid(),
        date: selectedDate,
        mealType: formMealType, // 🟢 改用 formMealType
        label: `${item.label}`, // 移除 x1 顯示，因為預設就是 1 倍
        kcal: Math.round(item.kcal * multiplier),
        protein: item.protein ? round1(item.protein * multiplier) : 0,
        carb: item.carb ? round1(item.carb * multiplier) : 0,
        fat: item.fat ? round1(item.fat * multiplier) : 0,
        amountText: item.amountText
          ? `${item.amountText}`
          : `約 ${Math.round(item.kcal)} kcal`,
      }));

      setMeals((prev) => [...prev, ...newEntries]);
      showToast('success', `已將組合「${combo.name}」加入 ${formMealType}。`); // 🟢 提示文字也改
    }

    // 運動搜尋
    const exerciseMatches = useMemo(() => {
      if (!exName.trim()) return [] as ExerciseMetRow[];
      const kw = exName.trim().toLowerCase();
      return exerciseMet.filter((row) =>
        normalizeText(row.活動).includes(kw)
      );
    }, [exName, exerciseMet]);

    // 使用哪一個 MET：優先列表, 再用自訂
    const usedMet = (() => {
      if (selectedMetRow) {
        return Number(selectedMetRow.MET || 0);
      }
      if (customMet.trim()) {
        return Number(customMet) || 0;
      }
      return 0;
    })();

    const autoExerciseKcal = useMemo(() => {
      const w = Number(exWeight || '0');
      const mins = Number(exMinutes || '0');
      if (!usedMet || !w || !mins || isNaN(w) || isNaN(mins)) {
        return 0;
      }
      const hours = mins / 60;
      return Math.round(usedMet * w * hours);
    }, [usedMet, exWeight, exMinutes]);

    // 🟢 最終修正版：addExercise
    const addExercise = () => {
      console.log('========== addExercise 開始 ==========');

      // 1. 驗證：名稱與 MET 是否存在
      // 不檢查 quickExercise，只檢查是否有填入內容
      if (!exName || !customMet) {
        showToast('error', '請選擇運動強度');
        return;
      }

      // 2. 驗證：時間與體重
      if (!exMinutes || !exWeight) {
        showToast('error', '請輸入時間與體重');
        return;
      }

      const w = parseFloat(exWeight);
      const m = parseFloat(exMinutes);
      const met = parseFloat(customMet);

      // 數字檢查
      if (isNaN(w) || w <= 0 || isNaN(m) || m <= 0) {
        showToast('error', '請輸入有效的數字');
        return;
      }

      // 3. 計算熱量 (公式：MET * 體重kg * 時間hr)
      const calculatedKcal = Math.round(met * w * (m / 60));

      // 4. 建立新紀錄物件
      const newEntry: ExerciseEntry = {
        id: editingExerciseId || crypto.randomUUID(),
        date: selectedDate,
        name: exName,
        minutes: m,
        met: met,    // 儲存 MET，這樣編輯時才能判斷是哪種強度
        kcal: calculatedKcal,
        weight: w,   // 儲存體重
      };

      // 5. 更新資料庫
      if (editingExerciseId) {
        setExercises((prev) =>
          prev.map((e) => (e.id === editingExerciseId ? newEntry : e))
        );
        showToast('success', `已更新運動：${exName}`);
        setEditingExerciseId(null);
      } else {
        setExercises((prev) => [...prev, newEntry]);
        showToast('success', `已新增運動：${exName}`);
      }

      // 6. 重置表單 (保留體重)
      onUpdateExForm({
        name: '',
        minutes: '',
        customMet: '',
        metRow: null,
        quickExercise: null, // 清空快速選項
        editId: null
      });

      console.log('========== addExercise 結束 ==========');
    };

    return (
      <div className="page page-records"
        style={{ paddingBottom: '90px' }}
      >
        {/* 🗓️ 記錄頁 - 月份標題 + 週曆 */}
        <header
          className="top-bar"
          style={{
            paddingTop: 'env(safe-area-inset-top)',
            height: 'auto',
            minHeight: '60px'
          }}
        >
          <div
            className="date-text"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {/* 1. 月份標題 + 幽靈 Date Input + 今天按鈕（跟今日頁同一套寫法） */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '0 8px',
              }}
            >
              <div style={{ flex: 1 }} />

              {/* 中間月份文字：relative 方便放透明 input */}
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div style={{ fontSize: 'var(--font-xs)', color: '#666', fontWeight: 500 }}>
                  {recordsMonthLabel}
                  <span style={{ marginLeft: 4 }}>▼</span>
                </div>

                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const newDate = e.target.value;
                    setSelectedDate(newDate);
                    // 同步週曆
                    const newWeekStart = dayjs(newDate).startOf('week').format('YYYY-MM-DD');
                    if (weekStart !== newWeekStart) {
                      setWeekStart(newWeekStart);
                    }
                  }}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, zIndex: 10, cursor: 'pointer' }}
                />
              </div>

              {/* 右邊「今天」按鈕 */}
              <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={jumpToToday} // 使用新的 jumpToToday
                  style={{
                    padding: '4px 12px',
                    fontSize: 15,
                    fontWeight: 500,
                    color:
                      selectedDate === dayjs().format('YYYY-MM-DD')
                        ? '#fff'
                        : '#97d0ba',
                    background:
                      selectedDate === dayjs().format('YYYY-MM-DD')
                        ? '#97d0ba'
                        : 'transparent',
                    border: '1px solid #97d0ba',
                    borderRadius: 12,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  今天
                </button>
              </div>
            </div>

            {/* 2. 週曆區塊：左右箭頭 + 可滑動日期（寫法也跟今日頁一致） */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                gap: 4,
              }}
            >
              {/* 左箭頭：上一週 */}
              <button
                onClick={() => setWeekStart(dayjs(weekStart).subtract(7, 'day').format('YYYY-MM-DD'))}
                style={{ padding: '0 4px', border: 'none', background: 'transparent', color: '#ccc', fontSize: 18, cursor: 'pointer' }}
              >
                ‹
              </button>

              {/* 可滑動週曆區域 */}
              <div ref={recordsWeekSwipeRef} style={{ flex: 1, padding: '0', touchAction: 'pan-y', overflow: 'hidden' }}>
                <div style={{ display: 'flex', gap: 4, transform: `translateX(${recordsWeekSwipeOffset}px)` }}>
                  {/* 👇 [修改] 這裡的迴圈要改用 weekStart */}
                  {Array.from({ length: 7 }).map((_, i) => {
                    const date = dayjs(weekStart).add(i, 'day'); // 改用 weekStart
                    const dateStr = date.format('YYYY-MM-DD');
                    const isSelected = dateStr === selectedDate;
                    const isToday = dateStr === dayjs().format('YYYY-MM-DD');

                    return (
                      <button
                        key={dateStr}
                        onClick={() => setSelectedDate(dateStr)}
                        style={{
                          flex: 1,
                          height: 56,
                          borderRadius: 10,
                          border: isSelected
                            ? '2px solid #97d0ba'
                            : isToday
                              ? '2px solid #d1f0e3'
                              : '1px solid #e9ecef',
                          background: isSelected
                            ? '#97d0ba'
                            : isToday
                              ? '#fff'
                              : 'transparent',
                          color: isSelected
                            ? '#fff'
                            : isToday
                              ? '#97d0ba'
                              : '#333',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 2,
                          boxShadow: isSelected
                            ? '0 2px 8px rgba(151, 208, 186, 0.3)'
                            : 'none',
                          padding: '6px 0',
                          minWidth: 0,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 'var(--font-xs)',
                            fontWeight: 500,
                            opacity: isSelected ? 1 : 0.7,
                          }}
                        >
                          {date.format('ddd')}
                        </span>
                        <span
                          style={{
                            fontSize: 'var(--font-sm)',
                            fontWeight: isSelected ? 700 : isToday ? 600 : 500,
                          }}
                        >
                          {date.format('D')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 右箭頭：下一週 */}
              <button
                onClick={() => setWeekStart(dayjs(weekStart).add(7, 'day').format('YYYY-MM-DD'))}
                style={{ padding: '0 4px', border: 'none', background: 'transparent', color: '#ccc', fontSize: 18, cursor: 'pointer' }}
              >
                ›
              </button>
            </div>
          </div>
        </header>



        <div className="subtabs">
          <button
            className={`tab-btn-large ${recordTab === 'food' ? 'active' : ''}`} // 👈 套用
            onClick={() => {
              setRecordTab('food');
              setFoodInputMode('search');
            }}
          >
            飲食
          </button>
          <button
            className={`tab-btn-large ${recordTab === 'exercise' ? 'active' : ''}`} // 👈 套用
            onClick={() => setRecordTab('exercise')}
          >
            運動
          </button>
        </div>

        {/* 飲食 */}
        {recordTab === 'food' && (
          <div className="card">
            <div className="form-section" style={{ marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {(['早餐', '午餐', '晚餐', '點心'] as const).map((t) => {
                  const isSelected = formMealType === t;

                  // 使用跟你首頁一樣的圖片路徑邏輯
                  const iconMap: Record<string, string> = {
                    '早餐': 'breakfast.png',
                    '午餐': 'lunch.png',
                    '晚餐': 'dinner.png',
                    '點心': 'snack.png',
                  };
                  const iconSrc = `${APP_BASE_URL}icons/${iconMap[t]}`;

                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormMealType(t)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '10px 4px',
                        borderRadius: 12,
                        // 選中時顯示品牌綠框與淺綠底，沒選中顯示灰框白底
                        border: isSelected ? '2px solid #97d0ba' : '1px solid #e9ecef',
                        background: isSelected ? '#f0fdf9' : '#fff',
                        color: isSelected ? '#1f2937' : '#6b7280',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        minWidth: 0,
                      }}
                    >
                      <img
                        src={iconSrc}
                        alt={t}
                        style={{
                          width: 32,
                          height: 32,
                          marginBottom: 4,
                          objectFit: 'contain',
                          // 沒選中時稍微讓圖片淡一點，凸顯選中項
                          opacity: isSelected ? 1 : 0.6
                        }}
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                      <span style={{ fontSize: 'var(--font-md)', fontWeight: isSelected ? 700 : 500 }}>
                        {t}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 🖐️ 手掌法全屏模式 */}
            {foodInputMode === 'palm' && (
              <VisualPortionPicker
                mealType={formMealType}
                onConfirm={(data) => {
                  const newMeal: MealEntry = {
                    id: uuid(),
                    date: selectedDate,
                    mealType: formMealType,
                    label: data.foodName,
                    kcal: data.kcal,
                    protein: data.protein,
                    carb: data.carbs,
                    fat: data.fat,
                    amountText: data.amountText,
                    counts: data.counts,
                  };
                  setMeals((prev) => [...prev, newMeal]);
                  showToast('success', `已加入 ${data.foodName}`);
                  setFoodInputMode('search');
                }}
                onCancel={() => setFoodInputMode('search')}
              />
            )}

            {/* 只有在非手掌法模式時才顯示卡片 */}
            {foodInputMode !== 'palm' && (
              <>


                {/* 🖐️ 手掌法區塊 */}
                <div
                  onClick={() => setFoodInputMode('palm')}
                  style={{
                    background: 'linear-gradient(135deg, var(--mint, #97d0ba) 0%, var(--mint-dark, #5c9c84) 100%)',
                    borderRadius: 12,
                    padding: '14px 16px',
                    marginBottom: 12,
                    boxShadow: '0 4px 12px rgba(92, 156, 132, 0.3)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12
                  }}
                >
                  <img
                    src={palmImg}
                    alt="hand"
                    style={{
                      width: 32,
                      height: 32,
                      objectFit: 'contain',
                      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                    }}
                  />
                  <h3 style={{
                    margin: 0,
                    fontSize: 16,
                    color: '#fff',
                    fontWeight: 700
                  }}>
                    手掌法快速估算
                  </h3>
                </div>

                {/* 📸 掃描辨識區塊 (整合式卡片設計 - 修正版) */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>

                  {/* 1. AI 辨識卡片 (左) */}
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#fff',
                    borderRadius: 16,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    border: '1px solid #f0f0f0',
                    overflow: 'hidden'
                  }}>
                    {/* 上半部：拍照 (主按鈕) */}
                    <button
                      type="button"
                      onClick={() => aiInputRef.current?.click()}
                      disabled={isAiAnalyzing}
                      style={{
                        flex: 1,
                        border: 'none',
                        background: '#fff',
                        padding: '16px 0 12px 0',
                        cursor: isAiAnalyzing ? 'wait' : 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                        transition: 'background 0.2s'
                      }}
                      onMouseDown={(e) => e.currentTarget.style.background = '#f9fafb'}
                      onMouseUp={(e) => e.currentTarget.style.background = '#fff'}
                    >
                      <div style={{ fontSize: 28 }}>{isAiAnalyzing ? '⏳' : '✨'}</div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>AI 辨識</span>
                    </button>

                    {/* 分隔線 */}
                    <div style={{ height: 1, background: '#f3f4f6' }} />

                    {/* 下半部：相簿 (次按鈕) */}
                    <button
                      type="button"
                      onClick={() => aiInputRefGallery.current?.click()}
                      disabled={isAiAnalyzing}
                      style={{
                        padding: '10px 0',
                        border: 'none',
                        background: '#fcfcfc',
                        color: '#6b7280',
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4
                      }}
                    >
                      {/* 內建 SVG 相簿圖示，不需額外 import */}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                      </svg>
                      相簿
                    </button>
                  </div>

                  {/* 2. 營養標示卡片 (中) */}
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#fff',
                    borderRadius: 16,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    border: '1px solid #f0f0f0',
                    overflow: 'hidden'
                  }}>
                    <button
                      type="button"
                      onClick={() => labelInputRef.current?.click()}
                      disabled={isAiAnalyzing}
                      style={{
                        flex: 1,
                        border: 'none',
                        background: '#fff',
                        padding: '16px 0 12px 0',
                        cursor: isAiAnalyzing ? 'wait' : 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6
                      }}
                      onMouseDown={(e) => e.currentTarget.style.background = '#f9fafb'}
                      onMouseUp={(e) => e.currentTarget.style.background = '#fff'}
                    >
                      {/* 使用你原本的 nutritionIcon 變數 */}
                      <img src={nutritionIcon} alt="營養標示" style={{ width: 28, height: 28, objectFit: 'contain' }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>營養標示</span>
                    </button>

                    <div style={{ height: 1, background: '#f3f4f6' }} />

                    <button
                      type="button"
                      onClick={() => labelInputRefGallery.current?.click()}
                      disabled={isAiAnalyzing}
                      style={{
                        padding: '10px 0',
                        border: 'none',
                        background: '#fcfcfc',
                        color: '#6b7280',
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                      </svg>
                      相簿
                    </button>
                  </div>

                  {/* 3. 條碼掃描 (右 - 單一按鈕) */}
                  <div style={{
                    width: '80px', // 稍微窄一點
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#fff',
                    borderRadius: 16,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    border: '1px solid #f0f0f0',
                    overflow: 'hidden'
                  }}>
                    <button
                      type="button"
                      onClick={() => setShowScanner(true)}
                      style={{
                        flex: 1,
                        border: 'none',
                        background: '#fff',
                        padding: '0',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6
                      }}
                      onMouseDown={(e) => e.currentTarget.style.background = '#f9fafb'}
                      onMouseUp={(e) => e.currentTarget.style.background = '#fff'}
                    >
                      {/* 使用你原本的 barcodeIcon 變數 */}
                      <img src={barcodeIcon} alt="條碼" style={{ width: 28, height: 28, objectFit: 'contain' }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>條碼</span>
                    </button>
                  </div>

                </div>


                {/* 🔍 搜尋食物資料庫 */}
                <details open style={{
                  background: '#fff',
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 12,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                }}>
                  <summary style={{
                    fontSize: 14,
                    color: 'var(--text-sub, #6b7785)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    listStyle: 'none',
                    userSelect: 'none',
                    marginBottom: 12
                  }}>
                    <span>🔍 搜尋食物資料庫</span>
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: '#999' }}>▼</span>
                  </summary>


                  <div className="form-section">
                    {/* 🟢 修改：將原本包搜尋框的 div 改為 Flex 佈局，放入掃描按鈕 */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 0 }}>

                      {/* 這是原本的搜尋框容器 (加了 flex: 1 讓它佔據剩餘空間) */}
                      <div ref={searchTopRef} style={{ flex: 1, position: 'relative' }}>
                        {/* 左側搜尋 Icon */}
                        <div style={{
                          position: 'absolute',
                          left: 12,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          opacity: 0.5,
                          pointerEvents: 'none'
                        }}>
                          🔍
                        </div>

                        {/* 優化後的 Input */}
                        <input
                          value={foodName}
                          onChange={(e) => {
                            setFoodName(e.target.value);
                            setSelectedUnitFood(null);
                            setSelectedFoodDbRow(null);
                            setEditingMealId(null);
                            // 🟢 新增：一旦使用者手動打字，就視為放棄掃描的資料，停止自動連動
                            setScannedBaseData(null);
                          }}
                          placeholder="輸入關鍵字"
                          name="foodSearchQuery"
                          autoComplete="off"
                          autoCorrect="off"
                          spellCheck="false"
                          style={{
                            width: '100%',
                            padding: '12px 36px 12px 40px', // 左右留空給 Icon 與 X 按鈕
                            borderRadius: '99px',           // 圓角設計
                            border: '1px solid #dde7e2',
                            background: '#fff',
                            fontSize: '16px',               // 關鍵：防止 iOS 自動放大
                            outline: 'none',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                            transition: 'all 0.2s',
                            boxSizing: 'border-box'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#97d0ba'}
                          onBlur={(e) => e.target.style.borderColor = '#dde7e2'}
                        />

                        {/* 右側清除按鈕 (有文字時才顯示) */}
                        {foodName && (
                          <button
                            onClick={() => {
                              setFoodName('');
                              setSelectedUnitFood(null);
                              setSelectedFoodDbRow(null);
                              setEditingMealId(null);
                            }}
                            style={{
                              position: 'absolute',
                              right: 8,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              border: 'none',
                              background: '#f0f0f0',
                              color: '#999',
                              borderRadius: '50%',
                              width: 24,
                              height: 24,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px',
                              cursor: 'pointer',
                              padding: 0
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* 隱藏的 file input 元素 */}
                      {/* AI 食物掃描 - 拍照 */}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        ref={aiInputRef}
                        style={{ display: 'none' }}
                        onChange={handleAiImageSelect}
                      />

                      {/* AI 食物掃描 - 相簿 */}
                      <input
                        type="file"
                        accept="image/*"
                        ref={aiInputRefGallery}
                        style={{ display: 'none' }}
                        onChange={handleAiImageSelect}
                      />

                      {/* 營養標示掃描 - 拍照 */}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        ref={labelInputRef}
                        onChange={handleLabelImageSelect}
                        style={{ display: 'none' }}
                      />

                      {/* 營養標示掃描 - 相簿 */}
                      <input
                        type="file"
                        accept="image/*"
                        ref={labelInputRefGallery}
                        onChange={handleLabelImageSelect}
                        style={{ display: 'none' }}
                      />


                    </div>
                    {/* =========================================================
                🔴 補回遺失區塊：已選中 Unit Map 食物 (顯示數量輸入按鈕)
               ========================================================= */}
                    {selectedUnitFood && (
                      <>
                        <div style={{ background: '#fff', padding: '16px', borderRadius: 12, border: '1px solid #e9ecef', marginBottom: 12 }}>
                          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#374151', fontSize: 14 }}>
                            數量 ({selectedUnitFood.Unit})
                          </label>

                          {/* 觸發按鈕 (唯讀) */}
                          <div
                            onClick={() => {
                              setShowUnitQtyModal(true);
                              setUnitQuantity(''); // 🟢 開啟時清空，方便直接輸入
                            }}
                            style={{
                              height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: '#f9fafc', border: '1px solid #e5e7eb', borderRadius: 10,
                              fontSize: 18, fontWeight: 600, color: '#1f2937', cursor: 'pointer',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                            }}
                          >
                            {unitQuantity || '1'}
                          </div>

                          {/* === Unit Qty Modal (數量輸入彈窗) === */}
                          {showUnitQtyModal && (
                            <div
                              className="modal-backdrop"
                              style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: 'rgba(0,0,0,0.4)',
                                zIndex: 200
                              }}
                              onClick={() => setShowUnitQtyModal(false)}
                            >
                              <div
                                style={{
                                  position: 'absolute',
                                  bottom: 'calc(70px + env(safe-area-inset-bottom))',
                                  left: 0,
                                  right: 0,
                                  maxWidth: 420,
                                  margin: '0 auto',
                                  background: '#f0f2f5',
                                  borderTopLeftRadius: 20,
                                  borderTopRightRadius: 20,
                                  padding: 20,
                                  boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 16,
                                  animation: 'slideInUp 0.2s ease-out'
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {/* 頂部列 */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <span style={{ fontWeight: 600, color: '#666', fontSize: 15 }}>輸入數量 ({selectedUnitFood.Unit})</span>
                                  <div style={{ display: 'flex', background: '#e5e7eb', padding: 3, borderRadius: 8 }}>
                                    <button onClick={() => setInputTab('dec')} style={{ padding: '4px 16px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 600, background: inputTab === 'dec' ? '#fff' : 'transparent', color: inputTab === 'dec' ? '#333' : '#666', boxShadow: inputTab === 'dec' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}>小數</button>
                                    <button onClick={() => setInputTab('frac')} style={{ padding: '4px 16px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 600, background: inputTab === 'frac' ? '#fff' : 'transparent', color: inputTab === 'frac' ? '#333' : '#666', boxShadow: inputTab === 'frac' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}>分數</button>
                                  </div>
                                </div>

                                {/* 數值顯示 */}
                                <div style={{ background: '#fff', borderRadius: 12, padding: '12px', textAlign: 'center', fontSize: 28, fontWeight: 700, color: '#333', border: '1px solid #e5e7eb' }}>
                                  {unitQuantity || '0'}
                                </div>

                                {/* 鍵盤內容 */}
                                {inputTab === 'dec' ? (
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0].map((num) => (
                                      <button key={num} onClick={() => { if (num === '.') { if (!unitQuantity.includes('.')) setUnitQuantity(p => p + '.'); } else { setUnitQuantity(p => (p === '0' || p === '' ? String(num) : p + num)); } }} style={{ padding: '12px 0', borderRadius: 12, border: 'none', background: '#fff', fontSize: 22, fontWeight: 600, color: '#333', boxShadow: '0 2px 0 #e5e7eb' }}>{num}</button>
                                    ))}
                                    <button onClick={() => setUnitQuantity(p => p.slice(0, -1) || '0')} style={{ padding: '12px 0', borderRadius: 12, border: 'none', background: '#e5e7eb', fontSize: 20, color: '#333', boxShadow: '0 2px 0 #d1d5db' }}>⌫</button>
                                  </div>
                                ) : (
                                  // 👇 [修改] 分數滾輪區塊：加入 ref, onScroll 與顯示優化
                                  <div style={{ position: 'relative', height: 200, overflow: 'hidden', background: '#fff', borderRadius: 12 }}>
                                    <div style={{ position: 'absolute', top: 75, left: 0, right: 0, height: 50, background: 'rgba(151, 208, 186, 0.2)', borderTop: '1px solid #97d0ba', borderBottom: '1px solid #97d0ba', pointerEvents: 'none', zIndex: 1 }}></div>
                                    <div
                                      ref={unitQtyPickerRef} // 1. 綁定 ref
                                      onScroll={(e) => {     // 2. 加入滑動監聽
                                        const scrollTop = e.currentTarget.scrollTop;
                                        const index = Math.round(scrollTop / 50);
                                        const target = fractionList[index];
                                        if (target) {
                                          setUnitQuantity(target.value);
                                        }
                                      }}
                                      style={{ height: '100%', overflowY: 'auto', scrollSnapType: 'y mandatory', position: 'relative', zIndex: 2, scrollbarWidth: 'none' }}
                                    >
                                      <div style={{ height: 75 }}></div>
                                      {fractionList.map((item) => (
                                        <div
                                          key={item.label}
                                          onClick={() => {
                                            setUnitQuantity(item.value);
                                            // 3. 點擊自動捲動置中
                                            const index = fractionList.indexOf(item);
                                            if (unitQtyPickerRef.current) {
                                              unitQtyPickerRef.current.scrollTo({ top: index * 50, behavior: 'smooth' });
                                            }
                                          }}
                                          style={{ height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 600, scrollSnapAlign: 'center', color: String(unitQuantity) === item.value ? '#059669' : '#9ca3b8', transition: 'all 0.2s', cursor: 'pointer' }}
                                        >
                                          {item.label}
                                          {/* 4. 顯示對應小數 */}
                                          {String(unitQuantity) === item.value && (
                                            <span style={{ fontSize: 15, color: '#5c9c84', marginLeft: 8, fontWeight: 400 }}>
                                              ({item.value})
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                      <div style={{ height: 75 }}></div>
                                    </div>
                                  </div>
                                )}

                                <button onClick={() => setShowUnitQtyModal(false)} style={{ width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', background: '#5c9c84', color: '#fff', fontSize: 18, fontWeight: 700, marginTop: 4 }}>完成</button>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="hint">
                          {selectedUnitFood.Food} ({selectedUnitFood.Unit})：{selectedUnitFood.Kcal_per_serv} kcal / 份
                        </div>

                        {/* 即時營養資訊卡片 - 優化版 */}
                        {selectedUnitFood && unitQuantity && Number(unitQuantity) > 0 && (
                          <div style={{
                            background: 'linear-gradient(135deg, #f0fdf9 0%, #f7fbf8 100%)',
                            borderRadius: 12,
                            padding: '16px',
                            marginTop: 12,
                            marginBottom: 8,
                            border: '1px solid #d1f0e3',
                            boxShadow: '0 2px 8px rgba(151, 208, 186, 0.1)'
                          }}>
                            {/* 標題 */}
                            <div style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: '#5c9c84',
                              marginBottom: 12,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6
                            }}>
                              <span>📊</span>
                              <span>營養資訊預覽</span>
                            </div>

                            {/* 熱量 (大字) */}
                            <div style={{
                              textAlign: 'center',
                              marginBottom: 12,
                              paddingBottom: 12,
                              borderBottom: '1px solid #e5f3ed'
                            }}>
                              <div style={{ fontSize: 32, fontWeight: 700, color: '#1f2937', lineHeight: 1 }}>
                                {Math.round(effectiveFoodKcal)}
                                <span style={{ fontSize: 16, fontWeight: 500, color: '#6b7280', marginLeft: 4 }}>kcal</span>
                              </div>
                            </div>

                            {/* 營養素 (P/C/F) 三欄 */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                              {/* 蛋白質 */}
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, fontWeight: 500 }}>蛋白質</div>
                                <div style={{
                                  fontSize: 18,
                                  fontWeight: 700,
                                  color: '#5c9c84',
                                  display: 'flex',
                                  alignItems: 'baseline',
                                  justifyContent: 'center',
                                  gap: 2
                                }}>
                                  {round1((Number(selectedUnitFood['Prot_per_serv (g)'] || 0) * Number(unitQuantity)))}
                                  <span style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af' }}>g</span>
                                </div>
                              </div>

                              {/* 碳水化合物 */}
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, fontWeight: 500 }}>碳水</div>
                                <div style={{
                                  fontSize: 18,
                                  fontWeight: 700,
                                  color: '#ffbe76',
                                  display: 'flex',
                                  alignItems: 'baseline',
                                  justifyContent: 'center',
                                  gap: 2
                                }}>
                                  {round1((Number(selectedUnitFood['Carb_per_serv (g)'] || 0) * Number(unitQuantity)))}
                                  <span style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af' }}>g</span>
                                </div>
                              </div>

                              {/* 脂肪 */}
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, fontWeight: 500 }}>脂肪</div>
                                <div style={{
                                  fontSize: 18,
                                  fontWeight: 700,
                                  color: '#ff7979',
                                  display: 'flex',
                                  alignItems: 'baseline',
                                  justifyContent: 'center',
                                  gap: 2
                                }}>
                                  {round1((Number(selectedUnitFood['Fat_per_serv (g)'] || 0) * Number(unitQuantity)))}
                                  <span style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af' }}>g</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        {/* 加入按鈕 */}
                        <button
                          className="primary"
                          onClick={saveMeal}
                          style={{ marginTop: 16, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}
                        >
                          <span>加入記錄</span>
                          {effectiveFoodKcal > 0 && (
                            <span style={{ background: 'rgba(255,255,255,0.25)', padding: '2px 8px', borderRadius: 99, fontSize: 13, fontWeight: 600 }}>
                              {Math.round(effectiveFoodKcal)} kcal
                            </span>
                          )}
                        </button>
                        <button onClick={() => { setSelectedUnitFood(null); setUnitQuantity('1'); }} style={{ marginTop: 8 }}>
                          取消選擇
                        </button>
                      </>
                    )}

                    {/* =========================================================
                🔴 補回遺失區塊：已選中 Food DB 食物 (顯示重量輸入按鈕)
               ========================================================= */}
                    {selectedFoodDbRow && (
                      <>
                        <div style={{ background: '#fff', padding: '16px', borderRadius: 12, border: '1px solid #e9ecef', marginBottom: 12 }}>
                          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#374151', fontSize: 14 }}>
                            重量 (g)
                          </label>

                          {/* 觸發按鈕 (唯讀) */}
                          <div
                            onClick={() => {
                              setShowGramModal(true);
                              setFoodAmountG(''); // 🟢 開啟時清空，方便直接輸入
                            }}
                            style={{
                              height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: '#f9fafc', border: '1px solid #e5e7eb', borderRadius: 10,
                              fontSize: 18, fontWeight: 600, color: '#1f2937', cursor: 'pointer',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                            }}
                          >
                            {foodAmountG || '100'}
                            <span style={{ fontSize: 15, color: '#9ca3af', marginLeft: 4, fontWeight: 400 }}>g</span>
                          </div>

                          {/* === Gram Modal (重量輸入彈窗) === */}
                          {showGramModal && (
                            <div
                              className="modal-backdrop"
                              style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: 'rgba(0,0,0,0.4)',
                                zIndex: 200
                              }}
                              onClick={() => setShowGramModal(false)}
                            >
                              <div
                                style={{
                                  position: 'absolute',
                                  bottom: 'calc(70px + env(safe-area-inset-bottom))',
                                  left: 0,
                                  right: 0,
                                  maxWidth: 420,
                                  margin: '0 auto',
                                  background: '#f0f2f5',
                                  borderTopLeftRadius: 20,
                                  borderTopRightRadius: 20,
                                  padding: 20,
                                  boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 16,
                                  animation: 'slideInUp 0.2s ease-out'
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {/* 頂部列 */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <span style={{ fontWeight: 600, color: '#666', fontSize: 15 }}>輸入重量 (g)</span>
                                  <div style={{ display: 'flex', background: '#e5e7eb', padding: 3, borderRadius: 8 }}>
                                    <button onClick={() => setInputTab('dec')} style={{ padding: '4px 16px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 600, background: inputTab === 'dec' ? '#fff' : 'transparent', color: inputTab === 'dec' ? '#333' : '#666', boxShadow: inputTab === 'dec' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}>小數</button>
                                    <button onClick={() => setInputTab('frac')} style={{ padding: '4px 16px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 600, background: inputTab === 'frac' ? '#fff' : 'transparent', color: inputTab === 'frac' ? '#333' : '#666', boxShadow: inputTab === 'frac' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}>分數</button>
                                  </div>
                                </div>

                                {/* 數值顯示 */}
                                <div style={{ background: '#fff', borderRadius: 12, padding: '12px', textAlign: 'center', fontSize: 28, fontWeight: 700, color: '#333', border: '1px solid #e5e7eb' }}>
                                  {foodAmountG || '0'}
                                </div>

                                {/* 鍵盤內容 (與 Unit Qty 共用 inputTab 邏輯) */}
                                {inputTab === 'dec' ? (
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0].map((num) => (
                                      <button key={num} onClick={() => { if (num === '.') { if (!foodAmountG.includes('.')) setFoodAmountG(p => p + '.'); } else { setFoodAmountG(p => (p === '0' || p === '' ? String(num) : p + num)); } }} style={{ padding: '12px 0', borderRadius: 12, border: 'none', background: '#fff', fontSize: 22, fontWeight: 600, color: '#333', boxShadow: '0 2px 0 #e5e7eb' }}>{num}</button>
                                    ))}
                                    <button onClick={() => setFoodAmountG(p => p.slice(0, -1) || '0')} style={{ padding: '12px 0', borderRadius: 12, border: 'none', background: '#e5e7eb', fontSize: 20, color: '#333', boxShadow: '0 2px 0 #d1d5db' }}>⌫</button>
                                  </div>
                                ) : (
                                  // 👇 [修改] 分數滾輪區塊：加入 ref, onScroll 與顯示優化
                                  <div style={{ position: 'relative', height: 200, overflow: 'hidden', background: '#fff', borderRadius: 12 }}>
                                    <div style={{ position: 'absolute', top: 75, left: 0, right: 0, height: 50, background: 'rgba(151, 208, 186, 0.2)', borderTop: '1px solid #97d0ba', borderBottom: '1px solid #97d0ba', pointerEvents: 'none', zIndex: 1 }}></div>
                                    <div
                                      ref={gramPickerRef}    // 1. 綁定 ref
                                      onScroll={(e) => {     // 2. 加入滑動監聽
                                        const scrollTop = e.currentTarget.scrollTop;
                                        const index = Math.round(scrollTop / 50);
                                        const target = fractionList[index];
                                        if (target) {
                                          setFoodAmountG(target.value);
                                        }
                                      }}
                                      style={{ height: '100%', overflowY: 'auto', scrollSnapType: 'y mandatory', position: 'relative', zIndex: 2, scrollbarWidth: 'none' }}
                                    >
                                      <div style={{ height: 75 }}></div>
                                      {fractionList.map((item) => (
                                        <div
                                          key={item.label}
                                          onClick={() => {
                                            setFoodAmountG(item.value);
                                            // 3. 點擊自動捲動置中
                                            const index = fractionList.indexOf(item);
                                            if (gramPickerRef.current) {
                                              gramPickerRef.current.scrollTo({ top: index * 50, behavior: 'smooth' });
                                            }
                                          }}
                                          style={{ height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 600, scrollSnapAlign: 'center', color: String(foodAmountG) === item.value ? '#059669' : '#9ca3b8', transition: 'all 0.2s', cursor: 'pointer' }}
                                        >
                                          {item.label}
                                          {/* 4. 顯示對應小數 */}
                                          {String(foodAmountG) === item.value && (
                                            <span style={{ fontSize: 15, color: '#5c9c84', marginLeft: 8, fontWeight: 400 }}>
                                              ({item.value})
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                      <div style={{ height: 75 }}></div>
                                    </div>
                                  </div>
                                )}

                                <button onClick={() => setShowGramModal(false)} style={{ width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', background: '#5c9c84', color: '#fff', fontSize: 18, fontWeight: 700, marginTop: 4 }}>完成</button>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="hint">
                          {selectedFoodDbRow.food}：{selectedFoodDbRow.kcal} kcal / 100g
                        </div>


                        {/* 即時營養資訊卡片 - Food DB 版本 */}
                        {selectedFoodDbRow && foodAmountG && Number(foodAmountG) > 0 && (
                          <div style={{
                            background: 'linear-gradient(135deg, #f0fdf9 0%, #f7fbf8 100%)',
                            borderRadius: 12,
                            padding: '16px',
                            marginTop: 12,
                            marginBottom: 8,
                            border: '1px solid #d1f0e3',
                            boxShadow: '0 2px 8px rgba(151, 208, 186, 0.1)'
                          }}>
                            {/* 標題 */}
                            <div style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: '#5c9c84',
                              marginBottom: 12,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6
                            }}>
                              <span>📊</span>
                              <span>營養資訊預覽（{foodAmountG}g）</span>
                            </div>

                            {/* 熱量 (大字) */}
                            <div style={{
                              textAlign: 'center',
                              marginBottom: 12,
                              paddingBottom: 12,
                              borderBottom: '1px solid #e5f3ed'
                            }}>
                              <div style={{ fontSize: 32, fontWeight: 700, color: '#1f2937', lineHeight: 1 }}>
                                {Math.round(effectiveFoodKcal)}
                                <span style={{ fontSize: 16, fontWeight: 500, color: '#6b7280', marginLeft: 4 }}>kcal</span>
                              </div>
                            </div>

                            {/* 營養素 (P/C/F) 三欄 */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                              {/* 蛋白質 */}
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, fontWeight: 500 }}>蛋白質</div>
                                <div style={{
                                  fontSize: 18,
                                  fontWeight: 700,
                                  color: '#5c9c84',
                                  display: 'flex',
                                  alignItems: 'baseline',
                                  justifyContent: 'center',
                                  gap: 2
                                }}>
                                  {round1((Number(selectedFoodDbRow['protein (g)']) / 100) * Number(foodAmountG))}
                                  <span style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af' }}>g</span>
                                </div>
                              </div>

                              {/* 碳水化合物 */}
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, fontWeight: 500 }}>碳水</div>
                                <div style={{
                                  fontSize: 18,
                                  fontWeight: 700,
                                  color: '#ffbe76',
                                  display: 'flex',
                                  alignItems: 'baseline',
                                  justifyContent: 'center',
                                  gap: 2
                                }}>
                                  {round1((Number(selectedFoodDbRow['carb (g)']) / 100) * Number(foodAmountG))}
                                  <span style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af' }}>g</span>
                                </div>
                              </div>

                              {/* 脂肪 */}
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, fontWeight: 500 }}>脂肪</div>
                                <div style={{
                                  fontSize: 18,
                                  fontWeight: 700,
                                  color: '#ff7979',
                                  display: 'flex',
                                  alignItems: 'baseline',
                                  justifyContent: 'center',
                                  gap: 2
                                }}>
                                  {round1((Number(selectedFoodDbRow['fat (g)']) / 100) * Number(foodAmountG))}
                                  <span style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af' }}>g</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 加入按鈕 */}
                        <button
                          className="primary"
                          onClick={saveMeal}
                          style={{ marginTop: 16, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}
                        >
                          <span>加入記錄</span>
                          {effectiveFoodKcal > 0 && (
                            <span style={{ background: 'rgba(255,255,255,0.25)', padding: '2px 8px', borderRadius: 99, fontSize: 13, fontWeight: 600 }}>
                              {Math.round(effectiveFoodKcal)} kcal
                            </span>
                          )}
                        </button>
                        <button onClick={() => { setSelectedFoodDbRow(null); setFoodAmountG('100'); }} style={{ marginTop: 8 }}>
                          取消選擇
                        </button>
                      </>
                    )}

                    {/* =========================================================
                優化版：智慧快速加入面板 (含捲動、圓形按鈕、完整資訊)
               ========================================================= */}
                    {!foodName.trim() && (
                      <div style={{ marginTop: 16, marginBottom: 16 }}>

                        {/* 1. 分頁切換按鈕 (完全比照上方快速搜尋樣式) */}

                        <div
                          style={{
                            display: 'flex',
                            gap: 8,
                            background: '#f3f4f6',
                            borderRadius: 999,
                            padding: 4,
                            marginBottom: 16,
                            overflow: 'hidden',
                            height: 44,
                            alignItems: 'center',
                          }}
                        >


                          <button
                            type="button"
                            onClick={() => setQuickAddTab('history')}
                            style={{
                              flex: 1,
                              height: 36,
                              padding: '0 10px',
                              border: 'none',
                              borderRadius: 999,
                              background: quickAddTab === 'history' ? '#fff' : 'transparent',
                              color: quickAddTab === 'history' ? 'var(--mint-dark, #5c9c84)' : '#6b7280',
                              boxShadow: quickAddTab === 'history' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                              fontWeight: quickAddTab === 'history' ? 800 : 700,
                              fontSize: 'var(--font-md)',
                              cursor: 'pointer',
                              transition: 'all 0.18s ease',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              lineHeight: 1,
                              whiteSpace: 'nowrap',
                              minWidth: 0,
                            }}
                          >
                            🕒&nbsp;最近紀錄
                          </button>


                          <button
                            type="button"
                            onClick={() => setQuickAddTab('combo')}
                            style={{
                              flex: 1,
                              height: 36,
                              padding: '0 10px',
                              border: 'none',
                              borderRadius: 999,
                              background: quickAddTab === 'combo' ? '#fff' : 'transparent',
                              color: quickAddTab === 'combo' ? 'var(--mint-dark, #5c9c84)' : '#6b7280',
                              boxShadow: quickAddTab === 'combo' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                              fontWeight: quickAddTab === 'combo' ? 800 : 700,
                              fontSize: 'var(--font-md)',
                              cursor: 'pointer',
                              transition: 'all 0.18s ease',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              lineHeight: 1,
                              whiteSpace: 'nowrap',
                              minWidth: 0,
                            }}
                          >
                            ⭐&nbsp;常用組合
                          </button>
                        </div>

                        {/* 2. 內容顯示區 */}
                        <div style={{ minHeight: 100 }}>

                          {/* --- A. 歷史紀錄列表 (橫向滑動) --- */}
                          {quickAddTab === 'history' && (
                            <div>
                              {recentMealsForQuickAdd.length === 0 ? (
                                <div className="hint" style={{ textAlign: 'center', padding: 20 }}>
                                  尚無最近紀錄，快去新增第一筆飲食吧！
                                </div>
                              ) : (
                                <div className="quick-list-scroll-horizontal">
                                  {recentMealsForQuickAdd.map((m, i) => (
                                    <div
                                      key={i}
                                      className="quick-item-card"
                                    >
                                      <div style={{ marginBottom: 8 }}>
                                        <div style={{ fontWeight: 600, color: '#333', fontSize: 'var(--font-sm)' }}>{m.label}</div>
                                        <div style={{ fontSize: 'var(--font-xs)', color: '#999', marginTop: 2 }}>
                                          {m.date} · {m.mealType}
                                        </div>
                                      </div>

                                      {/* 🟢 修改重點：使用 renderPalmAmountText 來顯示帶有食物圖示的份量 */}
                                      <div style={{ fontSize: 'var(--font-xs)', color: '#666', marginBottom: 4, minHeight: 20 }}>
                                        {renderPalmAmountText(m.amountText, m.counts)}
                                      </div>
                                      <div style={{ fontSize: 'var(--font-xs)', color: '#333', fontWeight: 500 }}>
                                        {m.kcal} kcal
                                      </div>
                                      <div style={{ fontSize: 'var(--font-xs)', color: '#666', marginTop: 4 }}>
                                        P: {round1(m.protein || 0)}g · C: {round1(m.carb || 0)}g · F: {round1(m.fat || 0)}g
                                      </div>

                                      <button
                                        type="button"
                                        className="btn-circle-add"
                                        style={{ position: 'absolute', top: 8, right: 8 }}
                                        onClick={() => {
                                          const copied: MealEntry = {
                                            ...m,
                                            id: uuid(),
                                            date: selectedDate,
                                            mealType: formMealType,
                                          };
                                          setMeals((prev) => [...prev, copied]);
                                          showToast('success', `已加入 ${m.label}`);
                                        }}
                                      >
                                        +
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* --- B. 常用組合列表 (橫向滑動) --- */}
                          {quickAddTab === 'combo' && (
                            <div>
                              {combos.length === 0 ? (
                                <div className="hint" style={{ textAlign: 'center', padding: 20 }}>
                                  尚未建立常用組合。<br />
                                  試著在下方選取多個食物後點擊「儲存組合」！
                                </div>
                              ) : (
                                <div className="quick-list-scroll-horizontal">
                                  {combos.map((combo) => {
                                    const totalKcal = combo.items.reduce((sum, item) => sum + item.kcal, 0);
                                    const totalProtein = combo.items.reduce((sum, item) => sum + (item.protein || 0), 0);
                                    const totalCarbs = combo.items.reduce((sum, item) => sum + (item.carb || 0), 0);
                                    const totalFats = combo.items.reduce((sum, item) => sum + (item.fat || 0), 0);

                                    return (
                                      <div
                                        key={combo.id}
                                        className="quick-item-card"
                                      >
                                        <div style={{ marginBottom: 8 }}>
                                          <div style={{ fontWeight: 600, color: '#333', fontSize: 'var(--font-sm)' }}>{combo.name}</div>

                                        </div>

                                        <div style={{ fontSize: 'var(--font-xs)', color: '#333', fontWeight: 500, marginBottom: 4 }}>
                                          約 {totalKcal} kcal
                                        </div>
                                        <div style={{ fontSize: 'var(--font-xs)', color: '#666', marginBottom: 8 }}>
                                          P: {round1(totalProtein)}g · C: {round1(totalCarbs)}g · F: {round1(totalFats)}g
                                        </div>

                                        {/* 組合內容預覽 (折疊式) */}
                                        <details style={{ width: '100%' }}>
                                          <summary style={{ fontSize: 'var(--font-xs)', color: '#999', cursor: 'pointer', listStyle: 'none' }}>
                                            查看內容 ▾
                                          </summary>
                                          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {combo.items.map((item, idx) => (
                                              <div key={idx} style={{
                                                fontSize: 'var(--font-xs)',
                                                background: '#f3f4f6',
                                                padding: '4px 6px',
                                                borderRadius: 4,
                                                color: '#4b5563'
                                              }}>
                                                <div style={{ fontWeight: 600 }}>{item.label}</div>
                                                <div style={{ color: '#6b7280', marginTop: 2 }}>
                                                  {item.kcal} kcal · P: {round1(item.protein || 0)}g · C: {round1(item.carb || 0)}g · F: {round1(item.fat || 0)}g
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </details>

                                        <button
                                          className="btn-circle-add"
                                          style={{ position: 'absolute', top: 8, right: 8 }}
                                          onClick={() => addComboToMeals(combo)}
                                        >
                                          +
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}

                        </div>
                      </div>
                    )}

                    {/* 搜尋結果：選到食物後就收起來 */}
                    {/* 修正：修正條件，確保在沒有選取 Unit/FoodDB 時才顯示搜尋結果列表 */}
                    {/* 搜尋結果：只顯示 Unit Map 或 Food DB 的匹配清單 */}
                    {foodName.trim() &&
                      !selectedUnitFood &&
                      !selectedFoodDbRow &&
                      (foodSearchResults.comboMatches.length > 0 ||  // ✅ 新增：檢查是否有搜到組合
                        foodSearchResults.historyMatches.length > 0 ||
                        foodSearchResults.unitMatches.length > 0 ||
                        foodSearchResults.foodMatches.length > 0) && (
                        <div
                          className="search-results"
                          style={{
                            marginTop: 8,
                            marginBottom: '12px',
                            padding: '8px 8px',
                            borderRadius: 12,
                            background: '#f9fafb',
                            border: '1px solid #e5e7eb',
                          }}
                        >
                          {/* === 🆕 新增區塊：常用組合搜尋結果 === */}
                          {foodSearchResults.comboMatches.length > 0 && (
                            <>
                              <div className="result-title" style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                background: '#fffaf0', // 淡黃色背景區隔
                                padding: '8px 12px',
                                borderRadius: 6,
                                marginBottom: 8,
                                color: '#d97706'
                              }}>
                                <span style={{ fontSize: 18 }}>⭐</span>
                                <span>常用組合 ({foodSearchResults.comboMatches.length})</span>
                              </div>
                              {foodSearchResults.comboMatches.map((combo) => (
                                <div
                                  key={combo.id}
                                  className="list-item clickable"
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '8px 12px',
                                    marginBottom: 6,
                                    borderRadius: 8,
                                    borderLeft: '4px solid #f59e0b', // 橘黃色邊條
                                    background: '#fff',
                                  }}
                                >
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{combo.name}</div>
                                    <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                                      包含 {combo.items.length} 個品項 · 約 {combo.items.reduce((sum, i) => sum + i.kcal, 0)} kcal
                                    </div>
                                  </div>

                                  {/* ⚡ 快速加入區塊 */}
                                  <div style={{
                                    background: '#fff',
                                    borderRadius: 16,
                                    padding: 16,
                                    marginBottom: 12,
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                                  }}>
                                    <h3 style={{
                                      margin: '0 0 12px 0',
                                      fontSize: 14,
                                      color: 'var(--text-sub, #6b7785)',
                                      fontWeight: 600,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 6
                                    }}>
                                      ⚡ 快速加入
                                    </h3>

                                    <button
                                      type="button"
                                      className="primary small"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        addComboToMeals(combo); // 直接呼叫加入組合函式
                                        setFoodName(''); // 清空搜尋
                                      }}
                                      style={{
                                        padding: '6px 10px',
                                        fontSize: 13,
                                        flexShrink: 0,
                                        width: 'auto',
                                        minWidth: 84,
                                        whiteSpace: 'nowrap',
                                        alignSelf: 'center',
                                        background: '#f59e0b', // 按鈕也用橘黃色系區隔
                                        border: 'none'
                                      }}
                                    >
                                      快速加入
                                    </button>
                                  </div> {/* 關閉 ⚡ 快速加入區塊 */}
                                </div>
                              ))}
                              {/* 分隔線 */}
                              {(foodSearchResults.historyMatches.length > 0 ||
                                foodSearchResults.unitMatches.length > 0 ||
                                foodSearchResults.foodMatches.length > 0) && (
                                  <div style={{ height: 1, background: '#e5e7eb', margin: '12px 0' }} />
                                )}
                            </>
                          )}
                          {/* 🆕 歷史記錄搜尋結果 */}
                          {foodSearchResults.historyMatches.length > 0 && (
                            <>

                              <div className="result-title" style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                background: '#f0f9ff',
                                padding: '8px 12px',
                                borderRadius: 6,
                                marginBottom: 8,
                              }}>
                                <span style={{ fontSize: 18 }}>📝</span>
                                <span>我的歷史紀錄 ({foodSearchResults.historyMatches.length})</span>
                              </div>
                              {foodSearchResults.historyMatches.map((m, i) => (
                                <div
                                  key={i}
                                  className="list-item clickable"
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '8px 12px',
                                    marginBottom: 6,
                                    borderRadius: 8,
                                    borderLeft: '4px solid #3b82f6',
                                    background: '#fff',
                                    transition: 'all 0.2s',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#eff6ff';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = '#fff';
                                  }}
                                >
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{m.label}</div>
                                    <div
                                      className="sub"
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        flexWrap: 'wrap',
                                        fontSize: 15,
                                      }}
                                    >
                                      <span
                                        style={{
                                          padding: '2px 8px',
                                          borderRadius: 999,
                                          background: '#3b82f6',
                                          color: '#fff',
                                          fontSize: 10,
                                          fontWeight: 600,
                                        }}
                                      >
                                        歷史
                                      </span>
                                      {m.amountText && <span>{m.amountText}</span>}
                                      <span>{m.kcal} kcal</span>
                                      {m.protein > 0 && <span>P: {round1(m.protein)}g</span>}
                                      {m.carb > 0 && <span>C: {round1(m.carb)}g</span>}
                                      {m.fat > 0 && <span>F: {round1(m.fat)}g</span>}
                                    </div>
                                    <div
                                      className="sub"
                                      style={{ fontSize: 11, color: '#999', marginTop: 2, whiteSpace: 'nowrap' }}
                                    >
                                      最近記錄：{m.date} · {m.mealType}
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    className="primary small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const copied: MealEntry = {
                                        ...m,
                                        id: uuid(),
                                        date: selectedDate,
                                        mealType: formMealType,
                                      };
                                      setMeals((prev) => [...prev, copied]);
                                      showToast('success', `已加入 ${m.label}`);
                                      setFoodName('');
                                    }}
                                    style={{
                                      padding: '6px 10px',
                                      fontSize: 13,
                                      flexShrink: 0,
                                      width: 'auto',          // 🟢 關鍵：不要吃掉整行
                                      minWidth: 84,
                                      whiteSpace: 'nowrap',
                                      alignSelf: 'center',
                                    }}
                                  >
                                    快速加入
                                  </button>
                                </div>
                              ))}


                              {/* 分隔線：只有當歷史記錄後面還有其他搜尋結果時才顯示 */}
                              {foodSearchResults.historyMatches.length > 0 &&
                                (foodSearchResults.unitMatches.length > 0 ||
                                  foodSearchResults.foodMatches.length > 0) && (
                                  <div style={{
                                    height: 1,
                                    background: '#e5e7eb',
                                    margin: '12px 0'
                                  }} />
                                )}
                            </>
                          )}

                          {/* === A：Unit_Map 結果優化 (份量代換) === */}
                          {foodSearchResults.unitMatches.length > 0 && (
                            <>
                              <div className="result-title" style={{ fontSize: 13, color: '#888', marginBottom: 8, paddingLeft: 4 }}>
                                通用份量代換
                              </div>
                              {foodSearchResults.unitMatches.map((u, i) => (
                                <div
                                  key={i}
                                  className="list-item clickable"
                                  onClick={() => {
                                    setSelectedUnitFood(u);
                                    setSelectedFoodDbRow(null);
                                    setFallbackType('');
                                    setFoodName(u.Food ?? '');
                                  }}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '12px 12px 12px 16px',
                                    marginBottom: 8,
                                    background: selectedUnitFood === u ? '#f0fdf9' : '#fff',
                                    border: selectedUnitFood === u ? '1px solid #97d0ba' : '1px solid #f3f4f6',
                                    borderRadius: '12px',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                                    transition: 'all 0.1s active',
                                    cursor: 'pointer'
                                  }}
                                  onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
                                  onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                >
                                  {/* 左側：名稱與描述 */}
                                  <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                                    <div style={{ fontWeight: 600, color: '#1f2937', fontSize: 15, marginBottom: 4, wordBreak: 'break-word' }}>
                                      {u.Food}
                                    </div>
                                    <div style={{ fontSize: 15, color: '#6b7280', lineHeight: 1.4 }}>
                                      單位: {u.Unit} ({u.ServingsPerUnit} 份)
                                      {u.Type && <span style={{ opacity: 0.8 }}> · {u.Type}</span>}
                                      {/* 這裡加入 Notes 顯示，並用深一點的顏色強調 */}
                                      {u.Notes && <span style={{ color: '#d97706', fontWeight: 500 }}> · {u.Notes}</span>}
                                    </div>
                                  </div>

                                  {/* 右側：熱量與圓形按鈕 */}
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, gap: 6 }}>
                                    <div style={{ textAlign: 'right' }}>
                                      <div style={{ color: '#97d0ba', fontWeight: 700, fontSize: 15, lineHeight: 1 }}>
                                        {u.Kcal_per_serv ? Math.round(Number(u.Kcal_per_serv)) : '?'}
                                      </div>
                                      <div style={{ fontSize: 14, color: '#9ca3af', marginTop: 2 }}>
                                        kcal / 份
                                      </div>
                                    </div>

                                    <div style={{
                                      width: 28,
                                      height: 28,
                                      borderRadius: '50%',
                                      background: selectedUnitFood === u ? '#97d0ba' : '#f0fdf9',
                                      border: '1px solid #97d0ba',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: selectedUnitFood === u ? '#fff' : '#5c9c84',
                                      fontWeight: 'bold',
                                      fontSize: 16,
                                      transition: 'all 0.2s'
                                    }}>
                                      {selectedUnitFood === u ? '✓' : '+'}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </>
                          )}

                          {/* === B：Food_DB 結果優化 (精準資料) === */}
                          {foodSearchResults.foodMatches.length > 0 && (
                            <>
                              <div className="result-title" style={{ fontSize: 13, color: '#888', marginBottom: 8, paddingLeft: 4 }}>
                                精準資料庫 (每100g)
                              </div>
                              {foodSearchResults.foodMatches.map((f, i) => (
                                <div
                                  key={i}
                                  className="list-item clickable"
                                  onClick={() => {
                                    setSelectedFoodDbRow(f);
                                    setSelectedUnitFood(null);
                                    setFallbackType('');
                                    setFoodName(f.food ?? '');
                                  }}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '12px 12px 12px 16px',
                                    marginBottom: 8,
                                    background: selectedFoodDbRow === f ? '#f0fdf9' : '#fff',
                                    border: selectedFoodDbRow === f ? '1px solid #97d0ba' : '1px solid #f3f4f6',
                                    borderRadius: '12px',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                                    transition: 'all 0.1s active',
                                    cursor: 'pointer'
                                  }}
                                  onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
                                  onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                >
                                  {/* 左側：名稱與描述 */}
                                  <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                                    <div style={{ fontWeight: 600, color: '#1f2937', fontSize: 15, marginBottom: 4, wordBreak: 'break-word' }}>
                                      {f.food}
                                    </div>
                                    <div style={{ fontSize: 15, color: '#6b7280' }}>
                                      精準秤重估算
                                    </div>
                                  </div>

                                  {/* 右側：熱量與圓形按鈕 */}
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, gap: 6 }}>
                                    <div style={{ textAlign: 'right' }}>
                                      <div style={{ color: '#97d0ba', fontWeight: 700, fontSize: 15, lineHeight: 1 }}>
                                        {Math.round(Number(f.kcal))}
                                      </div>
                                      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>
                                        kcal / 100g
                                      </div>
                                    </div>

                                    <div style={{
                                      width: 28,
                                      height: 28,
                                      borderRadius: '50%',
                                      background: selectedFoodDbRow === f ? '#97d0ba' : '#f0fdf9',
                                      border: '1px solid #97d0ba',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: selectedFoodDbRow === f ? '#fff' : '#5c9c84',
                                      fontWeight: 'bold',
                                      fontSize: 16,
                                      transition: 'all 0.2s'
                                    }}>
                                      {selectedFoodDbRow === f ? '✓' : '+'}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      )}

                    {/* 🆕 獨立的類別/估算模式區塊 (只要未選取精準食物，且有輸入名稱，就顯示此備援區塊) */}
                    {foodName.trim() &&
                      !selectedUnitFood &&
                      !selectedFoodDbRow &&
                      (
                        <div className="type-fallback-card card" style={{ padding: '12px', background: '#fbfdfc', border: '1px solid #e3eee8', marginTop: 0 }}>
                          <h3 style={{ marginTop: 0, fontSize: 16 }}>類別/估算模式</h3>

                          {/* 沒找到精準資料時的提示 */}
                          {foodSearchResults.unitMatches.length === 0 &&
                            foodSearchResults.foodMatches.length === 0 && (
                              <div className="hint" style={{ marginBottom: '12px' }}>
                                找不到精準資料，請利用以下類別代換或自訂熱量估算。
                              </div>
                            )}

                          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#374151' }}>
                            食物類別
                          </label>
                          <BigSelect
                            options={[
                              { value: '其他類', label: '其他類 (自訂 P/C/F)' },
                              { value: '自定義熱量', label: '自定義熱量 (僅 Kcal)' },
                              ...typeOptions.map((t) => ({ value: t, label: t })),
                            ]}
                            value={fallbackType}
                            onChange={(v) => {
                              setFallbackType(v);
                              setFallbackServings('1'); // ✅ 優化：切換類別時，份數預設為 1
                              setFallbackQty('');
                              setFallbackProtPerServ('');
                              setFallbackCarbPerServ('');
                              setFallbackFatPerServ('');
                              setFallbackKcalPerServ('');
                            }}
                            placeholder="請選擇食物類型或估算模式"
                            width="100%"
                          />

                          {/* C1：一般類型 (保持原樣，略過不貼，請保留您原本的 C1 程式碼) */}
                          {/* C1：一般類型 */}
                          {fallbackType &&
                            fallbackType !== '其他類' &&
                            fallbackType !== '自定義熱量' && (
                              <>
                                <div className="hint" style={{ marginTop: '8px' }}>
                                  從類別估算：{fallbackType}
                                </div>

                                {/* ✅ 新增：顯示 Type Table 的份量資訊 */}
                                {currentTypeRow && (
                                  <div className="hint" style={{ marginTop: '0', marginBottom: '8px' }}>
                                    一份約 {currentTypeRow['Weight per serving (g)']} g
                                    {currentTypeRow.note && ` (${currentTypeRow.note})`}
                                  </div>
                                )}

                                {visualReference && (
                                  <div className="hint">
                                    視覺參照：{visualReference}
                                  </div>
                                )}



                                {/* 🟢 修改：原本是 <label> 夾 input，現在改用與「其他類」相同的彈窗觸發按鈕 */}
                                <div style={{
                                  background: '#fff',
                                  padding: '16px',
                                  borderRadius: 12,
                                  border: '1px solid #e9ecef',
                                  marginBottom: 12,
                                  marginTop: 12
                                }}>
                                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#374151', fontSize: 'var(--font-xs)' }}>
                                    份量 (份)
                                  </label>

                                  {/* 🟢 修改：套用 Class */}
                                  <div
                                    className="portion-input-trigger"
                                    onClick={() => {
                                      setShowServingsModal(true);
                                      setFallbackServings('');
                                    }}
                                  >
                                    {fallbackServings || '1'}
                                    <span className="portion-unit-text">份</span>
                                  </div>
                                </div>

                                {/* 移除舊有的 input 與 DEC/FRAC 切換按鈕，因為 Modal 裡已經有了 */}
                              </>
                            )}


                          {/* C2：其他類 (自訂 P/C/F) - 針對您的需求進行優化 */}
                          {fallbackType === '其他類' && (
                            <div style={{ marginTop: 12 }}>

                              {/* 1. 份量輸入 (優化：點擊彈出整合式鍵盤) */}
                              <div style={{
                                background: '#fff',
                                padding: '16px',
                                borderRadius: 12,
                                border: '1px solid #e9ecef',
                                marginBottom: 12
                              }}>
                                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#374151', fontSize: 14 }}>
                                  份量
                                </label>

                                {/* 觸發按鈕 (唯讀) */}
                                <div
                                  className="portion-input-trigger"
                                  onClick={() => {
                                    setShowServingsModal(true);
                                    setFallbackServings('');
                                  }}
                                >
                                  {fallbackServings || '1'}
                                  <span className="portion-unit-text">份</span>
                                </div>
                                {/* === 份量輸入彈窗 (Servings Modal) === */}
                                {showServingsModal && (
                                  <div
                                    className="modal-backdrop"
                                    style={{
                                      position: 'fixed',
                                      top: 0,
                                      left: 0,
                                      right: 0,
                                      bottom: 0,
                                      background: 'rgba(0,0,0,0.4)',
                                      zIndex: 100
                                    }}
                                    onClick={() => setShowServingsModal(false)}
                                  >
                                    <div
                                      style={{
                                        position: 'absolute',
                                        bottom: 'calc(70px + env(safe-area-inset-bottom))',
                                        left: 0,
                                        right: 0,
                                        maxWidth: 420,
                                        margin: '0 auto',
                                        background: '#f0f2f5',
                                        borderTopLeftRadius: 20,
                                        borderTopRightRadius: 20,
                                        padding: 20,
                                        boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 16,
                                        animation: 'slideInUp 0.2s ease-out'
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {/* 1. 頂部控制列：標題 + Tab 切換 */}
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ fontWeight: 600, color: '#666', fontSize: 15 }}>輸入份量</span>

                                        {/* iOS 風格分段控制器 (Segmented Control) */}
                                        <div style={{
                                          display: 'flex', background: '#e5e7eb', padding: 3, borderRadius: 8,
                                        }}>
                                          <button
                                            onClick={() => setServingsTab('dec')}
                                            style={{
                                              padding: '4px 16px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 600,
                                              background: servingsTab === 'dec' ? '#fff' : 'transparent',
                                              color: servingsTab === 'dec' ? '#333' : '#666',
                                              boxShadow: servingsTab === 'dec' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                              transition: 'all 0.2s', cursor: 'pointer'
                                            }}
                                          >
                                            小數
                                          </button>
                                          <button
                                            onClick={() => setServingsTab('frac')}
                                            style={{
                                              padding: '4px 16px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 600,
                                              background: servingsTab === 'frac' ? '#fff' : 'transparent',
                                              color: servingsTab === 'frac' ? '#333' : '#666',
                                              boxShadow: servingsTab === 'frac' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                              transition: 'all 0.2s', cursor: 'pointer'
                                            }}
                                          >
                                            分數
                                          </button>
                                        </div>
                                      </div>

                                      {/* 2. 即時數值顯示區 (Display) */}
                                      <div style={{
                                        background: '#fff', borderRadius: 12, padding: '12px',
                                        textAlign: 'center', fontSize: 28, fontWeight: 700, color: '#333',
                                        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb'
                                      }}>
                                        {fallbackServings || '0'}
                                      </div>

                                      {/* 3. 內容區：根據 Tab 切換顯示 NumPad 或 Picker */}

                                      {/* === Tab A: 數字鍵盤 (NumPad) === */}
                                      {servingsTab === 'dec' && (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0].map((num) => (
                                            <button
                                              key={num}
                                              type="button"
                                              onClick={() => {
                                                if (num === '.') {
                                                  if (!fallbackServings.includes('.')) setFallbackServings(prev => prev + '.');
                                                } else {
                                                  // 如果目前是 0 或空，直接取代；否則串接
                                                  setFallbackServings(prev => (prev === '0' || prev === '' ? String(num) : prev + num));
                                                }
                                              }}
                                              style={{
                                                padding: '12px 0', borderRadius: 12, border: 'none', background: '#fff',
                                                fontSize: 22, fontWeight: 600, color: '#333', boxShadow: '0 2px 0 #e5e7eb',
                                                cursor: 'pointer'
                                              }}
                                            >
                                              {num}
                                            </button>
                                          ))}
                                          {/* Backspace */}
                                          <button
                                            type="button"
                                            onClick={() => setFallbackServings(prev => prev.slice(0, -1) || '0')}
                                            style={{
                                              padding: '12px 0', borderRadius: 12, border: 'none', background: '#e5e7eb',
                                              fontSize: 20, color: '#333', boxShadow: '0 2px 0 #d1d5db', cursor: 'pointer'
                                            }}
                                          >
                                            ⌫
                                          </button>
                                        </div>
                                      )}

                                      {/* === Tab B: 分數滾輪 (Fraction Picker) === */}
                                      {servingsTab === 'frac' && (
                                        <div style={{ position: 'relative', height: 200, overflow: 'hidden', background: '#fff', borderRadius: 12 }}>

                                          {/* 綠色選取框 (Highlight Bar) */}
                                          <div style={{
                                            position: 'absolute', top: 75, left: 0, right: 0, height: 50,
                                            background: 'rgba(151, 208, 186, 0.2)', borderTop: '1px solid #97d0ba', borderBottom: '1px solid #97d0ba',
                                            pointerEvents: 'none', zIndex: 1
                                          }}></div>

                                          {/* 滾動列表 */}
                                          <div
                                            ref={servingsPickerRef}
                                            style={{
                                              height: '100%', overflowY: 'auto', scrollSnapType: 'y mandatory',
                                              position: 'relative', zIndex: 2, scrollbarWidth: 'none'
                                            }}
                                            onScroll={(e) => {
                                              // 簡單的防抖動或直接計算
                                              const scrollTop = e.currentTarget.scrollTop;
                                              const index = Math.round(scrollTop / 50);
                                              const target = fractionList[index];
                                              // 滑動時即時更新數值
                                              if (target) {
                                                // 這裡要注意：如果不希望滑動時一直改變上面的 Display 數值導致跳動，
                                                // 可以只在 scroll 結束時更新，但為了簡單即時回饋，這裡直接更新。
                                                setFallbackServings(target.value);
                                              }
                                            }}
                                          >
                                            <div style={{ height: 75 }}></div> {/* Top Spacer */}

                                            {fractionList.map((item) => (
                                              <div
                                                key={item.label}
                                                onClick={() => {
                                                  setFallbackServings(item.value);
                                                  // 點擊後滾動到該位置
                                                  const index = fractionList.indexOf(item);
                                                  if (servingsPickerRef.current) {
                                                    servingsPickerRef.current.scrollTo({ top: index * 50, behavior: 'smooth' });
                                                  }
                                                }}
                                                style={{
                                                  height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                  fontSize: 20, fontWeight: 600, scrollSnapAlign: 'center', cursor: 'pointer',
                                                  color: String(fallbackServings) === item.value ? '#059669' : '#9ca3b8',
                                                  transition: 'all 0.2s'
                                                }}
                                              >
                                                {item.label}
                                                {/* 如果數值相同，顯示數值對照 (例: 1/2 = 0.5) */}
                                                {String(fallbackServings) === item.value && (
                                                  <span style={{ fontSize: 15, color: '#5c9c84', marginLeft: 8, fontWeight: 400 }}>
                                                    ({item.value})
                                                  </span>
                                                )}
                                              </div>
                                            ))}

                                            <div style={{ height: 75 }}></div> {/* Bottom Spacer */}
                                          </div>
                                        </div>
                                      )}

                                      {/* 完成按鈕 */}
                                      <button
                                        type="button"
                                        onClick={() => setShowServingsModal(false)}
                                        style={{
                                          width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
                                          background: '#5c9c84', color: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer',
                                          marginTop: 4
                                        }}
                                      >
                                        完成
                                      </button>

                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* 2. 定義「一份」的內容 */}
                              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: '#64748b', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span>⚙️ 設定「1 份」的營養素</span>
                                </div>

                                {/* A. 參考單位 (優化：點擊彈出鍵盤與滾輪) */}
                                <div style={{ marginBottom: 16 }}>
                                  <div style={{ fontSize: 14, color: '#666', marginBottom: 6 }}>
                                    定義 1 份 = 多少?
                                  </div>

                                  <div style={{ display: 'flex', gap: 10 }}>

                                    {/* 左側：數量觸發鈕 (點擊跳出數字鍵盤) */}
                                    <div
                                      onClick={() => {
                                        setShowQtyPad(true);
                                        setFallbackQty(''); // 🟢 開啟時清空，方便直接輸入
                                      }}
                                      style={{
                                        flex: 1,
                                        height: 50,
                                        background: '#fff',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: 10,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: 20,
                                        fontWeight: 700,
                                        color: fallbackQty ? '#333' : '#94a3b8',
                                        cursor: 'pointer',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                      }}
                                    >
                                      {fallbackQty || '輸入數量'}
                                    </div>

                                    {/* 右側：單位觸發鈕 (點擊跳出滾輪選擇) */}
                                    <div
                                      onClick={() => setShowUnitPicker(true)}
                                      style={{
                                        flex: 1,
                                        height: 50,
                                        background: '#fff',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: 10,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: 18,
                                        fontWeight: 500,
                                        color: fallbackUnitLabel ? '#059669' : '#94a3b8',
                                        cursor: 'pointer',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                      }}
                                    >
                                      {fallbackUnitLabel || '選擇單位'}
                                      <span style={{ fontSize: 15, marginLeft: 6, color: '#cbd5e1' }}>▼</span>
                                    </div>
                                  </div>

                                  {/* --- 彈窗 1：數字鍵盤 (Calculator NumPad) --- */}
                                  {showQtyPad && (
                                    <div
                                      className="modal-backdrop"
                                      style={{
                                        position: 'fixed',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        background: 'rgba(0,0,0,0.4)',
                                        zIndex: 100
                                      }}
                                      onClick={() => setShowQtyPad(false)}
                                    >
                                      <div
                                        style={{
                                          position: 'absolute',
                                          bottom: 'calc(70px + env(safe-area-inset-bottom))',
                                          left: 0,
                                          right: 0,
                                          maxWidth: 420,
                                          margin: '0 auto',
                                          background: '#f0f2f5',
                                          borderTopLeftRadius: 20,
                                          borderTopRightRadius: 20,
                                          padding: 20,
                                          boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
                                          animation: 'slideInUp 0.2s ease-out'
                                        }}
                                        onClick={(e) => e.stopPropagation()} // 防止點擊內部關閉
                                      >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
                                          <span style={{ fontSize: 16, fontWeight: 600, color: '#666' }}>輸入數量</span>
                                          <span style={{ fontSize: 24, fontWeight: 700, color: '#333' }}>{fallbackQty || '0'}</span>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0].map((num) => (
                                            <button
                                              key={num}
                                              type="button"
                                              onClick={() => {
                                                if (num === '.') {
                                                  if (!fallbackQty.includes('.')) setFallbackQty(prev => prev + '.');
                                                } else {
                                                  setFallbackQty(prev => (prev === '0' ? String(num) : prev + num));
                                                }
                                              }}
                                              style={{
                                                padding: '16px 0', borderRadius: 12, border: 'none', background: '#fff',
                                                fontSize: 24, fontWeight: 600, color: '#333', boxShadow: '0 2px 0 #e5e7eb',
                                                cursor: 'pointer'
                                              }}
                                            >
                                              {num}
                                            </button>
                                          ))}

                                          {/* 倒退鍵 (Backspace) */}
                                          <button
                                            type="button"
                                            onClick={() => setFallbackQty(prev => prev.slice(0, -1))}
                                            style={{
                                              padding: '16px 0', borderRadius: 12, border: 'none', background: '#e5e7eb',
                                              fontSize: 20, color: '#333', boxShadow: '0 2px 0 #d1d5db', cursor: 'pointer'
                                            }}
                                          >
                                            ⌫
                                          </button>
                                        </div>

                                        <button
                                          type="button"
                                          onClick={() => setShowQtyPad(false)}
                                          style={{
                                            width: '100%', marginTop: 12, padding: '14px 0', borderRadius: 12, border: 'none',
                                            background: '#5c9c84', color: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer'
                                          }}
                                        >
                                          完成
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                  {/* 🆕 補回遺失的：數量輸入彈窗 (Qty Pad) */}
                                  {showQtyPad && (
                                    <div
                                      className="modal-backdrop"
                                      style={{
                                        position: 'fixed',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        background: 'rgba(0,0,0,0.4)',
                                        zIndex: 100
                                      }}
                                      onClick={() => setShowQtyPad(false)}
                                    >
                                      <div
                                        style={{
                                          position: 'absolute',
                                          bottom: 'calc(70px + env(safe-area-inset-bottom))',
                                          left: 0,
                                          right: 0,
                                          maxWidth: 420,
                                          margin: '0 auto',
                                          background: '#f0f2f5',
                                          borderTopLeftRadius: 20,
                                          borderTopRightRadius: 20,
                                          padding: 20,
                                          boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          gap: 16,
                                          animation: 'slideInUp 0.2s ease-out'
                                        }}

                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {/* 頂部列：標題 + Tab 切換 */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                          <span style={{ fontWeight: 600, color: '#666', fontSize: 15 }}>輸入數量</span>

                                          <div style={{ display: 'flex', background: '#e5e7eb', padding: 3, borderRadius: 8 }}>
                                            <button onClick={() => setInputTab('dec')} style={{ padding: '4px 16px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 600, background: inputTab === 'dec' ? '#fff' : 'transparent', color: inputTab === 'dec' ? '#333' : '#666', boxShadow: inputTab === 'dec' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}>小數</button>
                                            <button onClick={() => setInputTab('frac')} style={{ padding: '4px 16px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 600, background: inputTab === 'frac' ? '#fff' : 'transparent', color: inputTab === 'frac' ? '#333' : '#666', boxShadow: inputTab === 'frac' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}>分數</button>
                                          </div>
                                        </div>

                                        {/* 數值顯示 */}
                                        <div style={{ background: '#fff', borderRadius: 12, padding: '12px', textAlign: 'center', fontSize: 28, fontWeight: 700, color: '#333', border: '1px solid #e5e7eb' }}>
                                          {fallbackQty || '0'}
                                        </div>

                                        {/* 內容區：小數鍵盤 vs 分數滾輪 */}
                                        {inputTab === 'dec' ? (
                                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0].map((num) => (
                                              <button
                                                key={num}
                                                onClick={() => {
                                                  if (num === '.') {
                                                    if (!fallbackQty.includes('.')) setFallbackQty(prev => prev + '.');
                                                  } else {
                                                    setFallbackQty(prev => (prev === '0' || prev === '' ? String(num) : prev + num));
                                                  }
                                                }}
                                                style={{
                                                  padding: '12px 0', borderRadius: 12, border: 'none', background: '#fff',
                                                  fontSize: 22, fontWeight: 600, color: '#333', boxShadow: '0 2px 0 #e5e7eb'
                                                }}
                                              >
                                                {num}
                                              </button>
                                            ))}
                                            <button onClick={() => setFallbackQty(prev => prev.slice(0, -1))} style={{ padding: '12px 0', borderRadius: 12, border: 'none', background: '#e5e7eb', fontSize: 20, color: '#333', boxShadow: '0 2px 0 #d1d5db' }}>⌫</button>
                                          </div>
                                        ) : (
                                          <div style={{ position: 'relative', height: 200, overflow: 'hidden', background: '#fff', borderRadius: 12 }}>
                                            {/* Highlight Bar */}
                                            <div style={{ position: 'absolute', top: 75, left: 0, right: 0, height: 50, background: 'rgba(151, 208, 186, 0.2)', borderTop: '1px solid #97d0ba', borderBottom: '1px solid #97d0ba', pointerEvents: 'none', zIndex: 1 }}></div>

                                            {/* Scroll List */}
                                            <div style={{ height: '100%', overflowY: 'auto', scrollSnapType: 'y mandatory', position: 'relative', zIndex: 2, scrollbarWidth: 'none' }}>
                                              <div style={{ height: 75 }}></div>
                                              {fractionList.map((item) => (
                                                <div key={item.label} onClick={() => setFallbackQty(item.value)} style={{ height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 600, scrollSnapAlign: 'center', color: String(fallbackQty) === item.value ? '#059669' : '#9ca3b8' }}>
                                                  {item.label}
                                                </div>
                                              ))}
                                              <div style={{ height: 75 }}></div>
                                            </div>
                                          </div>
                                        )}

                                        <button
                                          onClick={() => setShowQtyPad(false)}
                                          style={{
                                            width: '100%', marginTop: 12, padding: '14px 0', borderRadius: 12, border: 'none',
                                            background: '#5c9c84', color: '#fff', fontSize: 18, fontWeight: 700
                                          }}
                                        >
                                          完成
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {/* --- 彈窗 2：單位選擇器 (iOS Wheel Picker Style) --- */}
                                  {showUnitPicker && (
                                    <div
                                      className="modal-backdrop"
                                      style={{
                                        position: 'fixed',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        background: 'rgba(0,0,0,0.5)',
                                        zIndex: 100
                                      }}
                                      onClick={() => setShowUnitPicker(false)}
                                    >
                                      <div
                                        style={{
                                          position: 'absolute',
                                          bottom: 'calc(70px + env(safe-area-inset-bottom))',
                                          left: 0,
                                          right: 0,
                                          maxWidth: 420,
                                          margin: '0 auto',
                                          background: '#fff',
                                          borderTopLeftRadius: 20,
                                          borderTopRightRadius: 20,
                                          display: 'flex',
                                          flexDirection: 'column',
                                          paddingBottom: 20, // 底部留白 (適應 iPhone Home Bar)
                                          boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
                                          animation: 'slideInUp 0.2s ease-out'
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {/* 1. 標題列 (Flexbox 修正重疊問題) */}
                                        <div style={{
                                          height: 50,
                                          borderBottom: '1px solid #eee',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          padding: '0 16px'
                                        }}>
                                          {/* 左側佔位，為了讓標題置中 */}
                                          <div style={{ width: 40 }}></div>

                                          <span style={{ fontWeight: 700, fontSize: 16, color: '#333' }}>選擇單位</span>

                                          <button
                                            onClick={() => setShowUnitPicker(false)}
                                            style={{
                                              width: 40,
                                              background: 'transparent',
                                              border: 'none',
                                              color: '#5c9c84',
                                              fontWeight: 600,
                                              fontSize: 15,
                                              cursor: 'pointer',
                                              textAlign: 'right',
                                              padding: 0
                                            }}
                                          >
                                            完成
                                          </button>
                                        </div>

                                        {/* 2. 滾輪選單區域 */}
                                        <div style={{ position: 'relative', height: 250, overflow: 'hidden', background: '#fff' }}>

                                          {/* [背景層] 固定在中間的綠色長條 (Highlight Bar) */}
                                          <div style={{
                                            position: 'absolute',
                                            top: 100, // (250 - 50) / 2
                                            left: 0,
                                            right: 0,
                                            height: 50,
                                            background: 'rgba(151, 208, 186, 0.2)', // 淡淡的薄荷綠
                                            borderTop: '1px solid #97d0ba',
                                            borderBottom: '1px solid #97d0ba',
                                            pointerEvents: 'none', // 讓點擊事件穿透到底下的捲動層
                                            zIndex: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'flex-end',
                                            paddingRight: 32
                                          }}>
                                            {/* 可選：在選取框右側顯示小勾勾 */}
                                            <span style={{ color: '#5c9c84', fontWeight: 'bold' }}>✓</span>
                                          </div>

                                          {/* [前景層] 可捲動的列表 */}
                                          <div
                                            ref={unitPickerRef}
                                            onScroll={(e) => {
                                              // 即時計算停在中間的項目
                                              const scrollTop = e.currentTarget.scrollTop;
                                              const index = Math.round(scrollTop / 50); // 50px 是項目高度
                                              const target = unitList[index];
                                              // 如果計算出的單位存在且不同，就更新
                                              if (target && target !== fallbackUnitLabel) {
                                                setFallbackUnitLabel(target);
                                              }
                                            }}
                                            style={{
                                              height: '100%',
                                              overflowY: 'auto',
                                              scrollSnapType: 'y mandatory', // 強制對齊
                                              zIndex: 2,
                                              position: 'relative',
                                              // 隱藏捲軸
                                              scrollbarWidth: 'none',
                                              msOverflowStyle: 'none'
                                            }}
                                          >
                                            {/* 上方留白 (讓第一個項目能捲到中間) */}
                                            <div style={{ height: 100 }}></div>

                                            {unitList.map((u) => (
                                              <div
                                                key={u}
                                                onClick={() => {
                                                  const index = unitList.indexOf(u);
                                                  if (unitPickerRef.current) {
                                                    unitPickerRef.current.scrollTo({
                                                      top: index * 50,
                                                      behavior: 'smooth'
                                                    });
                                                  }
                                                }}
                                                style={{
                                                  height: 50,
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  fontSize: 18,
                                                  // ✅ 修正 1：固定字體粗細，消除寬度變化造成的左右晃動
                                                  fontWeight: 600,
                                                  // ✅ 修正 2：僅透過顏色區分選中狀態
                                                  color: fallbackUnitLabel === u ? '#1f2937' : '#9ca3af',
                                                  // ✅ 修正 3：移除 transform 縮放與 transition 動畫，讓滑動更跟手、更穩
                                                  opacity: fallbackUnitLabel === u ? 1 : 0.5,
                                                  scrollSnapAlign: 'center',
                                                  cursor: 'pointer'
                                                }}
                                              >
                                                {u}
                                              </div>
                                            ))}

                                            {/* 下方留白 (讓最後一個項目能捲到中間) */}
                                            <div style={{ height: 100 }}></div>

                                            <style>{`
                     div::-webkit-scrollbar { display: none; }
                   `}</style>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                </div>
                                {/* B. 營養素輸入 (改為點擊彈出鍵盤) */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                  {/* Protein */}
                                  <div
                                    className="macro-input-card protein"
                                    onClick={() => {
                                      setEditingMacro('p');
                                      setFallbackProtPerServ(''); // 開啟時清空，方便直接輸入
                                    }}
                                    style={{ cursor: 'pointer' }}
                                  >
                                    <div className="macro-input-label protein">蛋白質 P</div>
                                    <div className="macro-input-field">
                                      {fallbackProtPerServ || '0'}
                                    </div>
                                    <div className="macro-unit-text">g / 份</div>
                                  </div>

                                  {/* Carb */}
                                  <div
                                    className="macro-input-card carb"
                                    onClick={() => {
                                      setEditingMacro('c');
                                      setFallbackCarbPerServ('');
                                    }}
                                    style={{ cursor: 'pointer' }}
                                  >
                                    <div className="macro-input-label carb">碳水 C</div>
                                    <div className="macro-input-field">
                                      {fallbackCarbPerServ || '0'}
                                    </div>
                                    <div className="macro-unit-text">g / 份</div>
                                  </div>

                                  {/* Fat */}
                                  <div
                                    className="macro-input-card fat"
                                    onClick={() => {
                                      setEditingMacro('f');
                                      setFallbackFatPerServ('');
                                    }}
                                    style={{ cursor: 'pointer' }}
                                  >
                                    <div className="macro-input-label fat">脂肪 F</div>
                                    <div className="macro-input-field">
                                      {fallbackFatPerServ || '0'}
                                    </div>
                                    <div className="macro-unit-text">g / 份</div>
                                  </div>
                                </div>

                                {/* 👇 [新增] P/C/F 專用的數字鍵盤 Modal */}
                                {editingMacro && (
                                  <div
                                    className="modal-backdrop"
                                    style={{
                                      position: 'fixed',
                                      top: 0,
                                      left: 0,
                                      right: 0,
                                      bottom: 0,
                                      background: 'rgba(0,0,0,0.4)',
                                      zIndex: 100
                                    }}
                                    onClick={() => setEditingMacro(null)}
                                  >
                                    <div
                                      style={{
                                        position: 'absolute',
                                        bottom: 'calc(70px + env(safe-area-inset-bottom))',
                                        left: 0,
                                        right: 0,
                                        maxWidth: 420,
                                        margin: '0 auto',
                                        background: '#f0f2f5',
                                        borderTopLeftRadius: 20,
                                        borderTopRightRadius: 20,
                                        padding: 20,
                                        boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
                                        animation: 'slideInUp 0.2s ease-out'
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
                                        <span style={{ fontSize: 16, fontWeight: 600, color: '#666' }}>
                                          輸入{editingMacro === 'p' ? '蛋白質' : editingMacro === 'c' ? '碳水' : '脂肪'}
                                        </span>
                                        <span style={{ fontSize: 24, fontWeight: 700, color: '#333' }}>
                                          {editingMacro === 'p' ? (fallbackProtPerServ || '0') : editingMacro === 'c' ? (fallbackCarbPerServ || '0') : (fallbackFatPerServ || '0')}
                                        </span>
                                      </div>

                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0].map((num) => (
                                          <button
                                            key={num}
                                            type="button"
                                            onClick={() => {
                                              const setter = editingMacro === 'p' ? setFallbackProtPerServ : editingMacro === 'c' ? setFallbackCarbPerServ : setFallbackFatPerServ;
                                              setter(prev => {
                                                if (num === '.') {
                                                  return prev.includes('.') ? prev : prev + '.';
                                                }
                                                return (prev === '0' || prev === '') ? String(num) : prev + num;
                                              });
                                            }}
                                            style={{ padding: '16px 0', borderRadius: 12, border: 'none', background: '#fff', fontSize: 24, fontWeight: 600, color: '#333', boxShadow: '0 2px 0 #e5e7eb', cursor: 'pointer' }}
                                          >
                                            {num}
                                          </button>
                                        ))}

                                        <button
                                          type="button"
                                          onClick={() => {
                                            const setter = editingMacro === 'p' ? setFallbackProtPerServ : editingMacro === 'c' ? setFallbackCarbPerServ : setFallbackFatPerServ;
                                            setter(prev => prev.slice(0, -1));
                                          }}
                                          style={{ padding: '16px 0', borderRadius: 12, border: 'none', background: '#e5e7eb', fontSize: 20, color: '#333', boxShadow: '0 2px 0 #d1d5db', cursor: 'pointer' }}
                                        >
                                          ⌫
                                        </button>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => setEditingMacro(null)}
                                        style={{ width: '100%', marginTop: 12, padding: '14px 0', borderRadius: 12, border: 'none', background: '#5c9c84', color: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer' }}
                                      >
                                        完成
                                      </button>
                                    </div>
                                  </div>
                                )}

                                <div style={{ textAlign: 'center', marginTop: 12, fontSize: 15, color: '#666' }}>
                                  系統將依 <b>P×4 + C×4 + F×9</b> 自動計算熱量
                                </div>
                              </div>
                            </div>
                          )}

                          {/* C3：自定義熱量 (僅 Kcal) */}
                          {fallbackType === '自定義熱量' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                              {/* 份量輸入 */}
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#666', marginBottom: 6 }}>
                                  份量 (份)
                                </div>
                                <div
                                  onClick={() => {
                                    setEditingCustomKcal('servings');
                                    setFallbackServings('');
                                  }}
                                  style={{
                                    background: '#fff',
                                    borderRadius: 12,
                                    padding: '12px',
                                    textAlign: 'center',
                                    fontSize: 24,
                                    fontWeight: 700,
                                    color: '#333',
                                    border: '1px solid #e5e7eb',
                                    cursor: 'pointer'
                                  }}
                                >
                                  {fallbackServings || '0'}
                                </div>
                              </div>

                              {/* 每份熱量輸入 */}
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#666', marginBottom: 6 }}>
                                  每份熱量 (kcal)
                                </div>
                                <div
                                  onClick={() => {
                                    setEditingCustomKcal('kcal');
                                    setFallbackKcalPerServ('');
                                  }}
                                  style={{
                                    background: '#fff',
                                    borderRadius: 12,
                                    padding: '12px',
                                    textAlign: 'center',
                                    fontSize: 24,
                                    fontWeight: 700,
                                    color: '#333',
                                    border: '1px solid #e5e7eb',
                                    cursor: 'pointer'
                                  }}
                                >
                                  {fallbackKcalPerServ || '0'}
                                </div>
                              </div>

                              <div className="hint">
                                不在意 P/C/F，只估算總熱量。
                              </div>

                              {/* 自定義熱量數字鍵盤 Modal */}
                              {editingCustomKcal && (
                                <div
                                  className="modal-backdrop"
                                  style={{
                                    position: 'fixed',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    background: 'rgba(0,0,0,0.4)',
                                    zIndex: 100
                                  }}
                                  onClick={() => setEditingCustomKcal(null)}
                                >
                                  <div
                                    style={{
                                      position: 'absolute',
                                      bottom: 'calc(70px + env(safe-area-inset-bottom))',
                                      left: 0,
                                      right: 0,
                                      maxWidth: 420,
                                      margin: '0 auto',
                                      background: '#f0f2f5',
                                      borderTopLeftRadius: 20,
                                      borderTopRightRadius: 20,
                                      padding: 20,
                                      boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
                                      animation: 'slideInUp 0.2s ease-out'
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
                                      <span style={{ fontSize: 16, fontWeight: 600, color: '#666' }}>
                                        輸入{editingCustomKcal === 'servings' ? '份量' : '每份熱量'}
                                      </span>
                                      <span style={{ fontSize: 24, fontWeight: 700, color: '#333' }}>
                                        {editingCustomKcal === 'servings' ? (fallbackServings || '0') : (fallbackKcalPerServ || '0')}
                                      </span>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0].map((num) => (
                                        <button
                                          key={num}
                                          type="button"
                                          onClick={() => {
                                            const setter = editingCustomKcal === 'servings' ? setFallbackServings : setFallbackKcalPerServ;
                                            setter(prev => {
                                              if (num === '.') {
                                                return prev.includes('.') ? prev : prev + '.';
                                              }
                                              return (prev === '0' || prev === '') ? String(num) : prev + num;
                                            });
                                          }}
                                          style={{
                                            padding: '16px 0',
                                            borderRadius: 12,
                                            border: 'none',
                                            background: '#fff',
                                            fontSize: 24,
                                            fontWeight: 600,
                                            color: '#333',
                                            boxShadow: '0 2px 0 #e5e7eb',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          {num}
                                        </button>
                                      ))}

                                      <button
                                        type="button"
                                        onClick={() => {
                                          const setter = editingCustomKcal === 'servings' ? setFallbackServings : setFallbackKcalPerServ;
                                          setter(prev => prev.slice(0, -1));
                                        }}
                                        style={{
                                          padding: '16px 0',
                                          borderRadius: 12,
                                          border: 'none',
                                          background: '#e5e7eb',
                                          fontSize: 20,
                                          color: '#333',
                                          boxShadow: '0 2px 0 #d1d5db',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        ⌫
                                      </button>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => setEditingCustomKcal(null)}
                                      style={{
                                        width: '100%',
                                        marginTop: 12,
                                        padding: '14px 0',
                                        borderRadius: 12,
                                        border: 'none',
                                        background: '#5c9c84',
                                        color: '#fff',
                                        fontSize: 18,
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                      }}
                                    >
                                      完成
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* 營養資訊預覽卡片 - 食物類別版本 */}
                          {fallbackType && autoFoodInfo.kcal > 0 && (
                            <div style={{
                              background: 'linear-gradient(135deg, #f0fdf9 0%, #f7fbf8 100%)',
                              borderRadius: 12,
                              padding: '16px',
                              marginTop: 12,
                              marginBottom: 8,
                              border: '1px solid #d1f0e3',
                              boxShadow: '0 2px 8px rgba(151, 208, 186, 0.1)'
                            }}>
                              {/* 標題 */}
                              <div style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: '#5c9c84',
                                marginBottom: 12,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6
                              }}>
                                <span>📊</span>
                                <span>營養資訊預覽</span>
                              </div>

                              {/* 熱量 (大字) */}
                              <div style={{
                                textAlign: 'center',
                                marginBottom: 12,
                                paddingBottom: 12,
                                borderBottom: '1px solid #e5f3ed'
                              }}>
                                <div style={{ fontSize: 32, fontWeight: 700, color: '#1f2937', lineHeight: 1 }}>
                                  {autoFoodInfo.kcal}
                                  <span style={{ fontSize: 16, fontWeight: 500, color: '#6b7280', marginLeft: 4 }}>kcal</span>
                                </div>
                              </div>

                              {/* 營養素 (P/C/F) 三欄 */}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                                {/* 蛋白質 */}
                                <div style={{ textAlign: 'center' }}>
                                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, fontWeight: 500 }}>蛋白質</div>
                                  <div style={{
                                    fontSize: 18,
                                    fontWeight: 700,
                                    color: '#5c9c84',
                                    display: 'flex',
                                    alignItems: 'baseline',
                                    justifyContent: 'center',
                                    gap: 2
                                  }}>
                                    {Math.round(autoFoodInfo.protein * 10) / 10}
                                    <span style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af' }}>g</span>
                                  </div>
                                </div>

                                {/* 碳水化合物 */}
                                <div style={{ textAlign: 'center' }}>
                                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, fontWeight: 500 }}>碳水</div>
                                  <div style={{
                                    fontSize: 18,
                                    fontWeight: 700,
                                    color: '#ffbe76',
                                    display: 'flex',
                                    alignItems: 'baseline',
                                    justifyContent: 'center',
                                    gap: 2
                                  }}>
                                    {Math.round(autoFoodInfo.carb * 10) / 10}
                                    <span style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af' }}>g</span>
                                  </div>
                                </div>

                                {/* 脂肪 */}
                                <div style={{ textAlign: 'center' }}>
                                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, fontWeight: 500 }}>脂肪</div>
                                  <div style={{
                                    fontSize: 18,
                                    fontWeight: 700,
                                    color: '#ff7979',
                                    display: 'flex',
                                    alignItems: 'baseline',
                                    justifyContent: 'center',
                                    gap: 2
                                  }}>
                                    {Math.round(autoFoodInfo.fat * 10) / 10}
                                    <span style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af' }}>g</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          {/* === 份量輸入彈窗 (Servings Modal) === */}
                          {showServingsModal && (
                            <div
                              className="modal-backdrop"
                              style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: 'rgba(0,0,0,0.4)',
                                zIndex: 100
                              }}
                              onClick={() => setShowServingsModal(false)}
                            >
                              <div
                                style={{
                                  position: 'absolute',
                                  bottom: 'calc(70px + env(safe-area-inset-bottom))',
                                  left: 0,
                                  right: 0,
                                  maxWidth: 420,
                                  margin: '0 auto',
                                  background: '#f0f2f5',
                                  borderTopLeftRadius: 20,
                                  borderTopRightRadius: 20,
                                  padding: 20,
                                  boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 16,
                                  animation: 'slideInUp 0.2s ease-out'
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {/* 1. 頂部控制列：標題 + Tab 切換 */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <span style={{ fontWeight: 600, color: '#666', fontSize: 15 }}>輸入份量</span>

                                  {/* iOS 風格分段控制器 (Segmented Control) */}
                                  <div style={{
                                    display: 'flex', background: '#e5e7eb', padding: 3, borderRadius: 8,
                                  }}>
                                    <button
                                      onClick={() => setServingsTab('dec')}
                                      style={{
                                        padding: '4px 16px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 600,
                                        background: servingsTab === 'dec' ? '#fff' : 'transparent',
                                        color: servingsTab === 'dec' ? '#333' : '#666',
                                        boxShadow: servingsTab === 'dec' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                        transition: 'all 0.2s', cursor: 'pointer'
                                      }}
                                    >
                                      小數
                                    </button>
                                    <button
                                      onClick={() => setServingsTab('frac')}
                                      style={{
                                        padding: '4px 16px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 600,
                                        background: servingsTab === 'frac' ? '#fff' : 'transparent',
                                        color: servingsTab === 'frac' ? '#333' : '#666',
                                        boxShadow: servingsTab === 'frac' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                        transition: 'all 0.2s', cursor: 'pointer'
                                      }}
                                    >
                                      分數
                                    </button>
                                  </div>
                                </div>

                                {/* 2. 即時數值顯示區 (Display) */}
                                <div style={{
                                  background: '#fff', borderRadius: 12, padding: '12px',
                                  textAlign: 'center', fontSize: 28, fontWeight: 700, color: '#333',
                                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb'
                                }}>
                                  {fallbackServings || '0'}
                                </div>

                                {/* 3. 內容區：根據 Tab 切換顯示 NumPad 或 Picker */}

                                {/* === Tab A: 數字鍵盤 (NumPad) === */}
                                {servingsTab === 'dec' && (
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0].map((num) => (
                                      <button
                                        key={num}
                                        type="button"
                                        onClick={() => {
                                          if (num === '.') {
                                            if (!fallbackServings.includes('.')) setFallbackServings(prev => prev + '.');
                                          } else {
                                            // 如果目前是 0 或空，直接取代；否則串接
                                            setFallbackServings(prev => (prev === '0' || prev === '' ? String(num) : prev + num));
                                          }
                                        }}
                                        style={{
                                          padding: '12px 0', borderRadius: 12, border: 'none', background: '#fff',
                                          fontSize: 22, fontWeight: 600, color: '#333', boxShadow: '0 2px 0 #e5e7eb',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        {num}
                                      </button>
                                    ))}
                                    {/* Backspace */}
                                    <button
                                      type="button"
                                      onClick={() => setFallbackServings(prev => prev.slice(0, -1) || '0')}
                                      style={{
                                        padding: '12px 0', borderRadius: 12, border: 'none', background: '#e5e7eb',
                                        fontSize: 20, color: '#333', boxShadow: '0 2px 0 #d1d5db', cursor: 'pointer'
                                      }}
                                    >
                                      ⌫
                                    </button>
                                  </div>
                                )}

                                {/* === Tab B: 分數滾輪 (Fraction Picker) === */}
                                {servingsTab === 'frac' && (
                                  <div style={{ position: 'relative', height: 200, overflow: 'hidden', background: '#fff', borderRadius: 12 }}>

                                    {/* 綠色選取框 (Highlight Bar) */}
                                    <div style={{
                                      position: 'absolute', top: 75, left: 0, right: 0, height: 50,
                                      background: 'rgba(151, 208, 186, 0.2)', borderTop: '1px solid #97d0ba', borderBottom: '1px solid #97d0ba',
                                      pointerEvents: 'none', zIndex: 1
                                    }}></div>

                                    {/* 滾動列表 */}
                                    <div
                                      ref={servingsPickerRef}
                                      style={{
                                        height: '100%', overflowY: 'auto', scrollSnapType: 'y mandatory',
                                        position: 'relative', zIndex: 2, scrollbarWidth: 'none'
                                      }}
                                      onScroll={(e) => {
                                        // 簡單的防抖動或直接計算
                                        const scrollTop = e.currentTarget.scrollTop;
                                        const index = Math.round(scrollTop / 50);
                                        const target = fractionList[index];
                                        // 滑動時即時更新數值
                                        if (target) {
                                          // 這裡要注意：如果不希望滑動時一直改變上面的 Display 數值導致跳動，
                                          // 可以只在 scroll 結束時更新，但為了簡單即時回饋，這裡直接更新。
                                          setFallbackServings(target.value);
                                        }
                                      }}
                                    >
                                      <div style={{ height: 75 }}></div> {/* Top Spacer */}

                                      {fractionList.map((item) => (
                                        <div
                                          key={item.label}
                                          onClick={() => {
                                            setFallbackServings(item.value);
                                            // 點擊後滾動到該位置
                                            const index = fractionList.indexOf(item);
                                            if (servingsPickerRef.current) {
                                              servingsPickerRef.current.scrollTo({ top: index * 50, behavior: 'smooth' });
                                            }
                                          }}
                                          style={{
                                            height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 20, fontWeight: 600, scrollSnapAlign: 'center', cursor: 'pointer',
                                            color: String(fallbackServings) === item.value ? '#059669' : '#9ca3b8',
                                            transition: 'all 0.2s'
                                          }}
                                        >
                                          {item.label}
                                          {/* 如果數值相同，顯示數值對照 (例: 1/2 = 0.5) */}
                                          {String(fallbackServings) === item.value && (
                                            <span style={{ fontSize: 15, color: '#5c9c84', marginLeft: 8, fontWeight: 400 }}>
                                              ({item.value})
                                            </span>
                                          )}
                                        </div>
                                      ))}

                                      <div style={{ height: 75 }}></div> {/* Bottom Spacer */}
                                    </div>
                                  </div>
                                )}

                                {/* 完成按鈕 */}
                                <button
                                  type="button"
                                  onClick={() => setShowServingsModal(false)}
                                  style={{
                                    width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
                                    background: '#5c9c84', color: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer',
                                    marginTop: 4
                                  }}
                                >
                                  完成
                                </button>

                              </div>
                            </div>
                          )}
                          {/* 🆕 補回這裡遺失的「加入記錄」按鈕 */}
                          <button
                            className="primary"
                            onClick={saveMeal}
                            style={{ marginTop: 16, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}
                          >
                            <span>{editingMealId ? '更新記錄' : '加入記錄'}</span>
                            {effectiveFoodKcal > 0 && (
                              <span style={{ background: 'rgba(255,255,255,0.25)', padding: '2px 8px', borderRadius: 99, fontSize: 13, fontWeight: 600 }}>
                                {Math.round(effectiveFoodKcal)} kcal
                              </span>
                            )}
                          </button>
                        </div>
                      )}

                    {editingMealId && (
                      <button
                        onClick={() => {
                          setEditingMealId(null);
                          setManualFoodKcal('');
                          setSelectedUnitFood(null);
                          setSelectedFoodDbRow(null);
                        }}
                      >
                        取消編輯
                      </button>
                    )}
                  </div>
                </details> {/* 關閉 🔍 搜尋食物資料庫 */}
                {/* 🆕 手掌法模式結束 */}
                {/* 🆕 手掌法輸入模式 */}
              </>
            )}


            <div className="list-section">
              <div className="card-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                <h3>{selectedDate} 飲食明細</h3>
              </div>

              {dayMeals.length === 0 && (
                <div className="hint" style={{ marginTop: 8 }}>尚未記錄飲食</div>
              )}

              {/* ⚠️ 注意：這裡開頭必須有 { 左大括號 */}
              {(['早餐', '午餐', '晚餐', '點心'] as const).map((type) => {
                const typeMeals = dayMeals.filter((m) => m.mealType === type);
                if (typeMeals.length === 0) return null;

                const typeSubtotal = typeMeals.reduce((s, m) => s + m.kcal, 0);

                return (
                  <div key={type} style={{ marginBottom: 16 }}>
                    {/* 標題列 */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 4px',
                      marginBottom: 4,
                      borderBottom: '2px solid #f0f4f2'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 4, height: 14, background: '#97d0ba', borderRadius: 2 }}></div>
                        <span className="record-group-title">{type}</span>
                      </div>
                      <span className="record-group-subtotal">
                        {typeSubtotal} kcal
                      </span>
                    </div>

                    {/* 列表內容 */}
                    {/* ⚠️ 注意：這裡開頭也必須有 { 左大括號 */}
                    {typeMeals.map((m) => {
                      const isSelected = selectedMealIds.includes(m.id);
                      return (
                        <div
                          key={m.id}
                          className="list-item clickable"
                          onClick={() => toggleMealSelection(m.id)}
                          style={{
                            borderLeft: isSelected ? '4px solid var(--mint-dark)' : '1px solid transparent',
                            background: isSelected ? '#f7fbf8' : '#fff',
                            paddingLeft: isSelected ? '12px' : '0px',
                            paddingRight: 0,
                            alignItems: 'center',
                            marginBottom: 0,
                            borderBottom: '1px solid #f3f4f6'
                          }}
                        >
                          <div style={{ marginRight: 12, fontSize: 18, opacity: isSelected ? 1 : 0.3, cursor: 'pointer' }}>
                            {isSelected ? '☑️' : '◻️'}
                          </div>

                          <div style={{ flex: 1, padding: '8px 0' }}>
                            <div className="record-item-name">
                              {m.label}
                            </div>
                            <div className="record-item-detail">
                              {m.amountText && (
                                <>
                                  <span>
                                    {m.counts ? (
                                      <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                                        {Object.entries(m.counts).map(([key, count]) => {
                                          if (count <= 0 || !ICON_MAP[key]) return null;
                                          return (
                                            <span key={key} style={{ display: 'inline-flex', alignItems: 'center', background: '#f3f4f6', padding: '0 4px', borderRadius: 4 }}>
                                              <img src={ICON_MAP[key]} alt={key} style={{ width: 12, height: 12, objectFit: 'contain', marginRight: 2 }} />
                                              <span style={{ fontSize: 10, fontWeight: 700 }}>×{count}</span>
                                            </span>
                                          );
                                        })}
                                      </span>
                                    ) : (
                                      renderPalmAmountText(m.amountText, m.counts)
                                    )}
                                  </span>
                                  <span>·</span>
                                </>
                              )}
                              <span>{m.kcal} kcal</span>
                            </div>
                          </div>

                          <div className="btn-row" onClick={(e) => e.stopPropagation()} style={{ gap: 8 }}>
                            <button
                              className="record-item-btn btn-edit"
                              onClick={() => startEditMeal(m)}
                            >
                              編輯
                            </button>
                            <button
                              className="record-item-btn btn-delete"
                              onClick={() => setMeals((prev) => prev.filter((x) => x.id !== m.id))}
                            >
                              刪除
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* 運動 */}
        {recordTab === 'exercise' && (
          <div className="card">
            <details>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>什麼是 MET?</summary>
              <p className="text-sm text-gray-600 mt-2">
                MET(代謝當量)用來表示活動強度,1 MET 約等於安靜坐著時的消耗。
                <br />
                消耗熱量 ≈ MET × 體重(kg) × 時間(小時)
                <br />
                例如:快走 4.3 MET,60kg,30 分鐘 ≈ 129 kcal。
              </p>
            </details>

            {/* 🆕 記錄模式切換 (使用 CSS class) */}
            <div className="mode-switch">
              <button
                type="button"
                className={`mode-btn ${recordMode === 'quick' ? 'active' : ''}`}
                onClick={() => setRecordMode('quick')}
              >
                ⚡ 快速記錄
              </button>

              <button
                type="button"
                className={`mode-btn ${recordMode === 'detail' ? 'active' : ''}`}
                onClick={() => setRecordMode('detail')}
              >
                🔍 精確記錄
              </button>
            </div>
            {/* ========== 快速記錄模式 ========== */}
            <div
              className="form-section"
              style={{ display: recordMode === 'quick' ? 'block' : 'none' }}
            >
              <label style={{ marginBottom: 12, fontSize: 16, fontWeight: 700, display: 'block', color: '#333' }}>
                選擇運動強度
              </label>

              {/* 🆕 三欄式強度卡片 */}
              <div className="intensity-grid">
                {INTENSITY_OPTIONS.map((opt) => {
                  // 判斷是否被選中
                  const isActive = customMet === String(opt.met);

                  return (
                    <div
                      key={opt.id}
                      className={`intensity-card ${opt.className} ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        // 1. 設定數值 (共用 state)
                        setExName(opt.val);
                        setCustomMet(String(opt.met));

                        // 2. 清理精確模式的狀態，確保不衝突
                        setSelectedMetRow(null);
                        setQuickExercise(null); // 若不使用此 wrapper，可省略，但為了保險起見

                        // 3. 自動聚焦體驗 (若體重未填)
                        if (!exWeight) {
                          setTimeout(() => {
                            const wInput = document.querySelector('#exercise-weight-input') as HTMLInputElement;
                            if (wInput) wInput.focus();
                          }, 100);
                        }
                      }}
                    >
                      {/* 🟢 修改：將文字 Emoji 改為圖片渲染，並設定適當大小 */}
                      <div className="intensity-icon">
                        <img
                          src={opt.icon}
                          alt={opt.label}
                          style={{ width: 48, height: 48, objectFit: 'contain' }}
                        />
                      </div>
                      <div className="intensity-label">{opt.label}</div>
                      <div className="intensity-met">MET {opt.met}</div>
                    </div>
                  );
                })}
              </div>

              {/* 🆕 優化後的輸入區 (改用數字鍵盤) */}
              <div style={{ marginTop: 8 }}>

                {/* 1. 體重輸入 */}
                <div className="input-group" onClick={() => setShowWeightPad(true)}>
                  <label>體重 (kg)</label>
                  <div className={`fake-input ${!exWeight ? 'placeholder' : ''}`}>
                    {exWeight || '例如: 60'}
                  </div>
                </div>

                {/* 2. 時間輸入 */}
                <div className="input-group" onClick={() => setShowTimePad(true)}>
                  <label>運動時間 (分鐘)</label>
                  <div className={`fake-input ${!exMinutes ? 'placeholder' : ''}`}>
                    {exMinutes || '30'}
                  </div>
                </div>
              </div>

              {/* 預估消耗 & 按鈕 */}
              <div className="hint" style={{
                padding: '12px',
                background: '#f8fafc',
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                marginTop: 16,
                textAlign: 'center',
                color: '#64748b'
              }}>
                預估消耗: <strong style={{ color: 'var(--mint-dark)', fontSize: 22, marginLeft: 4 }}>
                  {autoExerciseKcal || 0}
                </strong> kcal
              </div>

              <button
                type="button"
                className="primary"
                style={{ marginTop: 20, width: '100%', padding: '14px', fontSize: 18 }}
                onClick={(e) => {
                  e.preventDefault();
                  addExercise();
                }}
              >
                {editingExerciseId ? '更新運動記錄' : '加入運動記錄'}
              </button>

              {editingExerciseId && (
                <button
                  style={{ width: '100%', marginTop: 12, background: 'transparent', color: '#666', border: 'none', padding: 10 }}
                  onClick={() => {
                    setEditingExerciseId(null);
                    setExName('');
                    setExMinutes('');
                    setCustomMet('');
                    setSelectedMetRow(null);
                    setQuickExercise(null);
                  }}
                >
                  取消編輯
                </button>

              )}

            </div>

            {/* ========== 精確記錄模式 (優化版) ========== */}
            <div
              className="form-section"
              style={{ display: recordMode === 'detail' ? 'block' : 'none' }}
            >
              {/* 1. 搜尋運動名稱 (保留文字輸入，但變漂亮了) */}
              <div className="input-group">
                <label>運動名稱 / 關鍵字</label>
                <input
                  type="text"
                  className="styled-text-input"
                  value={exName}
                  onChange={(e) => {
                    setExName(e.target.value);
                    setSelectedMetRow(null);
                    // 切換到搜尋時，清除快速選項避免衝突
                    if (recordMode === 'detail') setQuickExercise(null);
                  }}
                  placeholder="例如: 慢跑、騎自行車..."
                  autoComplete="off"
                />
              </div>

              {/* 1.1 搜尋結果列表 (有結果時顯示) */}
              {exName.trim() && !selectedMetRow && (
                <div className="search-results-container">
                  {exerciseMatches.length === 0 ? (
                    <div style={{ padding: 16, textAlign: 'center', color: '#888', fontSize: 14 }}>
                      找不到相符運動，請直接輸入下方數值。
                    </div>
                  ) : (
                    exerciseMatches.map((row, i) => (
                      <div
                        key={i}
                        className={`search-result-item ${selectedMetRow === row ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedMetRow(row);
                          setCustomMet(String(row.MET));
                          setExName(row.活動);
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: '#333' }}>{row.活動}</div>
                          <div style={{ fontSize: 12, color: '#666' }}>
                            MET: {row.MET} <span style={{ opacity: 0.3 }}>|</span> 強度: {row.intensity}
                          </div>
                        </div>
                        {selectedMetRow === row && <span style={{ color: '#5c9c84', fontWeight: 'bold' }}>✔</span>}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* 2. MET 輸入 (改成點擊跳出數字鍵盤) */}
              <div className="input-group" onClick={() => setShowMetPad(true)}>
                <label>MET (代謝當量)</label>
                <div className={`fake-input ${!customMet ? 'placeholder' : ''}`}>
                  {customMet || '例如: 4.3'}
                </div>
              </div>

              {/* 3. 體重輸入 (共用樣式) */}
              <div className="input-group" onClick={() => setShowWeightPad(true)}>
                <label>體重 (kg)</label>
                <div className={`fake-input ${!exWeight ? 'placeholder' : ''}`}>
                  {exWeight || '60'}
                </div>
              </div>

              {/* 4. 時間輸入 (共用樣式) */}
              <div className="input-group" onClick={() => setShowTimePad(true)}>
                <label>運動時間 (分鐘)</label>
                <div className={`fake-input ${!exMinutes ? 'placeholder' : ''}`}>
                  {exMinutes || '30'}
                </div>
              </div>

              {/* 預估消耗 & 按鈕 */}
              <div className="hint" style={{
                padding: '12px',
                background: '#f8fafc',
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                marginTop: 16,
                textAlign: 'center',
                color: '#64748b'
              }}>
                預估消耗: <strong style={{ color: '#5c9c84', fontSize: 22, marginLeft: 4 }}>
                  {autoExerciseKcal || 0}
                </strong> kcal
              </div>

              <button
                type="button"
                className="primary"
                style={{ marginTop: 20, width: '100%', padding: '14px', fontSize: 18 }}
                onClick={(e) => {
                  e.preventDefault();
                  addExercise();
                }}
              >
                {editingExerciseId ? '更新運動記錄' : '加入記錄'}
              </button>

              {editingExerciseId && (
                <button
                  style={{ width: '100%', marginTop: 12, background: 'transparent', color: '#666', border: 'none', padding: 10 }}
                  onClick={() => {
                    setEditingExerciseId(null);
                    setExName('');
                    setExMinutes('');
                    setCustomMet('');
                    setSelectedMetRow(null);
                    setQuickExercise(null);
                  }}
                >
                  取消編輯
                </button>
              )}
            </div>


            {/* 運動明細列表 */}
            <div className="list-section">
              <h3>{selectedDate} 運動明細</h3>
              {dayExercises.length === 0 && (
                <div className="hint">尚未記錄運動</div>
              )}
              {dayExercises.map((e) => (
                <div key={e.id} className="list-item">
                  <div>
                    <div style={{ fontWeight: 600, color: '#374151', fontSize: 15 }}>
                      {e.name}
                    </div>
                    <div className="sub" style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                      {e.minutes != null ? `${e.minutes} 分鐘 · ` : ''}
                      {e.kcal} kcal
                    </div>
                  </div>

                  {/* 👇 修改這裡：套用跟飲食列表一樣的按鈕樣式 */}
                  <div className="btn-row" style={{ gap: 8 }}>
                    <button
                      className="record-item-btn btn-edit"
                      onClick={() => startEditExercise(e)}
                    >
                      編輯
                    </button>
                    <button
                      className="record-item-btn btn-delete"
                      onClick={() =>
                        setExercises((prev) =>
                          prev.filter((x) => x.id !== e.id)
                        )
                      }
                    >
                      刪除
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <NumberPadModal
              visible={showWeightPad}
              onClose={() => setShowWeightPad(false)}
              title="輸入體重 (kg)"
              value={exWeight}
              allowDecimal={true} // 體重允許小數點
              onChange={(val) => setExWeight(val)}
            />

            <NumberPadModal
              visible={showTimePad}
              onClose={() => setShowTimePad(false)}
              title="運動時間 (分鐘)"
              value={exMinutes}
              allowDecimal={true} // 
              onChange={(val) => setExMinutes(val)}
            />

            {/* 🆕 新增：MET 輸入鍵盤 */}
            <NumberPadModal
              visible={showMetPad}
              onClose={() => setShowMetPad(false)}
              title="輸入 MET (代謝當量)"
              value={customMet}
              allowDecimal={true} // MET 通常有小數點
              onChange={(val) => {
                setCustomMet(val);
                if (val) setSelectedMetRow(null); // 手動輸入時取消列表選取
              }}
            />



          </div>
        )}

        {/* 🆕 浮動按鈕：儲存常用組合 */}
        {recordTab === 'food' && selectedMealIds.length > 0 && (
          <div
            className="fixed-combo-bar"
            style={{
              position: 'fixed',
              bottom: '80px',
              left: 0,
              right: 0,
              background: 'var(--mint-dark, #5c9c84)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              boxShadow: '0 -2px 8px rgba(0,0,0,0.1)',
              zIndex: 10,
            }}
          >
            <div style={{ flex: 1, color: '#fff', fontWeight: 600 }}>
              已選擇 {selectedMealIds.length} 項
            </div>
            <button
              className="primary"
              onClick={() => {
                // 🆕 自動生成組合名稱：取前 3 個食物名稱
                const selectedMeals = dayMeals.filter((m) => selectedMealIds.includes(m.id));
                const names = selectedMeals.slice(0, 3).map((m) => m.label);
                const defaultName = names.join(' + ') + (selectedMeals.length > 3 ? ' 等' : '');
                setComboNameInput(defaultName);
                setShowSaveComboModal(true);
              }}
              style={{
                padding: '8px 16px',
                background: '#fff',
                color: 'var(--mint-dark, #5c9c84)',
                border: 'none',
                borderRadius: 8,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              儲存為常用組合
            </button>
          </div>
        )}

        {/* 🆕 儲存為常用組合 Modal */}
        {showSaveComboModal && (
          <div
            className="modal-backdrop"
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            onClick={() => setShowSaveComboModal(false)}
          >
            <div
              className="modal"
              onClick={(e) => e.stopPropagation()}
              style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 400, padding: 24, boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}
            >
              <h3 style={{ margin: '0 0 16px 0', color: '#333', fontSize: 18 }}>儲存為常用組合</h3>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 14, fontWeight: 600, color: '#555', marginBottom: 8, display: 'block' }}>
                  組合名稱
                </label>
                <input
                  type="text"
                  value={comboNameInput}
                  onChange={(e) => setComboNameInput(e.target.value)}
                  placeholder="例如：早餐組合"
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 8,
                    border: '1px solid #ddd',
                    fontSize: 16,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ fontSize: 13, color: '#666', marginBottom: 20, padding: 12, background: '#f8f9fa', borderRadius: 8 }}>
                已選擇 {selectedMealIds.length} 項食物
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => setShowSaveComboModal(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: '#e9ecef',
                    color: '#333',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  取消
                </button>
                <button
                  onClick={handleSaveCombo}
                  disabled={!comboNameInput.trim()}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: comboNameInput.trim() ? 'var(--mint-green, #97d0ba)' : '#ddd',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: comboNameInput.trim() ? 'pointer' : 'not-allowed',
                    opacity: comboNameInput.trim() ? 1 : 0.5
                  }}
                >
                  儲存
                </button>
              </div>
            </div>
          </div>
        )}


        {/* 🟢 新增：掛載掃描器 Modal */}
        {showScanner && (
          <BarcodeScanner
            onClose={() => setShowScanner(false)}
            onResult={handleScanResult}
          />
        )}

        {/* 🟢 新增：AI 結果確認 Modal */}
        {showAiModal && aiResult && (
          <div
            className="modal-backdrop"
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 20px calc(80px + env(safe-area-inset-bottom)) 20px' }}
            onClick={() => setShowAiModal(false)}
          >
            <div
              className="modal"
              onClick={(e) => e.stopPropagation()}
              style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 400, padding: 20, boxShadow: '0 10px 25px rgba(0,0,0,0.2)', maxHeight: 'calc(90vh - 100px)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
            >
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>✨</div>
                <h3 style={{ margin: 0, color: '#333' }}>AI 辨識結果</h3>

                {/* 🆕 信心度指示器 */}
                {aiResult.confidence && (
                  <div style={{
                    marginTop: 12,
                    padding: '8px 16px',
                    borderRadius: 8,
                    backgroundColor:
                      aiResult.confidence === 'high' ? '#d4edda' :
                        aiResult.confidence === 'medium' ? '#fff3cd' : '#f8d7da',
                    border: `1px solid ${aiResult.confidence === 'high' ? '#c3e6cb' :
                        aiResult.confidence === 'medium' ? '#ffeaa7' : '#f5c6cb'
                      }`
                  }}>
                    <p style={{
                      margin: 0,
                      fontSize: 13,
                      color:
                        aiResult.confidence === 'high' ? '#155724' :
                          aiResult.confidence === 'medium' ? '#856404' : '#721c24',
                      fontWeight: 600
                    }}>
                      {aiResult.confidence === 'high' && '✓ 估計準確度:高'}
                      {aiResult.confidence === 'medium' && '⚠ 估計準確度:中等，建議調整'}
                      {aiResult.confidence === 'low' && '⚠ 估計準確度:低，請手動修正'}
                    </p>
                  </div>
                )}
              </div>

              <div className="form-section">
                {/* 食物名稱 */}
                <label style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 8, display: 'block' }}>食物名稱</label>
                <input
                  type="text"
                  value={aiResult.name}
                  onChange={(e) => setAiResult({ ...aiResult, name: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #ddd', marginBottom: 16, fontSize: 16 }}
                />

                {/* 🆕 份量參考圖示 */}
                {aiResult.portionReference && aiResult.portionReference !== 'none' && (
                  <div style={{
                    backgroundColor: '#f8f9fa',
                    padding: 12,
                    borderRadius: 8,
                    marginBottom: 16,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12
                  }}>
                    <img
                      src={
                        aiResult.portionReference === 'fist' ? fistImg :
                          aiResult.portionReference === 'palm' ? palmImg :
                            aiResult.portionReference === 'thumb' ? thumbImg :
                              palmImg
                      }
                      alt="份量參考"
                      style={{ width: 48, height: 48, objectFit: 'contain' }}
                    />
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#333' }}>
                        份量參考:
                        {aiResult.portionReference === 'fist' && ' 拳頭大小'}
                        {aiResult.portionReference === 'palm' && ' 手掌大小'}
                        {aiResult.portionReference === 'thumb' && ' 拇指大小'}
                      </p>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#666' }}>
                        約 {aiResult.servingSize || 100}g/份
                      </p>
                    </div>
                  </div>
                )}

                {/* 🆕 實際攝取量調整 */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 8, display: 'block' }}>
                    我實際吃了多少?
                  </label>

                  {/* 快速選擇按鈕 */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setAiResult({
                        ...aiResult,
                        actualRatio: 1.0,
                        customWeight: Math.round((aiResult.servingSize || 100) * 1.0)
                      })}
                      style={{
                        flex: 1,
                        minWidth: '70px',
                        padding: '10px 12px',
                        fontSize: '0.9rem',
                        borderRadius: 8,
                        border: (aiResult.actualRatio || 1) === 1.0 ? '2px solid #5c9c84' : '1px solid #ddd',
                        backgroundColor: (aiResult.actualRatio || 1) === 1.0 ? '#f0f8f5' : '#fff',
                        color: (aiResult.actualRatio || 1) === 1.0 ? '#5c9c84' : '#666',
                        cursor: 'pointer',
                        fontWeight: (aiResult.actualRatio || 1) === 1.0 ? 'bold' : 'normal'
                      }}
                    >
                      全部 100%
                    </button>
                    <button
                      onClick={() => setAiResult({
                        ...aiResult,
                        actualRatio: 0.75,
                        customWeight: Math.round((aiResult.servingSize || 100) * 0.75)
                      })}
                      style={{
                        flex: 1,
                        minWidth: '70px',
                        padding: '10px 12px',
                        fontSize: '0.9rem',
                        borderRadius: 8,
                        border: (aiResult.actualRatio || 1) === 0.75 ? '2px solid #5c9c84' : '1px solid #ddd',
                        backgroundColor: (aiResult.actualRatio || 1) === 0.75 ? '#f0f8f5' : '#fff',
                        color: (aiResult.actualRatio || 1) === 0.75 ? '#5c9c84' : '#666',
                        cursor: 'pointer',
                        fontWeight: (aiResult.actualRatio || 1) === 0.75 ? 'bold' : 'normal'
                      }}
                    >
                      大部分 75%
                    </button>
                    <button
                      onClick={() => setAiResult({
                        ...aiResult,
                        actualRatio: 0.5,
                        customWeight: Math.round((aiResult.servingSize || 100) * 0.5)
                      })}
                      style={{
                        flex: 1,
                        minWidth: '70px',
                        padding: '10px 12px',
                        fontSize: '0.9rem',
                        borderRadius: 8,
                        border: (aiResult.actualRatio || 1) === 0.5 ? '2px solid #5c9c84' : '1px solid #ddd',
                        backgroundColor: (aiResult.actualRatio || 1) === 0.5 ? '#f0f8f5' : '#fff',
                        color: (aiResult.actualRatio || 1) === 0.5 ? '#5c9c84' : '#666',
                        cursor: 'pointer',
                        fontWeight: (aiResult.actualRatio || 1) === 0.5 ? 'bold' : 'normal'
                      }}
                    >
                      一半 50%
                    </button>
                    <button
                      onClick={() => setAiResult({
                        ...aiResult,
                        actualRatio: 0.25,
                        customWeight: Math.round((aiResult.servingSize || 100) * 0.25)
                      })}
                      style={{
                        flex: 1,
                        minWidth: '70px',
                        padding: '10px 12px',
                        fontSize: '0.9rem',
                        borderRadius: 8,
                        border: (aiResult.actualRatio || 1) === 0.25 ? '2px solid #5c9c84' : '1px solid #ddd',
                        backgroundColor: (aiResult.actualRatio || 1) === 0.25 ? '#f0f8f5' : '#fff',
                        color: (aiResult.actualRatio || 1) === 0.25 ? '#5c9c84' : '#666',
                        cursor: 'pointer',
                        fontWeight: (aiResult.actualRatio || 1) === 0.25 ? 'bold' : 'normal'
                      }}
                    >
                      一些 25%
                    </button>
                  </div>

                  {/* 精確調整重量 */}
                  <div style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                    backgroundColor: '#f8f9fa',
                    padding: '12px',
                    borderRadius: 8,
                    marginBottom: 8
                  }}>
                    <span style={{ fontSize: 13, color: '#666', flexShrink: 0 }}>或輸入實際重量:</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={aiResult.customWeight !== undefined
                        ? aiResult.customWeight
                        : Math.round((aiResult.servingSize || 100) * (aiResult.actualRatio || 1))
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        // 允許空字串和數字
                        if (val === '' || /^\d+$/.test(val)) {
                          const actualWeight = val === '' ? 0 : Number(val);
                          const ratio = actualWeight / (aiResult.servingSize || 100);
                          setAiResult({
                            ...aiResult,
                            customWeight: val === '' ? '' : actualWeight, // 儲存使用者輸入的值
                            actualRatio: Math.max(0, Math.min(2, ratio))
                          });
                        }
                      }}
                      onBlur={() => {
                        // 失去焦點時,如果是空字串,補回預設值
                        if (aiResult.customWeight === '' || aiResult.customWeight === undefined) {
                          setAiResult({
                            ...aiResult,
                            customWeight: Math.round((aiResult.servingSize || 100) * (aiResult.actualRatio || 1))
                          });
                        }
                      }}
                      style={{
                        width: '100px',
                        padding: '8px',
                        fontSize: 16,
                        fontWeight: 'bold',
                        textAlign: 'center',
                        borderRadius: 6,
                        border: '1px solid #ddd',
                        color: '#333',
                        backgroundColor: '#fff'
                      }}
                    />
                    <span style={{ fontSize: 14, color: '#666' }}>g</span>
                  </div>

                  <p style={{ fontSize: 11, color: '#999', margin: 0, textAlign: 'center' }}>
                    💡 AI 估算總重: {aiResult.servingSize || 100}g
                  </p>
                </div>

                {/* 總熱量顯示 (即時計算) */}
                {(() => {
                  const ratio = aiResult.actualRatio || 1;
                  const kcal = Math.round((aiBaseNutrition?.kcalPerServing || 0) * ratio);
                  return (
                    <div style={{
                      backgroundColor: '#f0f8f5',
                      padding: 16,
                      borderRadius: 12,
                      marginBottom: 16,
                      border: '2px solid #5c9c84'
                    }}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: '#555', display: 'block', marginBottom: 8 }}>
                        總熱量
                      </label>
                      <div style={{ fontSize: 28, fontWeight: 'bold', color: '#5c9c84', textAlign: 'center' }}>
                        {kcal} <span style={{ fontSize: 16 }}>kcal</span>
                      </div>
                    </div>
                  );
                })()}

                {/* 營養素顯示 (即時計算) */}
                {(() => {
                  const ratio = aiResult.actualRatio || 1;
                  const protein = Number(((aiBaseNutrition?.proteinPerServing || 0) * ratio).toFixed(1));
                  const carbs = Number(((aiBaseNutrition?.carbsPerServing || 0) * ratio).toFixed(1));
                  const fat = Number(((aiBaseNutrition?.fatPerServing || 0) * ratio).toFixed(1));

                  return (
                    <div style={{ background: '#f9fafb', padding: 12, borderRadius: 12, border: '1px solid #eee' }}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 8, display: 'block' }}>
                        營養素 (g)
                        <span style={{ fontSize: 11, color: '#999', fontWeight: 'normal', marginLeft: 8 }}>
                          💡 調整重量會自動計算
                        </span>
                      </label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ flex: 1, textAlign: 'center' }}>
                          <span style={{ fontSize: 12, color: '#d64545', display: 'block', marginBottom: 4 }}>蛋白質</span>
                          <div style={{
                            padding: '8px',
                            borderRadius: 6,
                            backgroundColor: '#fff',
                            border: '1px solid #e0e0e0',
                            fontSize: 16,
                            fontWeight: 'bold',
                            color: '#d64545'
                          }}>
                            {protein}
                          </div>
                        </div>
                        <div style={{ flex: 1, textAlign: 'center' }}>
                          <span style={{ fontSize: 12, color: '#e68a3a', display: 'block', marginBottom: 4 }}>碳水</span>
                          <div style={{
                            padding: '8px',
                            borderRadius: 6,
                            backgroundColor: '#fff',
                            border: '1px solid #e0e0e0',
                            fontSize: 16,
                            fontWeight: 'bold',
                            color: '#e68a3a'
                          }}>
                            {carbs}
                          </div>
                        </div>
                        <div style={{ flex: 1, textAlign: 'center' }}>
                          <span style={{ fontSize: 12, color: '#f59e0b', display: 'block', marginBottom: 4 }}>脂肪</span>
                          <div style={{
                            padding: '8px',
                            borderRadius: 6,
                            backgroundColor: '#fff',
                            border: '1px solid #e0e0e0',
                            fontSize: 16,
                            fontWeight: 'bold',
                            color: '#f59e0b'
                          }}>
                            {fat}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                <button
                  onClick={() => setShowAiModal(false)}
                  style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: '#f3f4f6', color: '#666', fontWeight: 600, cursor: 'pointer' }}
                >
                  取消
                </button>
                <button
                  onClick={() => confirmAiResult(aiResult)}
                  style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: '#5c9c84', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                >
                  確認加入
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 🆕 OCR 掃描結果 - 份數調整介面 */}
        {scannedServingData && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px 20px calc(80px + env(safe-area-inset-bottom)) 20px'
          }}>
            <div style={{
              backgroundColor: '#fff',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '400px',
              width: '90%',
              maxHeight: 'calc(90vh - 100px)',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <h3 style={{ marginBottom: '16px', fontSize: '1.2rem', color: '#333' }}>
                📄 營養標示掃描結果
              </h3>

              {/* 🆕 品名編輯欄位 */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '0.9rem',
                  color: '#666',
                  fontWeight: 'bold'
                }}>
                  產品名稱:
                </label>
                <input
                  type="text"
                  value={scannedServingData.name}
                  onChange={(e) => {
                    setScannedServingData({
                      ...scannedServingData,
                      name: e.target.value
                    });
                  }}
                  placeholder="例如:巧克力餅乾"
                  style={{
                    width: '100%',
                    padding: '10px',
                    fontSize: '1rem',
                    borderRadius: '8px',
                    border: '1px solid #ddd',
                    backgroundColor: '#f8f9fa'
                  }}
                />
                <p style={{ fontSize: '0.75rem', color: '#999', marginTop: '4px' }}>
                  💡 可以手動修改品名
                </p>
              </div>

              <p style={{
                color: '#666',
                marginBottom: '20px',
                fontSize: '0.9rem',
                backgroundColor: '#f0f0f0',
                padding: '8px 12px',
                borderRadius: '6px'
              }}>
                <strong>每份重量:</strong> {scannedServingData.servingSize}g
              </p>

              {/* 份數調整 */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: 'bold',
                  color: '#333'
                }}>
                  選擇份數:
                </label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    onClick={() => setServingCount(Math.max(0.5, servingCount - 0.5))}
                    style={{
                      padding: '10px 18px',
                      fontSize: '1.3rem',
                      borderRadius: '8px',
                      border: '1px solid #ddd',
                      backgroundColor: '#f5f5f5',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={servingCount}
                    onChange={(e) => setServingCount(Math.max(0, Number(e.target.value)))}
                    step="0.5"
                    style={{
                      width: '80px',
                      padding: '10px',
                      fontSize: '1.1rem',
                      textAlign: 'center',
                      borderRadius: '8px',
                      border: '2px solid #5c9c84',
                      fontWeight: 'bold'
                    }}
                  />
                  <button
                    onClick={() => setServingCount(servingCount + 0.5)}
                    style={{
                      padding: '10px 18px',
                      fontSize: '1.3rem',
                      borderRadius: '8px',
                      border: '1px solid #ddd',
                      backgroundColor: '#f5f5f5',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    +
                  </button>
                  <span style={{ marginLeft: '8px', color: '#666', fontSize: '0.9rem' }}>份</span>
                </div>
              </div>

              {/* 營養素顯示 (自動計算) */}
              <div style={{
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '20px',
                border: '1px solid #e0e0e0'
              }}>
                <p style={{ marginBottom: '8px', fontSize: '0.95rem' }}>
                  <strong>總重量:</strong> {(scannedServingData.servingSize * servingCount).toFixed(0)}g
                </p>
                <p style={{ marginBottom: '8px', fontSize: '0.95rem' }}>
                  <strong>熱量:</strong> {(scannedServingData.kcal * servingCount).toFixed(0)} kcal
                </p>
                <p style={{ marginBottom: '8px', fontSize: '0.95rem' }}>
                  <strong>蛋白質:</strong> {(scannedServingData.protein * servingCount).toFixed(1)}g
                </p>
                <p style={{ marginBottom: '8px', fontSize: '0.95rem' }}>
                  <strong>碳水:</strong> {(scannedServingData.carb * servingCount).toFixed(1)}g
                </p>
                <p style={{ fontSize: '0.95rem' }}>
                  <strong>脂肪:</strong> {(scannedServingData.fat * servingCount).toFixed(1)}g
                </p>
              </div>

              {/* 按鈕 */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => {
                    // 🆕 確認加入邏輯
                    const finalName = scannedServingData.name.trim() || "掃描食品";

                    const newEntry: MealEntry = {
                      id: uuid(),
                      date: selectedDate,
                      mealType: formMealType,
                      label: servingCount === 1
                        ? finalName
                        : `${finalName} (${servingCount}份)`,
                      kcal: Math.round(scannedServingData.kcal * servingCount),
                      protein: Number((scannedServingData.protein * servingCount).toFixed(1)),
                      carb: Number((scannedServingData.carb * servingCount).toFixed(1)),
                      fat: Number((scannedServingData.fat * servingCount).toFixed(1)),
                      amountText: `${(scannedServingData.servingSize * servingCount).toFixed(0)}g`,
                    };

                    setMeals((prev) => [...prev, newEntry]);
                    setScannedServingData(null);
                    showToast('success', `✅ 已加入:${finalName}`);
                  }}
                  style={{
                    flex: 1,
                    padding: '14px',
                    backgroundColor: '#5c9c84',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  ✓ 確認加入
                </button>
                <button
                  onClick={() => setScannedServingData(null)}
                  style={{
                    flex: 1,
                    padding: '14px',
                    backgroundColor: '#f5f5f5',
                    color: '#333',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    cursor: 'pointer'
                  }}
                >
                  ✕ 取消
                </button>
              </div>
            </div>
          </div>
        )}



        {/* 🟢 新增：全螢幕載入遮罩 (Loading Overlay) */}
        {isAiAnalyzing && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(255, 255, 255, 0.85)', // 白色半透明背景，看起來比較清爽
              zIndex: 9999, // 確保蓋在最上面
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(4px)', // 毛玻璃效果 (支援的手機看起來更有質感)
            }}
            onClick={(e) => e.stopPropagation()} // 防止誤觸底部
          >
            {/* 注入轉圈圈動畫 */}
            <style>
              {`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}
            </style>

            {/* 轉圈圈圖示 */}
            <div
              style={{
                width: 50,
                height: 50,
                border: '5px solid #e5e7eb',
                borderTop: '5px solid #5c9c84', // 品牌色
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                marginBottom: 20,
              }}
            />

            <h3 style={{ margin: 0, color: '#333', fontSize: 18, fontWeight: 600 }}>
              AI 正在分析食物...
            </h3>
            <p style={{ margin: '8px 0 0', color: '#666', fontSize: 14 }}>
              請稍候，正在辨識營養成分
            </p>
          </div>
        )}
      </div>
    );
  };

  // 定義三種強度 (低 2.5 / 中 4.0 / 高 7.0) 與對應樣式
  const INTENSITY_OPTIONS = [
    { id: 'low', label: '低強度', val: '低強度運動', icon: lowIntensityImg, met: 2.5, className: 'low' },
    { id: 'medium', label: '中強度', val: '中強度運動', icon: mediumIntensityImg, met: 4.0, className: 'medium' },
    { id: 'high', label: '高強度', val: '高強度運動', icon: highIntensityImg, met: 7.0, className: 'high' },
  ];


  const App: React.FC = () => {
    const mainContentRef = useRef<HTMLDivElement>(null);
    const [tab, setTab] = useState<Tab>('today');
    const [isSearchExpanded, setIsSearchExpanded] = useState(false); // 🆕 控制搜尋欄收合
    const [showUpdateBar, setShowUpdateBar] = useState(false);
    // 👇 [新增] 1. 這裡新增兩行，專門記住「紀錄頁」選的日期與週曆起點
    // 這樣就算 RecordsPage 重整，資料還是存在 App 這一層，不會消失
    const [recordsDate, setRecordsDate] = useState(dayjs().format('YYYY-MM-DD'));
    const [recordsWeekStart, setRecordsWeekStart] = useState(
      dayjs().startOf('week').format('YYYY-MM-DD')
    );
    // 🆕 新增：提升到 App 層級的運動表單狀態
    const [exerciseFormState, setExerciseFormState] = useState<ExerciseFormState>({
      mode: 'quick',
      quickExercise: null,
      name: '',
      minutes: '',
      weight: '',
      customMet: '',
      metRow: null,
      editId: null,
    });

    // Helper: 用來局部更新運動狀態
    const handleUpdateExForm = (patch: Partial<ExerciseFormState>) => {
      setExerciseFormState(prev => ({ ...prev, ...patch }));
    };
    // 🆕 在這裡加入 Toast 狀態
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    // 🆕 Toast 工具函數
    const showToast = useCallback((type: ToastType, message: string) => {
      const id = uuid();
      setToasts((prev) => [...prev, { id, type, message }]);
    }, []);

    const dismissToast = useCallback((id: string) => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    // ✅ 加入這些（訂閱相關）
    const [founderPrice, setFounderPrice] = useState<any>(null);
  

    const [recordDefaultMealType, setRecordDefaultMealType] =
      useState<'早餐' | '午餐' | '晚餐' | '點心'>('早餐');

    // 🆕 持久化使用者在 Records 頁面選擇的餐別
    const [currentFoodMealType, setCurrentFoodMealType] =
      useState<'早餐' | '午餐' | '晚餐' | '點心'>(recordDefaultMealType);

    const [recordTab, setRecordTab] = useState<RecordSubTab>('food');

    const [settings, setSettings] = useState<Settings>(() =>
      loadJSON<Settings>(STORAGE_KEYS.SETTINGS, {})
    );


    // After（加上 Capacitor 環境判斷）
    // 🔔 監聽 Service Worker 是否有安裝新版本（只在 Web 版運作）
    useEffect(() => {
      // 🔧 判斷是否為 Capacitor 原生 App
      const isNativeApp = (window as any).Capacitor?.isNativePlatform?.();

      if (isNativeApp) {
        console.log('📱 原生 App 環境，不啟用 Service Worker 更新提示');
        return; // 直接結束，不執行後續邏輯
      }

      if (!('serviceWorker' in navigator)) {
        console.warn('⚠️ 此瀏覽器不支援 Service Worker');
        return;
      }

      // 1. 註冊與監聽新版本發現（只在 Web 版執行）
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) return;

        // 如果頁面剛打開時，就已經有新版本在排隊 (waiting)，直接顯示更新提示
        if (reg.waiting) {
          console.log('👀 發現已經有新版本在等待中');
          setShowUpdateBar(true);
        }

        // 監聽有沒有新的 SW 正在安裝
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            // 當新版本狀態變成 "installed" 且原本就有舊版本在控制 -> 代表有更新
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('✅ 新版本下載完成，等待使用者更新');
              setShowUpdateBar(true);
            }
          });
        });

        // 定期檢查更新 (保持原樣)
        if (!import.meta.env.DEV) {
          const updateInterval = setInterval(() => {
            reg.update();
          }, 30 * 60 * 1000);
          return () => clearInterval(updateInterval);
        }
      });

      // 👇 [重要] 2. 監聽「控制權變更」事件
      // 當 handleReloadForUpdate 送出 SKIP_WAITING 後，瀏覽器會切換 SW，這時觸發此事件 -> 自動重整
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          console.log('🔄 控制權已變更，正在重整頁面...');
          window.location.reload();
        }
      });

    }, []);

    // 👇 [修改] 讓按鈕真的有效的更新函式
    function handleReloadForUpdate() {
      console.log('🔄 使用者點擊更新按鈕');

      navigator.serviceWorker.getRegistration().then((reg) => {
        // 1. 檢查是否有正在等待的新版本 (waiting)
        if (reg && reg.waiting) {
          console.log('📨 發送 SKIP_WAITING 給新版本');
          // 告訴那個「正在排隊」的新 Service Worker：跳過等待，直接接管！
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        } else {
          // 2. 如果沒找到 waiting (可能已經變成 controller 或其他狀況)，就直接重整
          console.log('⚠️ 沒找到 waiting worker，直接重整');
          window.location.reload();
        }
      });
    }
    // 監聽 Plan 頁送來的目標熱量：
    // 1) 更新「我的」頁的目標攝取熱量 (作為未來新日期的預設值)
    // 2) 只更新「今天這一天」的日目標，不改舊日期
    useEffect(() => {
      function onSetGoal(ev: any) {
        const kcal = Number(ev?.detail);
        if (!isNaN(kcal) && kcal > 0) {
          // 更新全域設定（未來新日期的預設）
          setSettings((s) => ({ ...s, calorieGoal: kcal }));

          // 更新當天的 DaySummary，只動今天，不動歷史
          const todayYMD = dayjs().format('YYYY-MM-DD');
          setDays((prev) => {
            const idx = prev.findIndex((d) => d.date === todayYMD);
            if (idx === -1) {
              const newDay: DaySummary = {
                date: todayYMD,
                waterMl: 0,
                calorieGoalKcal: kcal,
              };
              return [...prev, newDay];
            }
            const copy = [...prev];
            copy[idx] = { ...copy[idx], calorieGoalKcal: kcal };
            return copy;
          });
        }
      }

      document.addEventListener('ju:set-goal-kcal', onSetGoal as any);
      return () =>
        document.removeEventListener('ju:set-goal-kcal', onSetGoal as any);
    }, []);



    const [days, setDays] = useState<DaySummary[]>(() =>
      loadJSON<DaySummary[]>(STORAGE_KEYS.DAYS, [])
    );
    // 🆕 一次性初始化：
    // 如果以前的紀錄都沒有日目標，但有設定全域目標，
    // 就把「當下的全域目標」灑到所有既有日期，當作「當時的舊目標」。
    // 之後再改目標，就只會影響當天與未來新日期。
    useEffect(() => {
      if (settings.calorieGoal == null) return;

      setDays((prev) => {
        // 已經有任何一天有 calorieGoalKcal，就視為已初始化過
        if (prev.some((d) => d.calorieGoalKcal != null)) {
          return prev;
        }
        return prev.map((d) => ({
          ...d,
          calorieGoalKcal:
            d.calorieGoalKcal != null ? d.calorieGoalKcal : settings.calorieGoal!,
        }));
      });
    }, [settings.calorieGoal]);

    const [meals, setMeals] = useState<MealEntry[]>(() =>
      loadJSON<MealEntry[]>(STORAGE_KEYS.MEALS, [])
    );

    const [exercises, setExercises] = useState<ExerciseEntry[]>(() =>
      loadJSON<ExerciseEntry[]>(STORAGE_KEYS.EXERCISES, [])
    );

    // 🆕 新增：常用組合的狀態
    const [combos, setCombos] = useState<MealCombo[]>(() =>
      loadJSON<MealCombo[]>(STORAGE_KEYS.COMBOS, [])
    );

    const [todayLocal, setTodayLocal] = useState(
      dayjs().format('YYYY-MM-DD')
    );

    // 使用 useRef 來保持顯示的週起點固定，不受重新渲染影響
    const displayWeekStartRef = useRef(dayjs().startOf('week').format('YYYY-MM-DD'));
    const [weekKey, setWeekKey] = useState(0); // 用來強制重新渲染
    // ✅ 修正：確保在 App 載入時，時間狀態能正確初始化為當下時間
    // 雖然 useState 已經初始化，但這個 useEffect 能確保在客戶端環境中，
    // 初始渲染後的時間狀態是準確的，避免午夜交界點的誤差。
    useEffect(() => {
      setTodayLocal(dayjs().format('YYYY-MM-DD'));
    }, []); // 僅在元件首次掛載時執行一次

    // 👇 [新增] 1. 建立一個專門處理「從首頁跳轉去記飲食」的函式
    function goToFoodRecord(type: '早餐' | '午餐' | '晚餐' | '點心') {
      // A. 先同步日期：把紀錄頁的日期設為目前首頁選中的日期
      setRecordsDate(todayLocal);
      setRecordsWeekStart(dayjs(todayLocal).startOf('week').format('YYYY-MM-DD'));

      // B. 設定餐別
      setRecordDefaultMealType(type);
      setCurrentFoodMealType(type);

      // C. 切換頁面
      setTab('records');
      setRecordTab('food');
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
    }

    // 👇 [修改] 2. 修正原本的運動跳轉函式，也要同步日期
    function goToExerciseRecord() {
      // A. 同樣先同步日期
      setRecordsDate(todayLocal);
      setRecordsWeekStart(dayjs(todayLocal).startOf('week').format('YYYY-MM-DD'));

      setTab('records');         // 切到「記錄」頁
      setRecordTab('exercise');  // 切到「運動」子頁

      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' }), 0;
      });
    }

    // 🟢 新增：取得創始會員價格
const fetchFounderPrice = async () => {
  // 🔧 開發環境使用假資料（避免 CORS 錯誤）
  if (import.meta.env.DEV) {
    console.log('🔧 開發環境：使用假資料測試');
    
    // 模擬 API 延遲
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 設定假資料
    setFounderPrice({
      tier: '第一階段 早鳥優惠',
      price: 499,
      originalPrice: 999,
      discount: 50,
      remaining: 50,
      count: 450,
      total: 500
    });
    
    console.log('✅ 創始會員假資料載入完成');
    return;
  }

  // 🚀 正式環境：呼叫真實 API
  try {
    const response = await fetch('https://api.jusmilespace.com/founder-price');
    
    if (!response.ok) {
      throw new Error(`API 錯誤: ${response.status}`);
    }
    
    const data = await response.json();
    setFounderPrice(data);
    console.log('✅ 創始會員價格載入成功:', data);
  } catch (error) {
    console.error('❌ 取得創始會員價格失敗:', error);
    // 靜默失敗，不影響 App 運作
  }
};

    // CSV 資料
    const [typeTable, setTypeTable] = useState<TypeRow[]>([]);
    const [unitMap, setUnitMap] = useState<UnitMapRow[]>([]);
    const [foodDb, setFoodDb] = useState<FoodDbRow[]>([]);
    const [exerciseMet, setExerciseMet] = useState<ExerciseMetRow[]>([]);
    const [csvLoading, setCsvLoading] = useState(false);
    const [csvError, setCsvError] = useState<string | null>(null);

    // After（只改初始化邏輯，其他都不動）
    const [srcType, setSrcType] = useState<string>(
      () =>
        sanitizeCsvSrc(
          localStorage.getItem('JU_SRC_TYPE'),
          CSV_DEFAULT_URLS.TYPE_TABLE
        )
    );
    const [srcUnit, setSrcUnit] = useState<string>(
      () =>
        sanitizeCsvSrc(
          localStorage.getItem('JU_SRC_UNIT'),
          CSV_DEFAULT_URLS.UNIT_MAP
        )
    );
    const [srcFood, setSrcFood] = useState<string>(
      () =>
        sanitizeCsvSrc(
          localStorage.getItem('JU_SRC_FOOD'),
          CSV_DEFAULT_URLS.FOOD_DB
        )
    );
    const [srcMet, setSrcMet] = useState<string>(
      () =>
        sanitizeCsvSrc(
          localStorage.getItem('JU_SRC_MET'),
          CSV_DEFAULT_URLS.EXERCISE_MET
        )
    );

    // 初始載入 CSV 與創始會員價格
    useEffect(() => {
      // 載入 CSV 資料
      syncCsv();

      // 🟢 新增：取得創始會員價格
      fetchFounderPrice();

      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 儲存 settings / days / meals / exercises / combos
    useEffect(() => {
      saveJSON(STORAGE_KEYS.SETTINGS, settings);
    }, [settings]);

    useEffect(() => {
      saveJSON(STORAGE_KEYS.DAYS, days);
    }, [days]);

    useEffect(() => {
      saveJSON(STORAGE_KEYS.MEALS, meals);
    }, [meals]);

    useEffect(() => {
      saveJSON(STORAGE_KEYS.EXERCISES, exercises);
    }, [exercises]);

    // 🆕 儲存 combos
    useEffect(() => {
      saveJSON(STORAGE_KEYS.COMBOS, combos);
    }, [combos]);

    // 🟢 新增：App 啟動時自動檢查訂閱狀態
useEffect(() => {
  checkSubscriptionStatus();
}, []);

// 🟢 新增：檢查訂閱狀態函數
async function checkSubscriptionStatus() {
  const userId = generateUserId();

  // 🟢 臨時加入這行，用來查看 userId
  console.log('📱 當前 App userId:', userId);
  alert('當前 userId: ' + userId);  // 🟢 也在 App 中顯示，更方便
  
  // 取得目前本地的訂閱狀態
  const currentSub = getSubscription();
  
  try {
    const response = await fetch('https://api.jusmilespace.com/check-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    
    if (!response.ok) {
      console.error('檢查訂閱狀態失敗');
      return;
    }
    
    const data = await response.json();
    
    // 如果遠端狀態和本地不同，更新本地狀態
    if (data.type !== currentSub.type) {
      // 更新本地訂閱狀態
      updateSubscription({
        type: data.type,
        aiCredits: data.aiCredits,
        aiCreditsResetDate: data.aiCreditsResetDate,
        founderTier: data.founderTier,
        founderCode: data.founderCode
      });
      
      // 如果升級為創始會員，顯示恭喜訊息
      if (data.type === 'founder' && currentSub.type === 'free') {
        setTimeout(() => {
          showToast('success', `🎉 恭喜！您已成功升級為創始會員\n兌換碼：${data.founderCode}`);
        }, 1000);
      }
    }
  } catch (error) {
    console.error('檢查訂閱狀態錯誤:', error);
  }
}

    // ======== 取得 / 更新某日資料 ========

    function getDay(date: string): DaySummary {
      let day = days.find((d) => d.date === date);
      if (!day) {
        day = {
          date,
          waterMl: 0,
          // 新增日期時，預帶當下設定的目標熱量，當作這一天的日目標
          ...(settings.calorieGoal != null
            ? { calorieGoalKcal: settings.calorieGoal }
            : {}),
        };
        setDays((prev) => [...prev, day!]);
      }
      return day;
    }

    function updateDay(date: string, patch: Partial<DaySummary>) {
      setDays((prev) => {
        const idx = prev.findIndex((d) => d.date === date);
        if (idx === -1) {
          return [...prev, { date, waterMl: 0, ...patch }];
        }
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...patch };
        return copy;
      });
    }

    // ======== 今日統計 ========

    const todaySummary = getDay(todayLocal);

    const todayMeals = meals.filter((m) => m.date === todayLocal);
    const todayExercises = exercises.filter((e) => e.date === todayLocal);

    const todayIntake = todayMeals.reduce((s, m) => s + (m.kcal || 0), 0);
    const todayBurn = todayExercises.reduce((s, e) => s + (e.kcal || 0), 0);
    const todayExerciseMinutes = todayExercises.reduce(
      (s, e) => s + (e.minutes || 0),
      0
    );

    // ======== CSV 同步 ========

    async function syncCsv() {
      try {
        setCsvLoading(true);
        setCsvError(null);

        const [types, units, foods, mets] = await Promise.all([
          fetchCsv<TypeRow>(srcType),
          fetchCsv<UnitMapRow>(srcUnit),
          fetchCsv<FoodDbRow>(srcFood),
          fetchCsv<ExerciseMetRow>(srcMet),
        ]);

        setTypeTable(types);
        setUnitMap(units);
        setFoodDb(foods);
        setExerciseMet(mets);

        localStorage.setItem('JU_SRC_TYPE', srcType);
        localStorage.setItem('JU_SRC_UNIT', srcUnit);
        localStorage.setItem('JU_SRC_FOOD', srcFood);
        localStorage.setItem('JU_SRC_MET', srcMet);

        // 🆕 成功時顯示 Toast
        showToast('success', '精準資料同步完成');
      } catch (err: any) {
        console.error(err);
        setCsvError('同步 CSV 發生錯誤,請檢查 URL 或稍後再試。');
        // 🆕 失敗時也顯示 Toast
        showToast('error', '同步 CSV 發生錯誤,請檢查 URL 或稍後再試');
      } finally {
        setCsvLoading(false);
      }
    }


    // ======== 喝水 ========

    function addWater(delta: number) {
      const next = (todaySummary.waterMl || 0) + delta;
      updateDay(todayLocal, { waterMl: next });
    }

    // ======== UI 元件 ========

    // 優化樣式：更緊湊，移除按鈕改為整張卡片可點擊
    const MealCard: React.FC<{
      title: '早餐' | '午餐' | '晚餐' | '點心';
      kcal: number;
      protein: number;
      carb: number;
      fat: number;
      onAdd: () => void;
    }> = ({ title, kcal, protein, carb, fat, onAdd }) => {

      // 🆕 簡單的對照表：中文標題 -> 檔名
      const iconMap: Record<string, string> = {
        '早餐': 'breakfast.png',
        '午餐': 'lunch.png',
        '晚餐': 'dinner.png',
        '點心': 'snack.png',
      };

      // 取得對應圖檔路徑 (考慮到 public/icons)
      // 加上 APP_BASE_URL 確保未來上傳 GitHub Pages 路徑也正確
      // 注意：這裡假設 APP_BASE_URL 結尾有斜線 (如預設)
      const iconSrc = `${APP_BASE_URL}icons/${iconMap[title]}`;

      return (
        <div
          className="meal-card"
          onClick={onAdd}
          // ... (原本的 style 保持不變) ...
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: '100%',
            cursor: 'pointer',
            position: 'relative',
            padding: '16px',
            transition: 'all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1)',
            borderRadius: '20px',
            background: '#fff',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
            border: '1px solid #f0f0f0'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 12px 20px rgba(0,0,0,0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03)';
          }}
        >
          {/* 上排：餐別標題 (含 Icon) + 加號 */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8
          }}>
            <div className="meal-title" style={{ display: 'flex', alignItems: 'center' }}>
              {/* 🆕 顯示 PNG Icon */}
              <img
                src={iconSrc}
                alt={title}
                style={{ width: 30, height: 30, marginRight: 8, objectFit: 'contain' }}
                onError={(e) => (e.currentTarget.style.display = 'none')} // 若圖片讀取失敗則隱藏
              />
              {title}
            </div>
            <div className="meal-add-btn">
              +
            </div>
          </div>

          {/* 下排：kcal 主數字 + P/C/F */}
          <div style={{ flex: 1 }}>
            <div className="meal-kcal-row">
              <span className="meal-kcal-number">{kcal}</span>
              <span className="meal-kcal-unit">kcal</span>
            </div>
            <div className="meal-macros">
              P {round1(protein)} · C {round1(carb)} · F {round1(fat)}
            </div>
          </div>
        </div>
      );
    };

    // ======== 首頁 ========

    type TodayPageProps = {
      onAddExercise: () => void;
    };

    // 🟢 全域暫存變數 (防止 TodayPage Remount 時狀態遺失)
    let g_editingBodyField: 'weight' | 'bf' | 'sm' | 'vf' | null = null;
    let g_wInput = '';
    let g_bfInput = '';
    let g_smInput = '';
    let g_vfInput = '';

    const TodayPage: React.FC<TodayPageProps> = ({ onAddExercise }) => {
      const { showToast } = React.useContext(ToastContext);
      const todaySummary = getDay(todayLocal);

      // 🆕 週曆滑動偏移量（跟著手指滑動的距離）
      const [weekSwipeOffset, setWeekSwipeOffset] = useState(0);

      // 🧠 月份標題顯示邏輯...
      const todayWeekStart = dayjs(displayWeekStartRef.current);

      const todayWeekCenter = todayWeekStart.add(3, 'day'); // 當週中間那天
      const todayWeekEnd = todayWeekStart.add(6, 'day');
      const todaySelectedDay = dayjs(todayLocal);

      // 被選日期是否在這一週裡
      const isTodaySelectedInThisWeek =
        todaySelectedDay.diff(todayWeekStart, 'day') >= 0 &&
        todaySelectedDay.diff(todayWeekEnd, 'day') <= 0;

      // 最終要顯示的月份文字
      const todayMonthLabel =
        isTodaySelectedInThisWeek &&
          (
            todaySelectedDay.month() !== todayWeekCenter.month() ||
            todaySelectedDay.year() !== todayWeekCenter.year()
          )
          ? todaySelectedDay.format('MMMM, YYYY')   // 選到「另一個月」→ 顯示被選日期的月份
          : todayWeekCenter.format('MMMM, YYYY');   // 其他情況 → 以當週為主（維持原本設定）

      // 🆕 點標題日期時打開原生 date picker
      const todayDateInputRef = useRef<HTMLInputElement | null>(null);
      const openTodayDatePicker = () => {
        const input = todayDateInputRef.current;
        if (!input) return;
        const withPicker = input as HTMLInputElement & { showPicker?: () => void };
        if (withPicker.showPicker) {
          withPicker.showPicker();
        } else {
          input.focus();
          input.click();
        }
      };
      // 🟢 改用全域變數作為初始值 (解決輸入跳掉問題)
      const [editingBodyField, _setEBF] = useState(g_editingBodyField);
      const [wInput, _setWInput] = useState(g_wInput);
      const [bfInput, _setBfInput] = useState(g_bfInput);
      const [smInput, _setSmInput] = useState(g_smInput);
      const [vfInput, _setVfInput] = useState(g_vfInput);

      // 🟡 補回：身高維持原本的寫法 (因為它不用防止輸入消失)
      const [userHeight, setUserHeight] = useState<number>(0);

      // 🟢 同步更新全域變數的 Setter (這樣即使元件重繪，值也會被記住)
      const setEditingBodyField = (v: any) => { g_editingBodyField = v; _setEBF(v); };
      const setWInput = (v: string) => { g_wInput = v; _setWInput(v); };
      const setBfInput = (v: string) => { g_bfInput = v; _setBfInput(v); };
      const setSmInput = (v: string) => { g_smInput = v; _setSmInput(v); };
      const setVfInput = (v: string) => { g_vfInput = v; _setVfInput(v); };

      const [waterInput, setWaterInput] = useState<string>('');
      const todayWeekSwipeRef = useRef<HTMLDivElement | null>(null);

      useEffect(() => {
        const el = todayWeekSwipeRef.current;
        if (!el) return;

        let touchStartX = 0;
        let touchCurrentX = 0;

        const handleTouchStart = (e: TouchEvent) => {
          touchStartX = e.touches[0].clientX;
          touchCurrentX = touchStartX;
          setWeekSwipeOffset(0);
        };

        const handleTouchMove = (e: TouchEvent) => {
          touchCurrentX = e.touches[0].clientX;
          setWeekSwipeOffset(touchCurrentX - touchStartX); // 🛝 跟著手指移動
        };

        const handleTouchEnd = () => {
          const diff = touchStartX - touchCurrentX; // >0 左滑，<0 右滑
          const threshold = 50;

          if (Math.abs(diff) > threshold) {
            if (diff > 0) {
              // 左滑 → 下一週
              displayWeekStartRef.current = dayjs(displayWeekStartRef.current)
                .add(7, 'day')
                .format('YYYY-MM-DD');
              setWeekKey((k) => k + 1);
            } else {
              // 右滑 → 上一週
              displayWeekStartRef.current = dayjs(displayWeekStartRef.current)
                .subtract(7, 'day')
                .format('YYYY-MM-DD');
              setWeekKey((k) => k + 1);
            }
          }

          // 放手後，條回到中間
          setWeekSwipeOffset(0);
        };

        el.addEventListener('touchstart', handleTouchStart, { passive: true });
        el.addEventListener('touchmove', handleTouchMove, { passive: true });
        el.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
          el.removeEventListener('touchstart', handleTouchStart);
          el.removeEventListener('touchmove', handleTouchMove);
          el.removeEventListener('touchend', handleTouchEnd);
        };
      }, []);


      // 1. 移除自動同步數值的邏輯，只保留讀取身高的功能 (只執行一次)
      useEffect(() => {
        try {
          const raw = localStorage.getItem('JU_PLAN_FORM');
          if (raw) {
            const obj = JSON.parse(raw);
            if (obj.height) setUserHeight(Number(obj.height));
          }
        } catch { }
      }, []);

      // 2. 新增：專門用來打開輸入框的函式
      const openBodyInput = (field: 'weight' | 'bf' | 'sm' | 'vf') => {
        // 自動存檔：如果正在編輯其他欄位，直接存檔 (無通知)
        if (editingBodyField && editingBodyField !== field) {
          saveBody(); // 👈 直接呼叫，不用傳參數
        }

        // 讀取該欄位目前的值 (若全域變數有值則優先使用，否則讀取 DB)
        // 這樣切換回來時，之前打一半的字還在
        let savedInput = '';
        if (field === 'weight') savedInput = g_wInput;
        if (field === 'bf') savedInput = g_bfInput;
        if (field === 'sm') savedInput = g_smInput;
        if (field === 'vf') savedInput = g_vfInput;

        if (!savedInput) {
          if (field === 'weight') savedInput = todaySummary.weight != null ? String(todaySummary.weight) : '';
          if (field === 'bf') savedInput = todaySummary.bodyFat != null ? String(todaySummary.bodyFat) : '';
          if (field === 'sm') savedInput = todaySummary.skeletalMuscle != null ? String(todaySummary.skeletalMuscle) : '';
          if (field === 'vf') savedInput = todaySummary.visceralFat != null ? String(todaySummary.visceralFat) : '';
        }

        if (field === 'weight') setWInput(savedInput);
        if (field === 'bf') setBfInput(savedInput);
        if (field === 'sm') setSmInput(savedInput);
        if (field === 'vf') setVfInput(savedInput);

        setEditingBodyField(field);
      };

      const todayMeals = meals.filter((m) => m.date === todayLocal);
      const todayExercises = exercises.filter((e) => e.date === todayLocal);

      const todayIntake = todayMeals.reduce((s, m) => s + (m.kcal || 0), 0);
      const todayBurn = todayExercises.reduce((s, e) => s + (e.kcal || 0), 0);

      // 改成使用「這一天」自己的目標熱量
      const calorieGoal = todaySummary.calorieGoalKcal != null ? todaySummary.calorieGoalKcal : undefined;

      // 先算出今天的「淨熱量」= 攝取 - 消耗
      const netKcal = todayIntake - todayBurn;

      // 要顯示在畫面上的數字與狀態
      let netDisplayValue = 0;
      let netStatusLabel = '';
      let netColor = '#444';

      if (calorieGoal != null) {
        const diff = netKcal - calorieGoal; // >0 超標, <0 赤字
        netDisplayValue = Math.abs(Math.round(diff));

        if (diff > 0) {
          netStatusLabel = '超標';
          netColor = '#d64545';
        } else if (diff < 0) {
          netStatusLabel = '赤字';
          netColor = '#3b8c5a';
        } else {
          netStatusLabel = '達標';
          netColor = '#3eabbeff';
        }
      } else {
        netDisplayValue = Math.abs(Math.round(netKcal));
        const isDeficit = netKcal < 0;
        netStatusLabel = isDeficit ? '赤字(相對運動)' : '盈餘';
        netColor = isDeficit ? '#3b8c5a' : '#d64545';
      }

      const todayExerciseMinutes = todayExercises.reduce((s, e) => s + (e.minutes || 0), 0);

      const breakfastKcal = todayMeals.filter((m) => m.mealType === '早餐').reduce((s, m) => s + m.kcal, 0);
      const lunchKcal = todayMeals.filter((m) => m.mealType === '午餐').reduce((s, m) => s + m.kcal, 0);
      const dinnerKcal = todayMeals.filter((m) => m.mealType === '晚餐').reduce((s, m) => s + m.kcal, 0);
      const snackKcal = todayMeals.filter((m) => m.mealType === '點心').reduce((s, m) => s + m.kcal, 0);

      const breakfastProt = todayMeals.filter((m) => m.mealType === '早餐').reduce((s, m) => s + (m.protein ?? 0), 0);
      const breakfastCarb = todayMeals.filter((m) => m.mealType === '早餐').reduce((s, m) => s + (m.carb ?? 0), 0);
      const breakfastFat = todayMeals.filter((m) => m.mealType === '早餐').reduce((s, m) => s + (m.fat ?? 0), 0);

      const lunchProt = todayMeals.filter((m) => m.mealType === '午餐').reduce((s, m) => s + (m.protein ?? 0), 0);
      const lunchCarb = todayMeals.filter((m) => m.mealType === '午餐').reduce((s, m) => s + (m.carb ?? 0), 0);
      const lunchFat = todayMeals.filter((m) => m.mealType === '午餐').reduce((s, m) => s + (m.fat ?? 0), 0);

      const dinnerProt = todayMeals.filter((m) => m.mealType === '晚餐').reduce((s, m) => s + (m.protein ?? 0), 0);
      const dinnerCarb = todayMeals.filter((m) => m.mealType === '晚餐').reduce((s, m) => s + (m.carb ?? 0), 0);
      const dinnerFat = todayMeals.filter((m) => m.mealType === '晚餐').reduce((s, m) => s + (m.fat ?? 0), 0);

      const snackProt = todayMeals.filter((m) => m.mealType === '點心').reduce((s, m) => s + (m.protein ?? 0), 0);
      const snackCarb = todayMeals.filter((m) => m.mealType === '點心').reduce((s, m) => s + (m.carb ?? 0), 0);
      const snackFat = todayMeals.filter((m) => m.mealType === '點心').reduce((s, m) => s + (m.fat ?? 0), 0);

      // 1. 計算今日已攝取的總營養素 (原本只有算 Protein, 現在補上 C 與 F)
      const todayProtein = todayMeals.reduce((s, m) => s + (m.protein ?? 0), 0);
      const todayCarb = todayMeals.reduce((s, m) => s + (m.carb ?? 0), 0);
      const todayFat = todayMeals.reduce((s, m) => s + (m.fat ?? 0), 0);

      // 2. 計算目標 (Target)
      // 基準熱量：優先使用當日目標 (calorieGoal)，若無則用設定頁目標，再無則預設 2000
      const currentTargetKcal = calorieGoal || settings.calorieGoal || 2000;

      // 蛋白質目標 (P)：優先使用 settings.proteinGoal
      // 若沒設定，暫時用體重 * 1.2 推算
      const currentWeight = todaySummary.weight || 60;
      const targetP = (settings.proteinGoal && settings.proteinGoal > 0)
        ? settings.proteinGoal
        : (currentWeight * 1.2);

      // 脂肪目標 (F)：設定為總熱量的 30%
      const targetFatKcal = currentTargetKcal * 0.3;
      const targetF = targetFatKcal / 9;

      // 碳水目標 (C)：剩下的熱量給碳水
      const targetProtKcal = targetP * 4;
      const targetCarbKcal = currentTargetKcal - targetFatKcal - targetProtKcal;
      const targetC = targetCarbKcal > 0 ? targetCarbKcal / 4 : 0;

      // 計算剩餘可攝取熱量
      const remainingKcal = currentTargetKcal + todayBurn - todayIntake;

      // 1. 修改 saveBody：不再需要 silent 參數，因為永遠都不顯示成功通知
      function saveBody() {
        const patch: Partial<DaySummary> = {};

        if (editingBodyField === 'weight') {
          patch.weight = wInput ? Number(wInput) : undefined;
        } else if (editingBodyField === 'bf') {
          patch.bodyFat = bfInput ? Number(bfInput) : undefined;
        } else if (editingBodyField === 'sm') {
          patch.skeletalMuscle = smInput ? Number(smInput) : undefined;
        } else if (editingBodyField === 'vf') {
          patch.visceralFat = vfInput ? Number(vfInput) : undefined;
        }

        if (editingBodyField) {
          updateDay(todayLocal, patch);
          // 🟢 移除 showToast('success', ...)，只讓畫面數字更新作為回饋
        }
      }

      function addWaterManual() {
        if (!waterInput.trim()) return;
        const value = Number(waterInput);
        if (isNaN(value) || value <= 0) {
          showToast('error', '請輸入大於 0 的數字');
          return;
        }
        addWater(value);
        setWaterInput('');
      }

      return (
        <div className="page page-today" style={{ paddingBottom: '90px' }}>
          <header
            className="top-bar"
            style={{
              paddingTop: 'env(safe-area-inset-top)',
              height: 'auto',
              minHeight: '60px'
            }}
          >
            <div className="date-text" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>

              {/* 1. 月份標題 + 幽靈 Date Input + 今天按鈕 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0 8px' }}>
                <div style={{ flex: 1 }} />

                {/* 中間日期文字區塊：設為 relative 以便放置 absolute 的 input */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: 'var(--font-xs)', color: '#666', fontWeight: 500 }}>
                    {todayMonthLabel}
                    <span style={{ marginLeft: 4 }}>▼</span>
                  </div>


                  {/* 👻 幽靈 Input：蓋在文字上面，透明，點擊直接觸發原生月曆 */}
                  <input
                    type="date"
                    value={todayLocal}
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const newDate = e.target.value;
                      setTodayLocal(newDate);
                      // 同步更新週曆
                      const newWeekStart = dayjs(newDate).startOf('week').format('YYYY-MM-DD');
                      if (displayWeekStartRef.current !== newWeekStart) {
                        displayWeekStartRef.current = newWeekStart;
                        setWeekKey((k) => k + 1);
                      }
                    }}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      opacity: 0,
                      zIndex: 10,
                      cursor: 'pointer'
                    }}
                  />
                </div>

                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => {
                      const today = dayjs().format('YYYY-MM-DD');
                      setTodayLocal(today);
                      displayWeekStartRef.current = dayjs().startOf('week').format('YYYY-MM-DD');
                      setWeekKey(k => k + 1);
                    }}
                    style={{
                      padding: '4px 12px',
                      fontSize: 'var(--font-sm)',
                      fontWeight: 500,
                      color: todayLocal === dayjs().format('YYYY-MM-DD') ? '#fff' : '#97d0ba',
                      background: todayLocal === dayjs().format('YYYY-MM-DD') ? '#97d0ba' : 'transparent',
                      border: '1px solid #97d0ba',
                      borderRadius: 12,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    今天
                  </button>
                </div>
              </div>


              {/* 2. 週曆區域：加入左右箭頭 */}
              <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 4 }}>
                {/* 左箭頭 */}
                <button
                  onClick={() => {
                    displayWeekStartRef.current = dayjs(displayWeekStartRef.current)
                      .subtract(7, 'day')
                      .format('YYYY-MM-DD');
                    setWeekKey((k) => k + 1);

                  }}
                  style={{
                    padding: '0 4px',
                    border: 'none',
                    background: 'transparent',
                    color: '#ccc',
                    fontSize: 'var(--font-md)',
                    cursor: 'pointer',
                  }}
                >
                  ‹
                </button>

                {/*原本的滑動區塊 (保留 touch 事件) */}
                <div
                  ref={todayWeekSwipeRef}
                  style={{
                    flex: 1,
                    padding: '0',
                    touchAction: 'pan-y',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      gap: 4,
                      transform: `translateX(${weekSwipeOffset}px)`, // 🛝 跟手位移
                    }}
                  >
                    {Array.from({ length: 7 }).map((_, i) => {
                      const date = dayjs(displayWeekStartRef.current).add(i, 'day');
                      const dateStr = date.format('YYYY-MM-DD');
                      const isSelected = dateStr === todayLocal;
                      const isToday = dateStr === dayjs().format('YYYY-MM-DD');

                      return (
                        <button
                          key={dateStr}
                          onClick={() => setTodayLocal(dateStr)}
                          style={{
                            flex: 1,
                            height: 56,
                            borderRadius: 10,
                            border: isSelected ? '2px solid #97d0ba' : (isToday ? '2px solid #d1f0e3' : '1px solid #e9ecef'),
                            background: isSelected ? '#97d0ba' : (isToday ? '#fff' : 'transparent'),
                            color: isSelected ? '#fff' : (isToday ? '#97d0ba' : '#333'),
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 2,
                            boxShadow: isSelected ? '0 2px 8px rgba(151, 208, 186, 0.3)' : 'none',
                            padding: '6px 0', // 稍微縮小 padding 避免擠壓
                            minWidth: 0 // Flex child 縮放修正
                          }}
                        >
                          <span style={{ fontSize: 'var(--font-xs)', fontWeight: 500, opacity: isSelected ? 1 : 0.7 }}>
                            {date.format('ddd')}
                          </span>
                          <span style={{ fontSize: 'var(--font-sm)', fontWeight: isSelected ? 700 : (isToday ? 600 : 500) }}>
                            {date.format('D')}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 右箭頭 */}
                <button
                  onClick={() => {
                    displayWeekStartRef.current = dayjs(displayWeekStartRef.current)
                      .add(7, 'day')
                      .format('YYYY-MM-DD');
                    setWeekKey((k) => k + 1);

                  }}
                  style={{ padding: '0 4px', border: 'none', background: 'transparent', color: '#ccc', fontSize: 'var(--font-md)', cursor: 'pointer' }}
                >
                  ›
                </button>

              </div>

            </div>
            {/* 移除原本放在這裡的 hidden input，因為已經整併到上方標題裡了 */}
          </header>



          {/* ==== 新版 Hero Card (內縮漸層 + 白底營養素) ==== */}
          {/* ==== Hero Card (內縮漸層 + P/C/F 進度條) ==== */}
          <div className="hero-card">
            {/* 綠色漸層區塊 */}
            <div className="hero-gradient-block">

              <div className="hero-title">今日剩餘可攝取</div>
              <div className="hero-number">
                {Math.round(remainingKcal)}
                <span className="hero-unit">kcal</span>
              </div>
              <div className="hero-subtitle">
                目標 {currentTargetKcal} － 已吃 {Math.round(todayIntake)} ＋ 運動 {Math.round(todayBurn)}
              </div>
            </div>

            {/* 營養素區塊 (P/C/F) */}


            <div className="macro-grid">
              {/* 蛋白質 (P) */}
              <div className="macro-item">
                <div className="macro-label">蛋白質 (g)</div>
                <div className="macro-val">
                  {Math.round(todayProtein)}<span className="macro-limit">/{Math.round(targetP)}</span>
                </div>
                <div className="progress-mini-track">
                  <div
                    className="progress-mini-bar"
                    style={{
                      width: `${Math.min((todayProtein / targetP) * 100, 100)}%`,
                      background: '#5c9c84' // 綠色
                    }}
                  />
                </div>
              </div>

              {/* 碳水 (C) */}
              <div className="macro-item">
                <div className="macro-label">碳水 (g)</div>
                <div className="macro-val">
                  {Math.round(todayCarb)}<span className="macro-limit">/{Math.round(targetC)}</span>
                </div>
                <div className="progress-mini-track">
                  <div
                    className="progress-mini-bar"
                    style={{
                      width: `${Math.min((todayCarb / targetC) * 100, 100)}%`,
                      background: '#ffbe76' // 橘色
                    }}
                  />
                </div>
              </div>

              {/* 脂肪 (F) */}
              <div className="macro-item">
                <div className="macro-label">脂肪 (g)</div>
                <div className="macro-val">
                  {Math.round(todayFat)}<span className="macro-limit">/{Math.round(targetF)}</span>
                </div>
                <div className="progress-mini-track">
                  <div
                    className="progress-mini-bar"
                    style={{
                      width: `${Math.min((todayFat / targetF) * 100, 100)}%`,
                      background: '#ff7979' // 紅色
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="macro-legend">
              數值顯示：今日攝取量 / 目標
            </div>
          </div>

          <section className="card">
            <h2 style={{ display: 'flex', alignItems: 'center' }}>
              {/* 🆕 水的 Icon */}
              <img
                src={`${APP_BASE_URL}icons/water.png`}
                alt="water"
                style={{ width: 36, height: 36, marginRight: 6, objectFit: 'contain' }}
              />
              今日飲水
            </h2>

            {/* 1. 進度條 (藍色 #5eb6e6，代表水) */}
            <div className="section-progress-wrap">
              <div className="section-progress-info">
                <div>
                  <span className="section-progress-current" style={{ color: '#5eb6e6' }}>
                    {todaySummary.waterMl}
                  </span>
                  <span style={{ fontSize: 'var(--font-sm)', marginLeft: 2 }}>ml</span>

                </div>
                <div className="section-progress-target">
                  目標 {settings.waterGoalMl || 2000} ml
                </div>
              </div>
              <div className="section-progress-track">
                <div
                  className="section-progress-bar"
                  style={{
                    width: `${Math.min((todaySummary.waterMl / (settings.waterGoalMl || 2000)) * 100, 100)}%`,
                    background: '#5eb6e6'
                  }}
                />
              </div>
            </div>

            {/* 2. 快速增加按鈕 (淺藍色膠囊樣式) */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              {[100, 500, 1000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => addWater(amt)}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    borderRadius: '20px',
                    // 邊框：很淡的藍色
                    border: '1px solid #dcf2fa',
                    // 背景：極淺的藍色，呼應水的感覺
                    background: '#f0f9fc',
                    // 文字：使用飲水主題色
                    color: '#5eb6e6',
                    fontSize: 'var(--font-sm)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  +{amt}
                </button>
              ))}
            </div>
            {/* 3. 自訂輸入區 (按鈕改為品牌薄荷綠 #97d0ba) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: '#f9fafb',
              padding: '4px 4px 4px 16px',
              borderRadius: '99px',
              border: '1px solid #e9ecef'
            }}>
              <input
                type="number"
                value={waterInput}
                onChange={(e) => setWaterInput(e.target.value)}
                placeholder="自訂 ml..."
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'transparent',
                  fontSize: 'var(--font-xs)',
                  outline: 'none',
                  color: '#333'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addWaterManual();
                }}
              />
              <button
                onClick={addWaterManual}
                style={{
                  background: '#97d0ba', // ✅ 修正：使用品牌薄荷綠
                  color: '#fff',
                  border: 'none',
                  borderRadius: '99px',
                  padding: '8px 24px',
                  fontSize: 'var(--font-xs)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  flexShrink: 0,
                  boxShadow: '0 2px 5px rgba(151, 208, 186, 0.4)' // 陰影也調整為對應的薄荷色
                }}
              >
                加入
              </button>
            </div>
          </section>

          {/* 2x2 格狀排列的餐點卡片 */}
          <section className="card" style={{ background: 'transparent', boxShadow: 'none', border: 'none', padding: 0 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12
            }}>
              {/* 👇 [修改] 早餐卡片：改用 goToFoodRecord */}
              <MealCard
                title="早餐"
                kcal={breakfastKcal}
                protein={breakfastProt}
                carb={breakfastCarb}
                fat={breakfastFat}
                onAdd={() => goToFoodRecord('早餐')}
              />

              {/* 👇 [修改] 午餐卡片 */}
              <MealCard
                title="午餐"
                kcal={lunchKcal}
                protein={lunchProt}
                carb={lunchCarb}
                fat={lunchFat}
                onAdd={() => goToFoodRecord('午餐')}
              />

              {/* 👇 [修改] 晚餐卡片 */}
              <MealCard
                title="晚餐"
                kcal={dinnerKcal}
                protein={dinnerProt}
                carb={dinnerCarb}
                fat={dinnerFat}
                onAdd={() => goToFoodRecord('晚餐')}
              />

              {/* 👇 [修改] 點心卡片 */}
              <MealCard
                title="點心"
                kcal={snackKcal}
                protein={snackProt}
                carb={snackCarb}
                fat={snackFat}
                onAdd={() => goToFoodRecord('點心')}
              />
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <h2 style={{ display: 'flex', alignItems: 'center' }}>
                {/* 🆕 運動的 Icon */}
                <img
                  src={`${APP_BASE_URL}icons/exercise.png`}
                  alt="exercise"
                  style={{ width: 36, height: 36, marginRight: 8, objectFit: 'contain' }}
                />
                今日運動
              </h2>
              <button onClick={onAddExercise}>
                新增運動
              </button>
            </div>
            {/* 🆕 運動進度條 */}
            <div className="section-progress-wrap">
              <div className="section-progress-info">
                <div>
                  <span className="section-progress-current" style={{ color: '#f59e0b' }}>
                    {todayExerciseMinutes}
                  </span>
                  <span style={{ fontSize: 'var(--font-sm)', marginLeft: 2 }}>分鐘</span>
                </div>
                <div className="section-progress-target">
                  目標 {settings.exerciseMinutesGoal || 30} 分鐘
                </div>
              </div>
              <div className="section-progress-track">
                <div
                  className="section-progress-bar"
                  style={{
                    width: `${Math.min((todayExerciseMinutes / (settings.exerciseMinutesGoal || 30)) * 100, 100)}%`,
                    background: '#f59e0b' // 橘黃色
                  }}
                />
              </div>
            </div>
            <div>
              {todayExercises.length === 0 && (
                <div className="hint">今天尚未記錄運動</div>
              )}
              {todayExercises.map((e) => (
                <div key={e.id} className="list-item">
                  <div>
                    <div>{e.name}</div>
                    <div className="sub">
                      {e.minutes != null ? `${e.minutes} 分鐘 · ` : ''}
                      {e.kcal} kcal
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <h2 style={{ display: 'flex', alignItems: 'center' }}>
                <img src={`${APP_BASE_URL}icons/body.png`} alt="body" style={{ width: 36, height: 36, marginRight: 8, objectFit: 'contain' }} />
                今日身體紀錄
              </h2>

            </div>

            <div className="form-section">

              {/* 1. 頂部：體重焦點卡片 (Dashboard) */}
              {/* 修改說明：移除 wInput，只顯示 todaySummary.weight，確保顯示的是「已儲存」的穩定數據 */}
              <div
                className="weight-focus-card"
                onClick={() => openBodyInput('weight')}
              >
                <h3 className="label">目前體重</h3>

                <div className="weight-input-wrapper">
                  {/* 🔴 關鍵修改：這裡只讀取 todaySummary.weight */}
                  <span className="weight-val-huge">
                    {todaySummary.weight != null ? todaySummary.weight : '-'}
                  </span>
                  <span className="weight-unit-label">kg</span>
                </div>

                <div className="bmi-tag">
                  BMI {todaySummary.weight && userHeight
                    ? (todaySummary.weight / ((userHeight / 100) ** 2)).toFixed(1)
                    : '-'}
                </div>
              </div>

              {/* 2. 身體數據網格 (體脂/骨骼肌/內臟脂肪) */}
              <div className="body-metrics-grid">
                <div className="metric-box" onClick={() => openBodyInput('bf')}>
                  <label>體脂 %</label>
                  {/* 🔴 關鍵修改：移除 bfInput，只讀取 todaySummary.bodyFat */}
                  <div className="val">
                    {todaySummary.bodyFat != null ? todaySummary.bodyFat : '-'}
                  </div>
                </div>

                <div className="metric-box" onClick={() => openBodyInput('sm')}>
                  <label>骨骼肌 %</label>
                  {/* 🔴 關鍵修改：只讀取 todaySummary.skeletalMuscle */}
                  <div className="val">
                    {todaySummary.skeletalMuscle != null ? todaySummary.skeletalMuscle : '-'}
                  </div>
                </div>

                <div className="metric-box" onClick={() => openBodyInput('vf')}>
                  <label>內臟脂肪</label>
                  {/* 🔴 關鍵修改：只讀取 todaySummary.visceralFat */}
                  <div className="val">
                    {todaySummary.visceralFat != null ? todaySummary.visceralFat : '-'}
                  </div>
                </div>
              </div>

            </div>

            {/* 3. 掛載共用的數字鍵盤 (NumberPadModal) */}
            <NumberPadModal
              visible={!!editingBodyField} // 只要有選中欄位就顯示
              onClose={() => setEditingBodyField(null)}
              title={
                editingBodyField === 'weight' ? '輸入今日體重' :
                  editingBodyField === 'bf' ? '輸入體脂率' :
                    editingBodyField === 'sm' ? '輸入骨骼肌率' : '輸入內臟脂肪'
              }
              unit={
                editingBodyField === 'weight' ? 'kg' :
                  editingBodyField === 'vf' ? '' : '%'
              }
              // 根據目前的欄位決定顯示哪個數值
              value={
                editingBodyField === 'weight' ? wInput :
                  editingBodyField === 'bf' ? bfInput :
                    editingBodyField === 'sm' ? smInput :
                      editingBodyField === 'vf' ? vfInput : ''
              }
              // 根據目前的欄位決定要更新哪個 state
              onChange={(val) => {
                if (editingBodyField === 'weight') setWInput(val);
                if (editingBodyField === 'bf') setBfInput(val);
                if (editingBodyField === 'sm') setSmInput(val);
                if (editingBodyField === 'vf') setVfInput(val);
              }}
              // 內臟脂肪通可以有小數
              allowDecimal={true}
              onConfirm={saveBody}
            />
          </section>
        </div>
      );
    };


    // ======== 我的頁 ========

    type SettingsPageProps = {
      onOpenAbout: () => void;
      onOpenNumericKeyboard: (target: string, currentValue: string) => void;
    };

    const SettingsPage: React.FC<SettingsPageProps> = ({ onOpenAbout, onOpenNumericKeyboard }) => {
      const { showToast } = React.useContext(ToastContext);

      // 🟢 兌換碼相關 state（移到這裡）
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemEmail, setRedeemEmail] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);

  // 🆕 裝置管理相關 state
  const [showDeviceManagement, setShowDeviceManagement] = useState(false);
  const [deviceList, setDeviceList] = useState<any[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [deviceLimits, setDeviceLimits] = useState<any>(null);

  // 🟢 兌換碼處理函數（移到這裡）
  const handleRedeemCode = async () => {
    const code = redeemCode.trim().toUpperCase();
    const email = redeemEmail.trim().toLowerCase(); // 確保抓到輸入的 email 狀態
    
    if (!code || !email) {
        showToast('warning', '請輸入 Email 與兌換碼');
        return;
    }

    setIsRedeeming(true);

    try {
        const subscription = getSubscription();
        const deviceFingerprint = generateDeviceFingerprint();  // 🆕
        const deviceInfo = getDeviceInfo();                     // 🆕
        
        const response = await fetch('https://api.jusmilespace.com/redeem-founder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: subscription.userId,
                code: code,
                email: email,
                deviceFingerprint,  // 🆕
                deviceInfo,         // 🆕
            }),
        });

        const data = await response.json();

        // 🌟 嚴格阻斷：只要不是 200 OK，就絕對不准往下執行 updateSubscription
        if (!response.ok) {
            setIsRedeeming(false);
            if (response.status === 429) {
                showToast('error', '嘗試次數過多，請 1 小時後再試');
            } else if (response.status === 409) {
                showToast('error', '此兌換碼已被使用');
            } else if (response.status === 403) {
                // 🆕 區分不同的 403 錯誤
                if (data.activeDevices !== undefined) {
                    // 裝置上限錯誤
                    showToast('error', data.error || '裝置綁定已達上限');
                } else {
                    // Email 不符錯誤
                    showToast('error', 'Email 與購買紀錄不符，請檢查輸入是否正確');
                }
            } else {
                showToast('error', data.error || '兌換失敗');
            }
            return;
        }

        // ✅ 只有成功 (Status 200) 才會執行到這裡
        const founderNumber = parseInt(code.split('-')[2]);
        const referralCode = `REF${String(founderNumber).padStart(3, '0')}`;

        updateSubscription({
            type: 'founder',
            aiCredits: 3600,
            founderTier: data.founderTier,
            founderCode: code,
            referralCode: referralCode,
            email: email, 
        });

        showToast('success', `🎉 恭喜！您已升級為創始會員`);
        setRedeemCode('');
        setRedeemEmail('');

        // 延遲重整，讓用戶看到成功提示
        setTimeout(() => location.reload(), 2000);

    } catch (error) {
        console.error('兌換錯誤:', error);
        showToast('error', '網路連線異常，請稍後再試');
    } finally {
        setIsRedeeming(false);
    }
};

// 🆕 裝置管理：載入裝置列表
  const loadDeviceList = async () => {
    const subscription = getSubscription();
    if (subscription.type !== 'founder' || !subscription.founderCode) {
      return;
    }

    setIsLoadingDevices(true);

    try {
      const deviceFingerprint = generateDeviceFingerprint();
      const email = localStorage.getItem('JU_EMAIL') || redeemEmail;

      const response = await fetch('https://api.jusmilespace.com/list-devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          code: subscription.founderCode,
          currentDeviceFingerprint: deviceFingerprint,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setDeviceList(data.devices || []);
        setDeviceLimits(data.limits);
      } else {
        console.error('載入裝置列表失敗');
      }
    } catch (error) {
      console.error('載入裝置列表錯誤:', error);
    } finally {
      setIsLoadingDevices(false);
    }
  };

  // 🆕 裝置管理：解除裝置綁定
  const handleRemoveDevice = async (deviceFingerprint: string) => {
    if (!confirm('確定要解除此裝置的綁定嗎？解除後該裝置將無法繼續使用創始會員功能。')) {
      return;
    }

    const subscription = getSubscription();
    const email = localStorage.getItem('JU_EMAIL') || redeemEmail;

    try {
      const response = await fetch('https://api.jusmilespace.com/remove-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          code: subscription.founderCode,
          deviceFingerprint,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast('success', '已解除裝置綁定');
        loadDeviceList(); // 重新載入列表
      } else {
        showToast('error', data.error || '解除綁定失敗');
      }
    } catch (error) {
      console.error('解除綁定錯誤:', error);
      showToast('error', '網路連線異常');
    }
  };

  // 🆕 當顯示裝置管理時，自動載入列表
  useEffect(() => {
    if (showDeviceManagement) {
      loadDeviceList();
    }
  }, [showDeviceManagement]);


      // 🟢 新增：AI Key 狀態管理

      const [showApiGuide, setShowApiGuide] = useState(false);

      const [localSettings, setLocalSettings] = useState<Settings>(settings);

      const [showGuideModal, setShowGuideModal] = useState(false);



      // 🆕 新增編輯常用組合的狀態
      const [editingCombo, setEditingCombo] = useState<MealCombo | null>(null);
      const [editingComboName, setEditingComboName] = useState('');
      const [showComboManageModal, setShowComboManageModal] = useState(false); // 🆕 新增
      // 🆕 新增：用於編輯組合明細的狀態
      const [editingComboItems, setEditingComboItems] = useState<ComboItem[]>([]);

      // 🆕 編輯組合項目的熱量輸入
      const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
      const [showEditItemKcalPad, setShowEditItemKcalPad] = useState(false);

      // 🆕 臨時儲存正在輸入的數值（字串格式，保留小數點）
      const [tempInputValue, setTempInputValue] = useState<string>('');

      // 🆕 控制各個數字鍵盤的顯示
      const [showTargetWeightPad, setShowTargetWeightPad] = useState(false);
      const [showCalorieGoalPad, setShowCalorieGoalPad] = useState(false);
      const [showProteinGoalPad, setShowProteinGoalPad] = useState(false);
      const [showWaterGoalPad, setShowWaterGoalPad] = useState(false);
      const [showBodyFatGoalPad, setShowBodyFatGoalPad] = useState(false);
      const [showSkeletalMuscleGoalPad, setShowSkeletalMuscleGoalPad] = useState(false);
      const [showVisceralFatGoalPad, setShowVisceralFatGoalPad] = useState(false);
      const [showExerciseMinutesGoalPad, setShowExerciseMinutesGoalPad] = useState(false);

      // 🆕 用於數字輸入
      const [editingField, setEditingField] = useState<string | null>(null);

      const fileInputRef = useRef<HTMLInputElement | null>(null);

      // 儲存目標設定
      function saveSettings() {
        setSettings(localSettings);

        // 如果有輸入目標攝取熱量，就把「今天」這一天的日目標也一起更新
        if (
          localSettings.calorieGoal != null &&
          localSettings.calorieGoal > 0
        ) {
          const todayYMD = dayjs().format('YYYY-MM-DD');
          setDays((prev) => {
            const idx = prev.findIndex((d) => d.date === todayYMD);
            if (idx === -1) {
              const newDay: DaySummary = {
                date: todayYMD,
                waterMl: 0,
                calorieGoalKcal: localSettings.calorieGoal!,
              };
              return [...prev, newDay];
            }
            const copy = [...prev];
            copy[idx] = {
              ...copy[idx],
              calorieGoalKcal: localSettings.calorieGoal!,
            };
            return copy;
          });
        }

        showToast('success', '已儲存目標設定');
      }
      // 🆕 儲存數字輸入
      function saveNumberInput(value: string) {
        const num = Number(value);

        if (editingField === 'targetWeight') {
          setLocalSettings((s) => ({ ...s, targetWeight: num || undefined }));
        }
        else if (editingField === 'calorieGoal') {
          setLocalSettings((s) => ({ ...s, calorieGoal: num || undefined }));
        }
        else if (editingField === 'proteinGoal') {
          setLocalSettings((s) => ({ ...s, proteinGoal: num || undefined }));
        }
        else if (editingField === 'waterGoalMl') {
          setLocalSettings((s) => ({ ...s, waterGoalMl: num || undefined }));
        }
        else if (editingField === 'bodyFatGoal') {
          setLocalSettings((s) => ({ ...s, bodyFatGoal: num || undefined }));
        }
        else if (editingField === 'skeletalMuscleGoal') {
          setLocalSettings((s) => ({ ...s, skeletalMuscleGoal: num || undefined }));
        }
        else if (editingField === 'visceralFatGoal') {
          setLocalSettings((s) => ({ ...s, visceralFatGoal: num || undefined }));
        }
        else if (editingField === 'exerciseMinutesGoal') {
          setLocalSettings((s) => ({ ...s, exerciseMinutesGoal: num || undefined }));
        }

        setEditingField(null);
      }

      // 🆕 儲存常用組合的編輯（包含明細）
      function saveComboEdit() {
        if (!editingCombo || !editingComboName.trim()) return;

        if (editingComboItems.length === 0) {
          showToast('error', '組合中必須至少包含一項食物明細。');
          return;
        }

        setCombos((prev) =>
          prev.map((c) =>
            c.id === editingCombo.id
              ? {
                ...c,
                name: editingComboName.trim(),
                items: editingComboItems,
              }
              : c
          )
        );

        const oldName = editingCombo.name;
        const newName = editingComboName.trim();

        setEditingCombo(null);
        setEditingComboName('');
        setEditingComboItems([]);

        showToast('success', `組合「${oldName}」已更新並更名為「${newName}」`);
      }

      // 🆕 刪除常用組合
      function deleteCombo(id: string) {
        if (window.confirm('確定要刪除這個常用組合嗎？')) {
          setCombos((prev) => prev.filter((c) => c.id !== id));
          showToast('success', '已刪除常用組合');
        }
      }


      function handleExportJson() {
        const data = {
          settings,
          days,
          meals,
          exercises,
          combos, // 匯出常用組合
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ju-smile-app-backup-${dayjs().format(
          'YYYYMMDD-HHmmss'
        )}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }

      function handleImportClick() {
        fileInputRef.current?.click();
      }

      function handleImportJson(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const obj = JSON.parse(reader.result as string);
            if (obj.settings) setSettings(obj.settings);
            if (obj.days) setDays(obj.days);
            if (obj.meals) setMeals(obj.meals);
            if (obj.exercises) setExercises(obj.exercises);
            if (obj.combos) setCombos(obj.combos);
            showToast('success', '匯入完成');
          } catch {
            showToast('error', '匯入失敗:JSON 格式不正確');
          }
        };
        reader.readAsText(file);
      }

      function handleBackupToDrive() {
        // 先匯出 JSON（觸發下載）
        handleExportJson();

        // 為了相容手機瀏覽器，延遲一點再開啟 Google Drive，
        // 避免只執行最後一個 window.open，看起來像「還沒下載就直接跳走」。
        setTimeout(() => {
          try {
            window.open('https://drive.google.com/drive/my-drive', '_blank');
          } catch {
            // ignore popup block
          }
        }, 800);
      }


      return (
        <div className="page page-settings" style={{ paddingBottom: '100px', background: '#f5fbf8' }}>

          {/* 頁面標題 - 修改後 (Logo 靠左，緊鄰標題) */}
          <div style={{
            padding: '12px 16px 20px',
            display: 'flex',           // 彈性排版
            alignItems: 'center',      // 垂直置中
            paddingTop: 'calc(12px + env(safe-area-inset-top))'
          }}>
            {/* 左側：文字區 */}
            <div>
              <h1 style={{ margin: 0, fontSize: '22px', color: '#1f2937' }}>我的設定</h1>
              <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '14px' }}>
                打造專屬於你的健康計畫
              </p>
            </div>

            {/* 右側：Logo */}
            <img
              src={logoV1}
              alt="Ju Smile"
              style={{
                width: '64px',
                height: 'auto',
                objectFit: 'contain',
                marginLeft: '120px'  // 🟢 設定 Logo 與文字的距離
              }}
            />
          </div>
          <section className="card">
            {/* 🟢 訂閱與升級區塊 */}
            <div style={{ marginBottom: 30 }}>
              <h3 style={{
                marginTop: 0,
                marginBottom: 16,
                fontSize: 20,
                color: '#1f2937',
                borderBottom: '2px solid #e5e7eb',
                paddingBottom: 12,
              }}>
                💎 訂閱與升級
              </h3>

              {/* 當前訂閱狀態 */}
              {(() => {
                const sub = getSubscription();
                return (
                  <div style={{
                    padding: '16px',
                    background: sub.type === 'free' ? '#fef3c7' : '#d1fae5',
                    borderRadius: '12px',
                    marginBottom: '20px',
                    border: `2px solid ${sub.type === 'free' ? '#fbbf24' : '#10b981'}`,
                  }}>
                    <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>
                      您的當前方案
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 'bold', color: '#1f2937' }}>
                      {sub.type === 'free' && '🆓 免費版'}
                      {sub.type === 'founder' && '🌟 創始會員（終身）'}
                      {sub.type === 'monthly' && '💎 月訂閱會員'}
                      {sub.type === 'yearly' && '💎 年訂閱會員'}
                    </div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginTop: 8 }}>
  {sub.type === 'free' && '每日 1 次 AI 辨識（30 次/月）'}
  {sub.type === 'founder' && '終身 3,600 次 AI 辨識 • 未來功能專屬折扣'}
  {sub.type === 'monthly' && '每月 60 次 AI 辨識（可累積 3 個月）• 完整功能'}
  {sub.type === 'yearly' && '每年 720 次 AI 辨識（期內有效）• 完整功能'}
</div>
{sub.type === 'founder' && sub.founderCode && (
  <div style={{
    marginTop: 12,
    padding: '8px 12px',
    background: 'rgba(16, 185, 129, 0.1)',
    borderRadius: '6px',
    fontSize: 12,
    color: '#059669',
  }}>
    {/* 🟢 新增：顯示創始會員階段 */}
    {sub.founderTier && (
      <>
        ✨ 階段：
        {sub.founderTier === 'super-early-bird' && '超級早鳥'}
        {sub.founderTier === 'early-bird' && '早鳥優惠'}
        {sub.founderTier === 'founder' && '創始會員'}
        <br/>
      </>
    )}
    💚 您的創始會員編號：{sub.founderCode}<br/>
    感謝您的支持讓 Ju Smile 不斷進步
  </div>
)}
                  </div>
                );
              })()}

              {/* 創始會員購買區塊（只在免費版顯示） */}
{(() => {
  const sub = getSubscription();
  if (sub.type !== 'free') return null;

  // ✅ 檢測平台
  const isIOS = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

  if (isIOS) {
    // 🔒 iOS 版本：只顯示兌換碼輸入（選項 3 - 最安全）
    return (
      <div style={{
        padding: '20px',
        background: '#f9fafb',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        marginBottom: '20px',
      }}>
        <h4 style={{ 
          margin: '0 0 12px', 
          fontSize: 16, 
          fontWeight: 'bold', 
          color: '#1f2937',
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          🌟 升級創始會員
        </h4>
        
        <div style={{ 
          fontSize: 13, 
          color: '#6b7280', 
          marginBottom: 16, 
          lineHeight: 1.6,
          padding: '12px',
          background: '#fef3c7',
          borderRadius: '8px',
          border: '1px solid #fbbf24'
        }}>
          ✨ 升級後可享：<br/>
          • 終身 3,600 次 AI 識別額度<br/>
          • 專屬創始會員編號<br/>
  • 獨家禮物與 VIP 折扣權益<br/>
  • 未來新功能搶先體驗
        </div>

        <div style={{ 
  fontSize: 13, 
  color: '#6b7280', 
  marginBottom: 16, 
  lineHeight: 1.5,
  textAlign: 'center'
}}>
  已有兌換碼？請在下方輸入<br/>
  <span style={{ fontSize: 11, color: '#9ca3af' }}>
    更多資訊請參考 App 內「關於」頁面或官網
  </span>
</div>
      </div>
    );
  }

  // 🌐 Web 版本：顯示完整價格和購買資訊
  return (
    <div style={{
      padding: '20px',
      background: 'linear-gradient(135deg, #97d0ba 0%, #5c9c84 100%)',
      borderRadius: '16px',
      color: 'white',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      marginBottom: '20px',
    }}>
      <h4 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 'bold', textAlign: 'center' }}>
        🌟 創始會員計畫
      </h4>

      {/* AI 額度說明 */}
      <div style={{
        background: 'rgba(255,255,255,0.2)',
        padding: '12px',
        borderRadius: '8px',
        marginBottom: '16px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 14, marginBottom: 4 }}>
          ✨ 終身 AI 識別額度
        </div>
        <div style={{ fontSize: 32, fontWeight: 'bold', margin: '4px 0' }}>
          3,600 次
        </div>
        <div style={{ fontSize: 12, opacity: 0.9 }}>
          終身有效 • 永不過期
        </div>
      </div>

      {/* 三階段定價卡片 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
        <div style={{
          background: 'rgba(255,255,255,0.95)',
          padding: '14px',
          borderRadius: '10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          border: '2px solid #ff6b6b',
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: '#ff6b6b' }}>
              超級早鳥
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
              限量 100 位
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 'bold', color: '#ff6b6b' }}>
            NT$ 1,280
          </div>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.95)',
          padding: '14px',
          borderRadius: '10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          border: '2px solid #ffa500',
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: '#ffa500' }}>
              早鳥優惠
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
              限量 200 位
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 'bold', color: '#ffa500' }}>
            NT$ 1,480
          </div>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.95)',
          padding: '14px',
          borderRadius: '10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          border: '2px solid #5c9c84',
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: '#5c9c84' }}>
              創始會員
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
              限量 200 位
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 'bold', color: '#5c9c84' }}>
            NT$ 1,680
          </div>
        </div>
      </div>

      {/* 購買按鈕 */}
      <button
        onClick={() => {
          window.open('https://jusmilespace.com#pricing', '_blank');
        }}
        style={{
          width: '100%',
          padding: '14px',
          background: 'white',
          color: '#5c9c84',
          border: 'none',
          borderRadius: '10px',
          fontSize: 16,
          fontWeight: 'bold',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}
      >
        前往付款頁面 →
      </button>

      <div style={{
        marginTop: 10,
        fontSize: 11,
        opacity: 0.85,
        textAlign: 'center',
      }}>
        付款後將自動取得兌換碼，請在下方輸入兌換碼升級
      </div>
    </div>
  );
})()}

              {/* 兌換碼輸入區塊（可選，如果你想用兌換碼系統） */}
              {(() => {
                const sub = getSubscription();
                if (sub.type !== 'free') return null;

                return (
                  <div style={{
                    padding: '16px',
                    background: '#f9fafb',
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb',
                  }}>
                    <label style={{
                      display: 'block',
                      marginBottom: 8,
                      fontSize: 14,
                      fontWeight: 'bold',
                      color: '#1f2937',
                    }}>
                      🎁 有兌換碼？
                    </label>
                    {/* 🌟 新增：Email 輸入框 */}
  <input
    type="email"
    value={redeemEmail}
    onChange={(e) => setRedeemEmail(e.target.value)}
    placeholder="購買時使用的 Email"
    style={{
      width: '100%',
      padding: '10px',
      border: '1px solid #d1d5db',
      borderRadius: '8px',
      fontSize: 14,
      marginBottom: '10px', // 與下方序號框保持距離
    }}
  />
                    <input
  type="text"
  value={redeemCode}
  onChange={(e) => setRedeemCode(e.target.value)}  // 🟢 移除 toUpperCase()
  placeholder="請輸入您的兌換碼"
  maxLength={18}
  autoCapitalize="characters"  // 🟢 新增：讓 iOS 自動大寫
  autoCorrect="off"  // 🟢 新增：關閉自動修正
  autoComplete="off"  // 🟢 新增：關閉自動完成
  spellCheck={false}  // 🟢 新增：關閉拼字檢查
  style={{
    width: '100%',
    padding: '10px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: 14,
    marginBottom: '8px',
    fontFamily: 'monospace',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',  // 🟢 新增：CSS 大寫顯示
  }}
/>


                    <button
                      onClick={handleRedeemCode}
                      disabled={isRedeeming || !redeemCode.trim()}
                      style={{
                        width: '100%',
                        padding: '10px',
                        background: (isRedeeming || !redeemCode.trim()) ? '#9ca3af' : '#5c9c84',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: 14,
                        fontWeight: 'bold',
                        cursor: (isRedeeming || !redeemCode.trim()) ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isRedeeming ? '驗證中...' : '兌換'}
                    </button>
                  </div>
                );
              })()}
              {/* 🆕 裝置管理區塊 - 只有創始會員才顯示 */}
              {(() => {
                const subscription = getSubscription();
                if (subscription.type !== 'founder' || !subscription.founderCode) {
                  return null;
                }

                return (
                  <div style={{
                    marginTop: '20px',
                    padding: '20px',
                    background: '#f8f9fa',
                    borderRadius: '12px',
                    border: '1px solid #e0e0e0',
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '15px',
                    }}>
                      <h3 style={{ 
                        margin: 0,
                        fontSize: '18px',
                        color: '#333',
                      }}>
                        🔧 已綁定的裝置
                      </h3>
                      <button
                        onClick={() => {
                          setShowDeviceManagement(!showDeviceManagement);
                          if (!showDeviceManagement) {
                            loadDeviceList();
                          }
                        }}
                        style={{
                          padding: '8px 16px',
                          background: 'white',
                          border: '1px solid #ddd',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '14px',
                        }}
                      >
                        {showDeviceManagement ? '收起' : '查看'}
                      </button>
                    </div>

                    {showDeviceManagement && (
                      <div>
                        {isLoadingDevices ? (
                          <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                            載入中...
                          </div>
                        ) : deviceList.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                            尚無綁定裝置
                          </div>
                        ) : (
                          <>
                            {deviceList.map((device, index) => (
                              <div
                                key={index}
                                style={{
                                  padding: '15px',
                                  background: device.isCurrent ? '#e3f2fd' : 'white',
                                  border: `1px solid ${device.isCurrent ? '#2196f3' : '#ddd'}`,
                                  borderRadius: '8px',
                                  marginBottom: '10px',
                                }}
                              >
                                <div style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ 
                                      fontSize: '16px', 
                                      fontWeight: 'bold',
                                      marginBottom: '5px',
                                      color: '#333',
                                    }}>
                                      {device.platform === 'ios' && '📱'}
                                      {device.platform === 'android' && '📱'}
                                      {device.platform === 'web' && '💻'}
                                      {device.platform === 'unknown' && '🔹'}
                                      {' '}
                                      {device.platform.toUpperCase()}
                                      {device.browser && ` (${device.browser})`}
                                    </div>
                                    <div style={{ fontSize: '13px', color: '#666' }}>
                                      最後使用：{device.lastUsed}
                                      {device.daysInactive > 0 && ` (${device.daysInactive} 天前)`}
                                    </div>
                                    <div style={{ 
                                      marginTop: '5px',
                                      display: 'flex',
                                      gap: '8px',
                                    }}>
                                      {device.isCurrent && (
                                        <span style={{
                                          fontSize: '12px',
                                          padding: '2px 8px',
                                          background: '#2196f3',
                                          color: 'white',
                                          borderRadius: '4px',
                                        }}>
                                          目前裝置
                                        </span>
                                      )}
                                      {device.isActive ? (
                                        <span style={{
                                          fontSize: '12px',
                                          padding: '2px 8px',
                                          background: '#4caf50',
                                          color: 'white',
                                          borderRadius: '4px',
                                        }}>
                                          活躍
                                        </span>
                                      ) : (
                                        <span style={{
                                          fontSize: '12px',
                                          padding: '2px 8px',
                                          background: '#9e9e9e',
                                          color: 'white',
                                          borderRadius: '4px',
                                        }}>
                                          閒置
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {!device.isCurrent && (
                                    <button
                                      onClick={() => handleRemoveDevice(device.deviceFingerprint)}
                                      style={{
                                        padding: '8px 12px',
                                        background: '#f44336',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                      }}
                                    >
                                      解除綁定
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}

                            {/* 裝置數量統計 */}
                            {deviceLimits && (
                              <div style={{
                                marginTop: '15px',
                                padding: '12px',
                                background: '#fff3cd',
                                border: '1px solid #ffc107',
                                borderRadius: '6px',
                                fontSize: '14px',
                                color: '#856404',
                              }}>
                                <div style={{ marginBottom: '5px' }}>
                                  ✅ 活躍裝置：{deviceList.filter(d => d.isActive).length}/{deviceLimits.maxActive}
                                </div>
                                <div>
                                  📊 總綁定數：{deviceList.length}/{deviceLimits.maxTotal}
                                </div>
                                <div style={{ 
                                  marginTop: '8px', 
                                  fontSize: '12px',
                                  color: '#666',
                                }}>
                                  💡 {deviceLimits.activeDays} 天內使用過的裝置視為「活躍」
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

            </div>
          </section>

          {/* 第一組：核心計畫 */}
          <div className="settings-group-title">📅 減重與核心計畫</div>
          <div className="settings-list-card">
            {/* 起始日 */}
            <div className="settings-row">
              <div className="settings-row-text">
                <div className="settings-label">開始減重日期</div>
              </div>
              <input
                type="date"
                value={localSettings.startDate || ''}
                onChange={(e) =>
                  setLocalSettings((s) => ({ ...s, startDate: e.target.value || undefined }))
                }
                style={{
                  border: 'none',
                  textAlign: 'right',
                  background: 'transparent',
                  fontSize: 16,
                  color: 'var(--mint-dark)',
                  fontFamily: 'inherit',
                  outline: 'none'
                }}
              />
            </div>

            {/* 達成日 */}
            <div className="settings-row">
              <div className="settings-row-text">
                <div className="settings-label">預計達成日期</div>
              </div>
              <input
                type="date"
                value={localSettings.targetDate || ''}
                onChange={(e) =>
                  setLocalSettings((s) => ({ ...s, targetDate: e.target.value || undefined }))
                }
                style={{
                  border: 'none',
                  textAlign: 'right',
                  background: 'transparent',
                  fontSize: 16,
                  color: 'var(--mint-dark)',
                  fontFamily: 'inherit',
                  outline: 'none'
                }}
              />
            </div>

            {/* 目標體重 */}
            <div
              className="settings-row"
              onClick={() => {
                setTempInputValue(String(localSettings.targetWeight ?? ''));
                setShowTargetWeightPad(true);
              }}
            >
              <div className="settings-row-text">
                <div className="settings-label">目標體重</div>
                <div className="settings-hint">設定您想達成的體重</div>
              </div>
              <div className={`settings-value ${!localSettings.targetWeight ? 'placeholder' : ''}`}>
                {localSettings.targetWeight ? `${localSettings.targetWeight} kg` : '未設定'} <span className="chevron">›</span>
              </div>
            </div>

            {/* 熱量目標 */}
            <div
              className="settings-row"
              onClick={() => {
                setTempInputValue(String(localSettings.calorieGoal ?? ''));
                setShowCalorieGoalPad(true);
              }}
            >
              <div className="settings-row-text">
                <div className="settings-label">每日熱量目標</div>
                <div className="settings-hint">建議：TDEE 減去 300~500 kcal</div>
              </div>
              <div className={`settings-value ${!localSettings.calorieGoal ? 'placeholder' : ''}`}>
                {localSettings.calorieGoal ? `${localSettings.calorieGoal} kcal` : '未設定'} <span className="chevron">›</span>
              </div>
            </div>
          </div>

          {/* 第二組：身體數值目標 (補回詳細建議) */}
          <div className="settings-group-title">📊 進階身體指標</div>
          <div className="settings-list-card">

            {/* 蛋白質 */}
            <div className="settings-row" onClick={() => { setTempInputValue(String(localSettings.proteinGoal ?? '')); setShowProteinGoalPad(true); }}>
              <div className="settings-row-text">
                <div className="settings-label">蛋白質目標</div>
                <div className="settings-hint">建議：1.2 ~ 1.6g × 體重(kg)</div>
              </div>
              <div className={`settings-value ${!localSettings.proteinGoal ? 'placeholder' : ''}`}>
                {localSettings.proteinGoal ? `${localSettings.proteinGoal} g` : '未設定'} <span className="chevron">›</span>
              </div>
            </div>

            {/* 飲水 */}
            <div className="settings-row" onClick={() => { setTempInputValue(String(localSettings.waterGoalMl ?? '')); setShowWaterGoalPad(true); }}>
              <div className="settings-row-text">
                <div className="settings-label">飲水目標</div>
                <div className="settings-hint">建議：30 ~ 35ml × 體重(kg)</div>
              </div>
              <div className={`settings-value ${!localSettings.waterGoalMl ? 'placeholder' : ''}`}>
                {localSettings.waterGoalMl ? `${localSettings.waterGoalMl} ml` : '未設定'} <span className="chevron">›</span>
              </div>
            </div>

            {/* 運動時間 */}
            <div className="settings-row" onClick={() => { setTempInputValue(String(localSettings.exerciseMinutesGoal ?? '')); setShowExerciseMinutesGoalPad(true); }}>
              <div className="settings-row-text">
                <div className="settings-label">運動時間目標</div>
                <div className="settings-hint">建議每週至少 150 分鐘</div>
              </div>
              <div className={`settings-value ${!localSettings.exerciseMinutesGoal ? 'placeholder' : ''}`}>
                {localSettings.exerciseMinutesGoal ? `${localSettings.exerciseMinutesGoal} min` : '未設定'} <span className="chevron">›</span>
              </div>
            </div>

            {/* 體脂率 */}
            <div className="settings-row" onClick={() => { setTempInputValue(String(localSettings.bodyFatGoal ?? '')); setShowBodyFatGoalPad(true); }}>
              <div className="settings-row-text">
                <div className="settings-label">體脂率目標</div>
                <div className="settings-hint">標準：男 8-19% / 女 20-30%</div>
              </div>
              <div className={`settings-value ${!localSettings.bodyFatGoal ? 'placeholder' : ''}`}>
                {localSettings.bodyFatGoal ? `${localSettings.bodyFatGoal}%` : '未設定'} <span className="chevron">›</span>
              </div>
            </div>

            {/* 骨骼肌率 */}
            <div className="settings-row" onClick={() => { setTempInputValue(String(localSettings.skeletalMuscleGoal ?? '')); setShowSkeletalMuscleGoalPad(true); }}>
              <div className="settings-row-text">
                <div className="settings-label">骨骼肌率目標</div>
                <div className="settings-hint">標準：男 33-39% / 女 24-30%</div>
              </div>
              <div className={`settings-value ${!localSettings.skeletalMuscleGoal ? 'placeholder' : ''}`}>
                {localSettings.skeletalMuscleGoal ? `${localSettings.skeletalMuscleGoal}%` : '未設定'} <span className="chevron">›</span>
              </div>
            </div>

            {/* 內臟脂肪 */}
            <div className="settings-row" onClick={() => { setTempInputValue(String(localSettings.visceralFatGoal ?? '')); setShowVisceralFatGoalPad(true); }}>
              <div className="settings-row-text">
                <div className="settings-label">內臟脂肪目標</div>
                <div className="settings-hint">建議標準 ≤ 9</div>
              </div>
              <div className={`settings-value ${!localSettings.visceralFatGoal ? 'placeholder' : ''}`}>
                {localSettings.visceralFatGoal ? localSettings.visceralFatGoal : '未設定'} <span className="chevron">›</span>
              </div>
            </div>
          </div>

          <div style={{ padding: '0 16px 24px' }}>
            <button className="primary" style={{ width: '100%', fontSize: 18, padding: '14px', borderRadius: 12 }} onClick={saveSettings}>
              儲存所有目標設定
            </button>
          </div>

          {/* 第三組：資料管理 */}
          <div className="settings-group-title">📂 資料庫與管理</div>
          <div className="settings-list-card">
            {/* 常用組合 */}
            <div className="settings-row" onClick={() => setShowComboManageModal(true)}>
              <div className="settings-label">📋 管理常用飲食組合</div>
              <div className="settings-value">
                {combos.length} 組 <span className="chevron">›</span>
              </div>
            </div>

            {/* 資料來源同步 (CSV) - 簡化版 */}
            <div className="settings-row" style={{ display: 'block', height: 'auto', padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div className="settings-row-text">
                  <div className="settings-label">🔄 外部資料同步 (CSV)</div>
                  <div className="settings-hint">更新食物與運動資料庫</div>
                </div>
                <button className="small" onClick={syncCsv} disabled={csvLoading}>
                  {csvLoading ? '同步中…' : '立即同步'}
                </button>
              </div>
              {csvError && <div style={{ color: '#e02424', fontSize: 13, marginBottom: 8 }}>{csvError}</div>}

              <details style={{ fontSize: 13, color: '#666' }}>
                <summary style={{ cursor: 'pointer', outline: 'none' }}>進階：編輯 CSV 來源連結</summary>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  <input className="settings-input-clean" value={srcType} onChange={e => setSrcType(e.target.value)} placeholder="Type Table URL" style={{ background: '#f3f4f6', padding: 8, borderRadius: 6, width: '100%', boxSizing: 'border-box' }} />
                  <input className="settings-input-clean" value={srcUnit} onChange={e => setSrcUnit(e.target.value)} placeholder="Unit Map URL" style={{ background: '#f3f4f6', padding: 8, borderRadius: 6, width: '100%', boxSizing: 'border-box' }} />
                  <input className="settings-input-clean" value={srcFood} onChange={e => setSrcFood(e.target.value)} placeholder="Food DB URL" style={{ background: '#f3f4f6', padding: 8, borderRadius: 6, width: '100%', boxSizing: 'border-box' }} />
                  <input className="settings-input-clean" value={srcMet} onChange={e => setSrcMet(e.target.value)} placeholder="Exercise Met URL" style={{ background: '#f3f4f6', padding: 8, borderRadius: 6, width: '100%', boxSizing: 'border-box' }} />
                </div>
              </details>
            </div>
          </div>

          <div className="settings-group-title">💡 幫助與參考</div>
          <div className="settings-list-card">
            <div className="settings-row" onClick={() => setShowGuideModal(true)}>
              <div className="settings-row-text">
                <div className="settings-label">📖 使用教學 & 份量參考</div>
                <div className="settings-hint">手掌法估算、搜尋技巧說明</div>
              </div>
              <div className="settings-value"><span className="chevron">›</span></div>
            </div>
          </div>

          {/* --- 新增：醫療聲明與資料來源 (解決 Guideline 1.4.1) --- */}
          <div className="settings-group-title">⚖️ 資料來源與免責聲明</div>
          <div className="settings-list-card" style={{ display: 'block', padding: '16px 20px' }}>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 8px 0', lineHeight: 1.5 }}>
              本應用程式之營養資訊與手掌估算數據，參考自：
            </p>
            <ul style={{ paddingLeft: '20px', margin: '8px 0', fontSize: '14px', color: '#6b7280', lineHeight: 1.6 }}>
              <li style={{ marginBottom: 4 }}>
                <a href="https://consumer.fda.gov.tw/Food/TFND.aspx?nodeID=178" target="_blank" rel="noopener noreferrer" style={{ color: '#5c9c84', textDecoration: 'underline' }}>
                  TFDA 台灣食品成分資料庫
                </a>
              </li>
              <li>
                <a href="https://www.hpa.gov.tw/Pages/EBook.aspx?nodeid=1208" target="_blank" rel="noopener noreferrer" style={{ color: '#5c9c84', textDecoration: 'underline' }}>
                  國健署 - 食物代換表 (2019)
                </a>
              </li>
            </ul>
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #eee', fontSize: '13px', color: '#9ca3af', lineHeight: 1.5 }}>
              <strong style={{ color: '#d64545' }}>⚠️ 注意：</strong>本應用程式提供之數據僅供參考，不應視為醫療建議。在做出任何醫療決定前，請務必諮詢專業醫療人員。
            </div>
          </div>


          {/* 第四組：備份與還原 */}
          <div className="settings-group-title">☁️ 備份與還原</div>
          <div className="settings-list-card">
            <div className="settings-row" onClick={handleExportJson}>
              <div className="settings-label">📤 匯出備份 (JSON)</div>
              <div className="settings-value"><span className="chevron">›</span></div>
            </div>

            <div className="settings-row" onClick={handleBackupToDrive}>
              <div className="settings-label">☁️ 一鍵備份到 Google Drive</div>
              <div className="settings-value"><span className="chevron">›</span></div>
            </div>

            <div className="settings-row" onClick={handleImportClick}>
              <div className="settings-label">📥 匯入備份 (JSON)</div>
              <div className="settings-value"><span className="chevron">›</span></div>
            </div>
            <input
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              ref={fileInputRef}
              onChange={handleImportJson}
            />
          </div>

          {/* 底部區域 */}
          <div style={{ padding: '0 16px', textAlign: 'center' }}>
            <InstallGuideWidget />

            <div style={{ marginTop: 24, paddingBottom: 24 }}>
              <button
                className="secondary"
                onClick={onOpenAbout}
                style={{ borderRadius: 999, padding: '8px 24px', background: '#fff', border: '1px solid #ddd' }}
              >
                ℹ️ 關於 App
              </button>
              <div style={{ marginTop: 12, fontSize: 12, color: '#999' }}>Version {APP_VERSION}</div>
            </div>
          </div>


          {/* ================= MODALS 保持原樣 ================= */}

          {/* 編輯常用組合彈窗 */}
          {editingCombo && (
            <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px 0' }}>
              <div className="modal" style={{ background: '#fff', borderRadius: 12, padding: 16, maxWidth: 400, width: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                <h3 style={{ marginTop: 0 }}>編輯組合：{editingCombo.name}</h3>
                <div className="form-section">
                  <label>
                    組合名稱
                    <input value={editingComboName} onChange={(e) => setEditingComboName(e.target.value)} placeholder="例如：午餐便當組合" style={{ width: '100%', padding: 8, marginTop: 4 }} />
                  </label>
                </div>
                <h4 style={{ marginBottom: 8 }}>組合明細 ({editingComboItems.length} 項)</h4>
                <div className="list-section" style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 8 }}>
                  {editingComboItems.map((item, index) => (
                    <div key={index} style={{ marginBottom: 12, borderBottom: '1px dotted #ccc', paddingBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <b style={{ fontSize: 15 }}>{item.label}</b>
                        <button className="small" onClick={() => setEditingComboItems((prev) => prev.filter((_, i) => i !== index))} style={{ padding: '2px 8px', background: '#fee2e2', color: '#dc2626' }}>移除</button>
                      </div>
                      <div className="inline-inputs" style={{ marginTop: 6, display: 'flex', gap: 10 }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ fontSize: 14, lineHeight: 1.3 }}>Kcal</div>
                          <div onClick={() => { setEditingItemIndex(index); setShowEditItemKcalPad(true); }} style={{ padding: '6px', width: '100%', boxSizing: 'border-box', backgroundColor: '#f8f9fa', border: '1px solid var(--line)', borderRadius: '4px', cursor: 'pointer', minHeight: '32px', display: 'flex', alignItems: 'center' }}>
                            {item.kcal || '0'}
                          </div>
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ fontSize: 14, lineHeight: 1.3 }}>份量描述</div>
                          <input type="text" value={item.amountText || ''} onChange={(e) => { const v = e.target.value; setEditingComboItems((prev) => prev.map((it, i) => i === index ? { ...it, amountText: v } : it)); }} style={{ padding: '6px', width: '100%', boxSizing: 'border-box' }} />
                        </div>
                      </div>
                    </div>
                  ))}
                  {editingComboItems.length === 0 && <div className="hint">組合中無品項，請重新紀錄。</div>}
                  <div style={{ textAlign: 'center', paddingTop: 10, fontSize: 14 }}>總熱量：<b>{editingComboItems.reduce((sum, item) => sum + (item.kcal || 0), 0)} kcal</b></div>
                </div>
                <div className="btn-row" style={{ marginTop: 16 }}>
                  <button className="primary" onClick={saveComboEdit} disabled={!editingComboName.trim() || editingComboItems.length === 0}>儲存全部變更</button>
                  <button onClick={() => { setEditingCombo(null); setEditingComboItems([]); }}>取消</button>
                </div>
                {/* 組合內熱量編輯鍵盤 */}
                {showEditItemKcalPad && editingItemIndex !== null && (
                  <NumberPadModal
                    visible={showEditItemKcalPad}
                    onClose={() => { setShowEditItemKcalPad(false); setEditingItemIndex(null); }}
                    title="熱量 (kcal)"
                    unit="kcal"
                    value={String(editingComboItems[editingItemIndex]?.kcal || 0)}
                    allowDecimal={true}
                    onChange={(val) => { if (editingItemIndex !== null) { const v = Number(val) || 0; setEditingComboItems((prev) => prev.map((it, i) => i === editingItemIndex ? { ...it, kcal: v } : it)); } }}
                    onConfirm={() => { setShowEditItemKcalPad(false); setEditingItemIndex(null); }}
                  />
                )}
              </div>
            </div>
          )}

          {/* 各種目標的數字鍵盤 Modal */}
          <NumberPadModal visible={showTargetWeightPad} onClose={() => setShowTargetWeightPad(false)} title="目標體重" unit="kg" value={tempInputValue} allowDecimal={true} onChange={(val) => setTempInputValue(val)} onConfirm={() => { setLocalSettings((s) => ({ ...s, targetWeight: tempInputValue ? Number(tempInputValue) : undefined })); setShowTargetWeightPad(false); }} />
          <NumberPadModal visible={showCalorieGoalPad} onClose={() => setShowCalorieGoalPad(false)} title="目標攝取熱量" unit="kcal" value={tempInputValue} allowDecimal={true} onChange={(val) => setTempInputValue(val)} onConfirm={() => { setLocalSettings((s) => ({ ...s, calorieGoal: tempInputValue ? Number(tempInputValue) : undefined })); setShowCalorieGoalPad(false); }} />
          <NumberPadModal visible={showProteinGoalPad} onClose={() => setShowProteinGoalPad(false)} title="每日蛋白質目標" unit="g" value={tempInputValue} allowDecimal={true} onChange={(val) => setTempInputValue(val)} onConfirm={() => { setLocalSettings((s) => ({ ...s, proteinGoal: tempInputValue ? Number(tempInputValue) : undefined })); setShowProteinGoalPad(false); }} />
          <NumberPadModal visible={showWaterGoalPad} onClose={() => setShowWaterGoalPad(false)} title="每日飲水目標" unit="ml" value={tempInputValue} allowDecimal={true} onChange={(val) => setTempInputValue(val)} onConfirm={() => { setLocalSettings((s) => ({ ...s, waterGoalMl: tempInputValue ? Number(tempInputValue) : undefined })); setShowWaterGoalPad(false); }} />
          <NumberPadModal visible={showBodyFatGoalPad} onClose={() => setShowBodyFatGoalPad(false)} title="體脂率目標" unit="%" value={tempInputValue} allowDecimal={true} onChange={(val) => setTempInputValue(val)} onConfirm={() => { setLocalSettings((s) => ({ ...s, bodyFatGoal: tempInputValue ? Number(tempInputValue) : undefined })); setShowBodyFatGoalPad(false); }} />
          <NumberPadModal visible={showSkeletalMuscleGoalPad} onClose={() => setShowSkeletalMuscleGoalPad(false)} title="骨骼肌率目標" unit="%" value={tempInputValue} allowDecimal={true} onChange={(val) => setTempInputValue(val)} onConfirm={() => { setLocalSettings((s) => ({ ...s, skeletalMuscleGoal: tempInputValue ? Number(tempInputValue) : undefined })); setShowSkeletalMuscleGoalPad(false); }} />
          <NumberPadModal visible={showVisceralFatGoalPad} onClose={() => setShowVisceralFatGoalPad(false)} title="內臟脂肪指數目標" unit="" value={tempInputValue} allowDecimal={true} onChange={(val) => setTempInputValue(val)} onConfirm={() => { setLocalSettings((s) => ({ ...s, visceralFatGoal: tempInputValue ? Number(tempInputValue) : undefined })); setShowVisceralFatGoalPad(false); }} />
          <NumberPadModal visible={showExerciseMinutesGoalPad} onClose={() => setShowExerciseMinutesGoalPad(false)} title="每日運動時間目標" unit="分鐘" value={tempInputValue} allowDecimal={true} onChange={(val) => setTempInputValue(val)} onConfirm={() => { setLocalSettings((s) => ({ ...s, exerciseMinutesGoal: tempInputValue ? Number(tempInputValue) : undefined })); setShowExerciseMinutesGoalPad(false); }} />

          {/* 常用飲食組合管理 Modal */}
          {showComboManageModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'white', zIndex: 9999, display: 'flex', flexDirection: 'column', animation: 'slideInUp 0.3s ease-out' }}>
              <div style={{ padding: '16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1 }}>
                <h2 style={{ margin: 0, fontSize: '20px' }}>常用飲食組合</h2>
                <button className="secondary" onClick={() => setShowComboManageModal(false)} style={{ padding: '8px 20px' }}>完成</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px', backgroundColor: '#f8f9fa' }}>
                {combos.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#6c757d', marginTop: '60px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
                    <p>尚無常用組合</p>
                    <p style={{ fontSize: '14px' }}>在 Plan 頁面可以儲存常用組合</p>
                  </div>
                ) : (
                  combos.map((c) => (
                    <div key={c.id} className="card" style={{ marginBottom: '12px', padding: '16px', borderRadius: 16, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                      <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: 'var(--mint-dark)' }}>{c.name}</div>
                      <details style={{ marginBottom: '12px' }}>
                        <summary style={{ fontSize: '14px', cursor: 'pointer', color: '#555' }}>{c.items.length} 品項 · 總計約 {c.items.reduce((sum, item) => sum + item.kcal, 0)} kcal</summary>
                        <ul style={{ paddingLeft: '20px', marginTop: '8px', color: '#777' }}>
                          {c.items.map((item, idx) => (
                            <li key={idx} style={{ fontSize: '14px', marginBottom: '4px' }}>
                              {item.label} {item.amountText ? ` ${item.amountText}` : ''} {` · ${item.kcal} kcal`}
                            </li>
                          ))}
                        </ul>
                      </details>
                      <div className="btn-row" style={{ gap: '8px' }}>
                        <button className="small" onClick={() => { setEditingCombo(c); setEditingComboName(c.name); setEditingComboItems(c.items); setShowComboManageModal(false); }}>編輯</button>
                        <button className="small" onClick={() => deleteCombo(c.id)} style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}>刪除</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 使用說明 Modal */}
          {showGuideModal && (
            <div className="modal-backdrop" onClick={() => setShowGuideModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '20px 0' }}>
              <div className="modal" onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: '24px 20px', maxWidth: 400, width: '90%', maxHeight: '85vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h2 style={{ margin: 0, fontSize: '20px' }}>📖 使用說明與參考</h2>
                  <button onClick={() => setShowGuideModal(false)} style={{ border: 'none', background: '#f3f4f6', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: 16 }}>✕</button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', fontSize: '15px', lineHeight: '1.6', color: '#374151' }}>

                  <h3 style={{ color: 'var(--mint-dark)', marginTop: 0, fontSize: 16 }}>🔍 快速搜尋模式</h3>
                  <ul style={{ paddingLeft: 20, margin: '8px 0 20px' }}>
                    <li><b>✨ AI 智慧辨識</b>：點擊搜尋框旁的星星按鈕，拍照自動分析營養素。</li>
                    <li><b>📸 條碼掃描</b>：點擊相機按鈕，掃描包裝食品條碼。</li>
                    <li><b>🚀 快速加入</b>：搜尋框下方可切換「🕒 最近紀錄」或「⭐ 常用組合」，一鍵加入。</li>
                    <li><b>🔍 關鍵字搜尋</b>：輸入名稱（如「拿鐵」），搜尋歷史紀錄、資料庫或進行類別估算。</li>
                  </ul>

                  <h3 style={{ color: 'var(--mint-dark)', fontSize: 16, display: 'flex', alignItems: 'center' }}>
                    {/* 🟢 修改：使用 palmImg 變數，並設定適當大小與間距 */}
                    <img
                      src={palmImg}
                      alt="hand"
                      style={{ width: 24, height: 24, marginRight: 8, objectFit: 'contain' }}
                    />
                    手掌法份量估算
                  </h3>
                  <p style={{ margin: '8px 0', fontSize: 14, color: '#666' }}>
                    適合外食或不方便秤重時，用自己的手來測量。
                  </p>

                  <div style={{ background: '#f9fafb', borderRadius: 12, padding: 12, marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                      {/* 🟢 修改：使用 fistImg */}
                      <img src={fistImg} alt="Fist" style={{ width: 32, height: 32, marginRight: 8, objectFit: 'contain' }} />
                      <strong>拳頭 (Fist)</strong>
                    </div>
                    <div style={{ fontSize: 14, color: '#555' }}>
                      適用：<b>水果、熟蔬菜、飯/麵</b><br />
                      • 1 個拳頭水果 ≈ 1 份 (約 130g)<br />
                      • 1 個拳頭熟菜 ≈ 1 份 (約 100g)<br />
                      • 1 個拳頭熟飯 ≈ 4 份 (約 160g)
                    </div>
                  </div>

                  <div style={{ background: '#f9fafb', borderRadius: 12, padding: 12, marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                      {/* 🟢 修改：使用 palmImg */}
                      <img src={palmImg} alt="Palm" style={{ width: 32, height: 32, marginRight: 8, objectFit: 'contain' }} />
                      <strong>手掌心 (Palm)</strong>
                    </div>
                    <div style={{ fontSize: 14, color: '#555' }}>
                      適用：<b>肉類、魚類、豆腐</b><br />
                      • 手掌大小、小指厚度 ≈ 3 份 (約 100g 熟肉)
                    </div>
                  </div>

                  <div style={{ background: '#f9fafb', borderRadius: 12, padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                      {/* 🟢 修改：使用 thumbImg */}
                      <img src={thumbImg} alt="Thumb" style={{ width: 32, height: 32, marginRight: 8, objectFit: 'contain' }} />
                      <strong>大拇指 (Thumb)</strong>
                    </div>
                    <div style={{ fontSize: 14, color: '#555' }}>
                      適用：<b>油脂、堅果、種子</b><br />
                      • 1 個指節 ≈ 1 份 (約 5g 油)
                    </div>
                  </div>

                </div>

                {/* 🆕 資料來源說明 - Apple 審查要求 */}
                <div style={{
                  marginTop: 16,
                  padding: 12,
                  background: '#f0f8ff',
                  borderRadius: 8,
                  border: '1px solid #d0e8ff'
                }}>
                  <h4 style={{
                    fontSize: 14,
                    marginBottom: 8,
                    color: '#333',
                    fontWeight: 600
                  }}>
                    📚 手掌估算法資料來源
                  </h4>
                  <p style={{
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: '#555',
                    marginBottom: 10
                  }}>
                    本估算法參考以下官方飲食指南：
                  </p>
                  <div style={{ fontSize: 13 }}>
                    <a
                      href="https://www.hpa.gov.tw/Pages/EBook.aspx?nodeid=3821"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: '#007AFF',
                        textDecoration: 'none',
                        display: 'block',
                        marginBottom: 6
                      }}
                    >
                      🔗 衛生福利部國民健康署「我的餐盤」手冊
                    </a>
                    <a
                      href="https://en.wikipedia.org/wiki/MyPlate"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: '#007AFF',
                        textDecoration: 'none',
                        display: 'block'
                      }}
                    >
                      🔗 USDA MyPlate 飲食指南 (Wikipedia)
                    </a>
                  </div>
                  <p style={{
                    fontSize: 12,
                    color: '#888',
                    marginTop: 10,
                    fontStyle: 'italic'
                  }}>
                    * 手掌估算法為便利性工具，實際營養需求請諮詢專業營養師
                  </p>
                </div>

                <button className="primary" onClick={() => setShowGuideModal(false)} style={{ marginTop: 20, width: '100%', padding: '12px', borderRadius: 12 }}>
                  我知道了
                </button>
              </div>
            </div>
          )}
        </div>
      );
    };

    // ======== Plan 頁 (最終完整版：含積極減重 + 大字體選單) ========
    const PlanPage: React.FC = () => {
      const { showToast } = React.useContext(ToastContext);

      // 1. 初始化 State
      const [form, setForm] = useState(() => {
        try {
          return JSON.parse(localStorage.getItem('JU_PLAN_FORM') || '{}');
        } catch {
          return {};
        }
      });

      const [gender, setGender] = useState<string>(form.gender || 'female');
      const [birthDate, setBirthDate] = useState<string>(form.birthDate || '');
      const [age, setAge] = useState<number>(Number(form.age) || 30);
      const [height, setHeight] = useState<string>(form.height ? String(form.height) : '165');
      const [weight, setWeight] = useState<string>(form.weight ? String(form.weight) : '60');
      const [activity, setActivity] = useState<string>(form.activity || 'light');
      const [selectedGoal, setSelectedGoal] = useState<number | null>(form.selectedGoal ? Number(form.selectedGoal) : null);

      // 控制活動量選單開關
      const [showActivityModal, setShowActivityModal] = useState(false);

      // 活動量選項
      const activityOptions = [
        { value: 'sedentary', label: '😴 久坐', desc: '幾乎不運動 / 辦公室工作' },
        { value: 'light', label: '🚶 輕量活動', desc: '每週運動 1-3 天 / 輕鬆散步' },
        { value: 'moderate', label: '🏃 中等活動', desc: '每週運動 3-5 天 / 中強度運動' },
        { value: 'active', label: '🏋️ 活躍', desc: '每週運動 6-7 天 / 體力工作' },
        { value: 'very', label: '🔥 非常活躍', desc: '每天高強度訓練 / 職業運動員' },
      ];
      const currentActivityLabel = activityOptions.find(opt => opt.value === activity)?.label || '請選擇';

      // 生日自動算年齡
      useEffect(() => {
        if (birthDate) {
          const birth = new Date(birthDate);
          const today = new Date();
          let calculatedAge = today.getFullYear() - birth.getFullYear();
          const m = today.getMonth() - birth.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
            calculatedAge--;
          }
          setAge(calculatedAge);
        }
      }, [birthDate]);

      // 儲存
      useEffect(() => {
        const newForm = { gender, birthDate, age, height, weight, activity, selectedGoal };
        localStorage.setItem('JU_PLAN_FORM', JSON.stringify(newForm));
      }, [gender, birthDate, age, height, weight, activity, selectedGoal]);

      // 計算
      const bmr = useMemo(() => {
        const w = Number(weight) || 0;
        const h = Number(height) || 0;
        const a = Number(age) || 0;
        if (!w || !h || !a) return 0;
        return Math.round(
          gender === 'male'
            ? 10 * w + 6.25 * h - 5 * a + 5
            : 10 * w + 6.25 * h - 5 * a - 161
        );
      }, [gender, weight, height, age]);

      const tdee = useMemo(() => {
        if (!bmr || !activity) return 0;
        const mult: Record<string, number> = {
          sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very: 1.9,
        };
        return Math.round(bmr * (mult[activity] || 1.2));
      }, [bmr, activity]);

      const GoalCard: React.FC<{ title: string; kcal: number; tip?: string; warn?: string; recommended?: boolean; }> =
        ({ title, kcal, tip, warn, recommended }) => (
          <div
            className="card"
            style={{
              border: selectedGoal === kcal ? '2px solid #5c9c84' : '1px solid var(--line)',
              background: recommended ? '#fafffc' : '#fff',
              cursor: 'pointer',
              marginBottom: 10,
              padding: '12px 16px'
            }}
            onClick={() => setSelectedGoal(kcal)}
          >
            <div className="meal-header" style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
              {selectedGoal === kcal && <span className="tag" style={{ marginRight: 8, background: '#5c9c84', color: '#fff', padding: '2px 8px', borderRadius: 12, fontSize: 12 }}>已選</span>}
              <span className="meal-title" style={{ color: recommended ? 'var(--mint-dark)' : 'var(--text-main)', fontWeight: 600, fontSize: 16 }}>
                {title}
              </span>
              {recommended && <span className="tag" style={{ marginLeft: 'auto', background: '#e6fffa', color: '#5c9c84', padding: '2px 8px', borderRadius: 12, fontSize: 12 }}>推薦</span>}
            </div>
            <div className="meal-body">
              <div className="kcal" style={{ fontSize: 18, fontWeight: 700 }}>{Math.max(0, Math.round(kcal))} <span style={{ fontSize: 13, fontWeight: 400 }}>kcal</span></div>
              {tip && <div className="tip" style={{ fontSize: 13, color: '#666' }}>{tip}</div>}
              {warn && <div className="warning" style={{ color: '#d64545', fontSize: 12, marginTop: 4 }}>{warn}</div>}
            </div>
          </div>
        );

      return (
        // 外層容器
        <div className="page page-plan" style={{ paddingBottom: '96px', maxWidth: 600, margin: '0 auto', background: '#f5fbf8', minHeight: '100vh' }}>

          {/* 標題區塊 */}
          <div style={{
            padding: '12px 16px 20px',
            display: 'flex',
            flexDirection: 'column',
            paddingTop: 'calc(12px + env(safe-area-inset-top))'
          }}>
            <h2 style={{ margin: 0, fontSize: '22px', color: '#1f2937' }}>個人計畫 Plan</h2>
            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '14px' }}>
              設定身體數值，計算每日熱量需求
            </p>
          </div>

          {/* 內容包裝 */}
          <div style={{ padding: '0 16px' }}>

            {/* 基本資料區塊 */}
            <section className="card" style={{ padding: 16, marginBottom: 16, border: '1px solid var(--line)', borderRadius: 16, background: '#fff' }}>
              <h3 style={{ fontSize: 16, margin: '0 0 12px 0', borderBottom: '1px solid #eee', paddingBottom: 8, color: '#444' }}>⚙️ 基本設定</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>生理性別</label>
                  <div style={{ display: 'flex', gap: 12 }}>
                    {['female', 'male'].map((g) => (
                      <button
                        key={g}
                        onClick={() => setGender(g)}
                        style={{
                          flex: 1, padding: '8px', borderRadius: 8,
                          border: gender === g ? '2px solid #5c9c84' : '1px solid #ddd',
                          background: gender === g ? '#f0fdf9' : '#fff',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                        }}
                      >
                        <img src={g === 'female' ? femalePng : malePng} alt={g} style={{ width: 30, height: 30, objectFit: 'contain' }} />
                        <span style={{ color: gender === g ? '#5c9c84' : '#666', fontWeight: gender === g ? 600 : 400, fontSize: 14 }}>
                          {g === 'female' ? '女性' : '男性'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
                    出生年月日 <span style={{ fontSize: 12, color: '#888' }}>(自動推算: {age} 歲)</span>
                  </label>
                  <input
                    type="date" value={birthDate} max={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setBirthDate(e.target.value)}
                    style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd', fontSize: 16, background: '#fff' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>身高 (cm)</label>
                    <input type="number" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="165"
                      style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd', fontSize: 16 }} />
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>體重 (kg)</label>
                    <input type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="60"
                      style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd', fontSize: 16 }} />
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 500, fontSize: 14 }}>日常活動量</label>
                  <button type="button" onClick={() => setShowActivityModal(true)}
                    style={{
                      width: '100%', padding: '12px 10px', borderRadius: 8, border: '1px solid #ddd', background: '#fff',
                      fontSize: 16, textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#1f2937'
                    }}
                  >
                    <span>{currentActivityLabel}</span>
                    <span style={{ color: '#999', fontSize: 12 }}>▼</span>
                  </button>
                </div>
              </div>
            </section>

            {/* 計算結果區塊 */}
            <section className="card" style={{ padding: 20, marginBottom: 16, textAlign: 'center', background: '#fff', borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'inline-block', background: '#e0f2fe', padding: '4px 12px', borderRadius: 20, color: '#0369a1', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                您的 TDEE 每日總消耗
              </div>
              <div style={{ fontSize: 42, fontWeight: 800, color: '#5c9c84', lineHeight: 1 }}>
                {tdee || 0} <span style={{ fontSize: 18, fontWeight: 500, color: '#9ca3af' }}>kcal</span>
              </div>
              <div style={{ color: '#6b7280', fontSize: 13, marginTop: 8 }}>基礎代謝 BMR: <b>{bmr || 0}</b> kcal</div>
            </section>

            {/* 目標建議區塊 */}
            <section className="card" style={{ padding: 16, background: '#fff', borderRadius: 16 }}>
              <h3 style={{ fontSize: 16, margin: '0 0 12px 0', color: '#444' }}>🎯 選擇您的目標</h3>

              <div className="meals-card">
                <GoalCard title="維持目前體重" kcal={tdee} tip="熱量平衡 (Net 0)" />

                <h4 style={{ fontSize: 13, color: '#888', margin: '12px 0 6px 0' }}>減重目標</h4>
                <GoalCard title="溫和減重" kcal={tdee ? tdee - 300 : 0} tip="每日赤字 -300 (月減 ~1.2kg)" recommended />
                <GoalCard title="標準減重" kcal={tdee ? tdee - 500 : 0} tip="每日赤字 -500 (月減 ~2kg)"
                  warn={tdee && (tdee - 500) < bmr ? '低於 BMR，請評估是否過低' : undefined} />
                <GoalCard
                  title="積極減重"
                  kcal={tdee ? tdee - 1000 : 0}
                  tip="每日赤字 -1000 (月減 ~4kg)"
                  warn="不建議長期執行，易流失肌肉"
                />

                <h4 style={{ fontSize: 13, color: '#888', margin: '12px 0 6px 0' }}>增肌/增重目標</h4>
                <GoalCard title="溫和增重" kcal={tdee ? tdee + 300 : 0} tip="每日盈餘 +300 (月增 ~1.2kg)" />
                <GoalCard title="標準增重" kcal={tdee ? tdee + 500 : 0} tip="每日盈餘 +500 (月增 ~2kg)" />
              </div>

              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <button
                  className="btn primary"
                  disabled={!selectedGoal || !bmr}
                  onClick={() => {
                    if (!selectedGoal || !bmr) return;
                    try {
                      localStorage.setItem('JU_PLAN_BMR', String(bmr));
                      localStorage.setItem('JU_PLAN_TDEE', String(tdee || 0));
                      localStorage.setItem('JU_PLAN_GOAL_KCAL', String(selectedGoal));
                      document.dispatchEvent(new CustomEvent('ju:set-goal-kcal', { detail: selectedGoal }));
                      showToast('success', `已加入目標熱量：${selectedGoal} kcal`);
                    } catch {
                      showToast('error', '設定目標熱量時發生錯誤');
                    }
                  }}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 12, border: 'none',
                    background: (!selectedGoal || !bmr) ? '#d1d5db' : '#5c9c84',
                    color: '#fff', fontSize: 16, fontWeight: 600,
                    cursor: (!selectedGoal || !bmr) ? 'not-allowed' : 'pointer'
                  }}
                >
                  確認並套用目標
                </button>
              </div>
            </section>

          </div>

          {/* 底部滑出選單 (Action Sheet) */}
          {showActivityModal && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
              <div onClick={() => setShowActivityModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }} />
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, background: '#fff',
                borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: '20px 16px 40px 16px', animation: 'slideUp 0.3s ease-out'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 18 }}>選擇日常活動量</h3>
                  <button onClick={() => setShowActivityModal(false)} style={{ background: 'transparent', border: 'none', fontSize: 24, padding: 4, color: '#999' }}>✕</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {activityOptions.map((opt) => (
                    <button key={opt.value} onClick={() => { setActivity(opt.value); setShowActivityModal(false); }}
                      style={{
                        padding: '16px', borderRadius: 12, border: activity === opt.value ? '2px solid #5c9c84' : '1px solid #eee',
                        background: activity === opt.value ? '#f0fdf9' : '#fff', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 4
                      }}
                    >
                      <div style={{ fontSize: 18, fontWeight: 600, color: '#1f2937' }}>{opt.label}</div>
                      <div style={{ fontSize: 14, color: '#6b7280' }}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    };

    // ======== TrendsPage (趨勢分析頁面) ========
    const TrendsPage: React.FC = () => {
      const [period, setPeriod] = useState<'7d' | '30d' | '90d' | '180d' | '365d'>('7d');
      const [metric, setMetric] = useState<'bodyComposition' | 'weight' | 'bodyFat' | 'skeletalMuscle' | 'calories' | 'protein'>('bodyComposition');

      // 🆕 加入分享圖生成狀態
      const [isGenerating, setIsGenerating] = useState(false);

      // 準備圖表數據
      // 準備圖表數據
      const chartData = useMemo(() => {
        const data: any[] = [];
        const today = dayjs();

        if (period === '7d') {
          // 7天：顯示最近 7 天內有記錄的日期
          for (let i = 6; i >= 0; i--) {
            const currentDate = today.subtract(i, 'day');
            const dateStr = currentDate.format('YYYY-MM-DD');
            const day = days.find(d => d.date === dateStr);

            const dayMeals = meals.filter(m => m.date === dateStr);  // ✅ 先宣告

            // 檢查是否有身體數據或飲食紀錄
            const hasBodyData = day && (day.weight != null || day.bodyFat != null || day.skeletalMuscle != null);
            const hasMealData = dayMeals.length > 0;  // ✅ 現在可以使用了

            // 如果既沒有身體數據，也沒有飲食紀錄，跳過
            if (!hasBodyData && !hasMealData) {
              continue;
            }

            const dayExercises = exercises.filter(e => e.date === dateStr);

            const totalKcal = dayMeals.reduce((sum, m) => sum + (m.kcal || 0), 0);
            const burnedKcal = dayExercises.reduce((sum, e) => sum + (e.kcal || 0), 0);
            const netKcal = totalKcal - burnedKcal;
            const totalProtein = dayMeals.reduce((sum, m) => sum + (m.protein || 0), 0);
            const totalCarb = dayMeals.reduce((sum, m) => sum + (m.carb || 0), 0);
            const totalFat = dayMeals.reduce((sum, m) => sum + (m.fat || 0), 0);

            data.push({
              date: currentDate.format('MM/DD'),
              fullDate: dateStr,
              weight: day?.weight ?? null,
              bodyFat: day?.bodyFat ?? null,
              skeletalMuscle: day?.skeletalMuscle ?? null,
              calories: totalKcal > 0 ? netKcal : null,
              protein: totalProtein > 0 ? totalProtein : null,
              carb: totalCarb > 0 ? totalCarb : null,
              fat: totalFat > 0 ? totalFat : null,
            });
          }
        } else if (period === '30d') {
          for (let i = 4; i >= 0; i--) {
            const targetDate = today.subtract(i * 7, 'day');
            const weekStart = targetDate.startOf('week').format('YYYY-MM-DD');
            const weekEnd = targetDate.endOf('week').format('YYYY-MM-DD');

            const weekDays = days.filter(d =>
              d.date >= weekStart &&
              d.date <= weekEnd
            ).sort((a, b) => a.date.localeCompare(b.date));

            // 🔧 改成取該週「最後一筆（最新）」有效數據
            const validDays = weekDays.filter(d => d.weight != null || d.bodyFat != null || d.skeletalMuscle != null);
            const day = validDays[validDays.length - 1];

            // 🔧 如果該週沒有數據，跳過
            const weekMeals = meals.filter(m => m.date >= weekStart && m.date <= weekEnd);
            if (!day && weekMeals.length === 0) continue;
            const dateStr = day?.date || weekStart;
            const dayMeals = meals.filter(m => m.date === dateStr);
            const dayExercises = exercises.filter(e => e.date === dateStr);

            const totalKcal = dayMeals.reduce((sum, m) => sum + (m.kcal || 0), 0);
            const burnedKcal = dayExercises.reduce((sum, e) => sum + (e.kcal || 0), 0);
            const netKcal = totalKcal - burnedKcal;
            const totalProtein = dayMeals.reduce((sum, m) => sum + (m.protein || 0), 0);
            const totalCarb = dayMeals.reduce((sum, m) => sum + (m.carb || 0), 0);
            const totalFat = dayMeals.reduce((sum, m) => sum + (m.fat || 0), 0);

            data.push({
              date: targetDate.format('MM/DD'),
              fullDate: dateStr,
              weight: day?.weight ?? null,
              bodyFat: day?.bodyFat ?? null,
              skeletalMuscle: day?.skeletalMuscle ?? null,
              calories: totalKcal > 0 ? netKcal : null,
              protein: totalProtein > 0 ? totalProtein : null,
              carb: totalCarb > 0 ? totalCarb : null,
              fat: totalFat > 0 ? totalFat : null,
            });
          }
        } else if (period === '90d') {
          // 90天：每週一個點（最多 13 個點）- 取該週第一筆有效數據
          for (let i = 12; i >= 0; i--) {
            const targetDate = today.subtract(i * 7, 'day');
            const weekStart = targetDate.startOf('week').format('YYYY-MM-DD');
            const weekEnd = targetDate.endOf('week').format('YYYY-MM-DD');

            // 找該週內第一筆有體重數據的日期
            const weekDays = days.filter(d =>
              d.date >= weekStart &&
              d.date <= weekEnd
            ).sort((a, b) => a.date.localeCompare(b.date));

            const validDays = weekDays.filter(d => d.weight != null || d.bodyFat != null || d.skeletalMuscle != null);
            const day = validDays[validDays.length - 1];

            // 🔧 如果該週沒有數據，跳過
            const weekMeals = meals.filter(m => m.date >= weekStart && m.date <= weekEnd);
            if (!day && weekMeals.length === 0) continue;
            const dateStr = day?.date || weekStart;
            const dayMeals = meals.filter(m => m.date === dateStr);
            const dayExercises = exercises.filter(e => e.date === dateStr);

            const totalKcal = dayMeals.reduce((sum, m) => sum + (m.kcal || 0), 0);
            const burnedKcal = dayExercises.reduce((sum, e) => sum + (e.kcal || 0), 0);
            const netKcal = totalKcal - burnedKcal;
            const totalProtein = dayMeals.reduce((sum, m) => sum + (m.protein || 0), 0);
            const totalCarb = dayMeals.reduce((sum, m) => sum + (m.carb || 0), 0);
            const totalFat = dayMeals.reduce((sum, m) => sum + (m.fat || 0), 0);

            data.push({
              date: targetDate.format('MM/DD'),
              fullDate: dateStr,
              weight: day?.weight ?? null,
              bodyFat: day?.bodyFat ?? null,
              skeletalMuscle: day?.skeletalMuscle ?? null,
              calories: totalKcal > 0 ? netKcal : null,
              protein: totalProtein > 0 ? totalProtein : null,
              carb: totalCarb > 0 ? totalCarb : null,
              fat: totalFat > 0 ? totalFat : null,
            });
          }
        } else if (period === '180d') {
          // 180天：每月一個點（最多 6 個點）- 取該月第一筆有效數據
          for (let i = 5; i >= 0; i--) {
            const targetMonth = today.subtract(i, 'month');
            const monthStart = targetMonth.startOf('month').format('YYYY-MM-DD');
            const monthEnd = targetMonth.endOf('month').format('YYYY-MM-DD');

            // 找該月內第一筆有體重數據的日期
            const monthDays = days.filter(d =>
              d.date >= monthStart &&
              d.date <= monthEnd
            ).sort((a, b) => a.date.localeCompare(b.date));

            const validDays = monthDays.filter(d => d.weight != null || d.bodyFat != null || d.skeletalMuscle != null);
            const day = validDays[validDays.length - 1];

            // 🔧 如果該月沒有數據，跳過不加入圖表
            const monthMeals = meals.filter(m => m.date >= monthStart && m.date <= monthEnd);
            if (!day && monthMeals.length === 0) continue;
            const dateStr = day?.date || monthStart;
            const dayMeals = meals.filter(m => m.date === dateStr);
            const dayExercises = exercises.filter(e => e.date === dateStr);

            const totalKcal = dayMeals.reduce((sum, m) => sum + (m.kcal || 0), 0);
            const burnedKcal = dayExercises.reduce((sum, e) => sum + (e.kcal || 0), 0);
            const netKcal = totalKcal - burnedKcal;
            const totalProtein = dayMeals.reduce((sum, m) => sum + (m.protein || 0), 0);
            const totalCarb = dayMeals.reduce((sum, m) => sum + (m.carb || 0), 0);
            const totalFat = dayMeals.reduce((sum, m) => sum + (m.fat || 0), 0);

            data.push({
              date: targetMonth.format('M月'),
              fullDate: dateStr,
              weight: day?.weight ?? null,
              bodyFat: day?.bodyFat ?? null,
              skeletalMuscle: day?.skeletalMuscle ?? null,
              calories: totalKcal > 0 ? netKcal : null,
              protein: totalProtein > 0 ? totalProtein : null,
              carb: totalCarb > 0 ? totalCarb : null,
              fat: totalFat > 0 ? totalFat : null,
            });
          }
        } else if (period === '365d') {
          // 365天：每月一個點（最多 12 個點）- 取該月第一筆有效數據
          for (let i = 11; i >= 0; i--) {
            const targetMonth = today.subtract(i, 'month');
            const monthStart = targetMonth.startOf('month').format('YYYY-MM-DD');
            const monthEnd = targetMonth.endOf('month').format('YYYY-MM-DD');

            // 找該月內第一筆有體重數據的日期
            const monthDays = days.filter(d =>
              d.date >= monthStart &&
              d.date <= monthEnd
            ).sort((a, b) => a.date.localeCompare(b.date));

            const validDays = monthDays.filter(d => d.weight != null || d.bodyFat != null || d.skeletalMuscle != null);
            const day = validDays[validDays.length - 1];

            // 🔧 如果該月沒有數據，跳過不加入圖表
            const monthMeals = meals.filter(m => m.date >= monthStart && m.date <= monthEnd);
            if (!day && monthMeals.length === 0) continue;
            const dateStr = day?.date || monthStart;
            const dayMeals = meals.filter(m => m.date === dateStr);
            const dayExercises = exercises.filter(e => e.date === dateStr);

            const totalKcal = dayMeals.reduce((sum, m) => sum + (m.kcal || 0), 0);
            const burnedKcal = dayExercises.reduce((sum, e) => sum + (e.kcal || 0), 0);
            const netKcal = totalKcal - burnedKcal;
            const totalProtein = dayMeals.reduce((sum, m) => sum + (m.protein || 0), 0);
            const totalCarb = dayMeals.reduce((sum, m) => sum + (m.carb || 0), 0);
            const totalFat = dayMeals.reduce((sum, m) => sum + (m.fat || 0), 0);

            data.push({
              date: targetMonth.format('M月'),
              fullDate: dateStr,
              weight: day?.weight ?? null,
              bodyFat: day?.bodyFat ?? null,
              skeletalMuscle: day?.skeletalMuscle ?? null,
              calories: totalKcal > 0 ? netKcal : null,
              protein: totalProtein > 0 ? totalProtein : null,
              carb: totalCarb > 0 ? totalCarb : null,
              fat: totalFat > 0 ? totalFat : null,
            });
          }
        }

        return data;
      }, [period, days, meals, exercises]);

      // 🐛 DEBUG: 檢查 chartData
      useEffect(() => {
        console.log('=== ChartData Debug ===');
        console.log('Period:', period);
        console.log('Metric:', metric);
        console.log('ChartData length:', chartData.length);
        console.log('ChartData:', chartData);
        console.log('======================');
      }, [chartData, period, metric]);

      // 數據洞察計算
      const insights = useMemo(() => {
        // 🆕 身體組成模式不顯示洞察
        if (metric === 'bodyComposition' || metric === 'nutrition') return null;

        const validData = chartData.filter(d => d[metric] != null);
        if (validData.length < 2) return null;

        const firstValue = validData[0][metric];
        const lastValue = validData[validData.length - 1][metric];
        const change = lastValue - firstValue;
        const changePercent = ((change / firstValue) * 100).toFixed(1);

        // 計算平均值
        const avg = validData.reduce((sum, d) => sum + d[metric], 0) / validData.length;

        // 計算趨勢（上升/下降/穩定）
        let trend = '穩定';
        let emoji = '➡️';
        if (Math.abs(change) > 0.5) {
          if (change > 0) {
            trend = '上升';
            emoji = '📈';
          } else {
            trend = '下降';
            emoji = '📉';
          }
        }

        // 個性化建議
        let suggestion = '';
        if (metric === 'weight') {
          if (change < -0.5) {
            suggestion = '太棒了！體重下降中,繼續保持！💪';
          } else if (change > 0.5) {
            suggestion = '體重略有上升,檢視一下飲食是否超標。';
          } else {
            suggestion = '體重維持穩定,繼續保持良好習慣。';
          }
        } else if (metric === 'bodyFat') {
          if (change < -0.3) {
            suggestion = '體脂率下降中,運動與飲食控制效果顯著！🔥';
          } else if (change > 0.3) {
            suggestion = '體脂率上升,建議增加運動並控制碳水攝取。';
          } else {
            suggestion = '體脂率穩定,保持目前的訓練與飲食計畫。';
          }
        } else if (metric === 'skeletalMuscle') {
          // 🆕 骨骼肌率建議
          if (change > 0.3) {
            suggestion = '骨骼肌率上升中,肌力訓練有成效！💪';
          } else if (change < -0.3) {
            suggestion = '骨骼肌率下降,建議增加蛋白質攝取與肌力訓練。';
          } else {
            suggestion = '骨骼肌率穩定,繼續保持訓練與飲食計畫。';
          }
        } else if (metric === 'calories') {
          const goal = settings.calorieGoal || 0;
          if (avg > goal + 200) {
            suggestion = '平均熱量攝取偏高,建議控制每餐份量。';
          } else if (avg < goal - 200 && goal > 0) {
            suggestion = '熱量攝取偏低,小心身體代謝下降。';
          } else {
            suggestion = '熱量攝取在目標範圍內,繼續保持！';
          }
        } else if (metric === 'nutrition') {
          const goal = settings.proteinGoal || 0;
          if (avg >= goal) {
            suggestion = '三大營養素攝取均衡,繼續保持健康飲食！💪';
          } else {
            suggestion = '建議注意蛋白質攝取,並保持營養素均衡。';
          }
        }

        return {
          firstValue: firstValue.toFixed(1),
          lastValue: lastValue.toFixed(1),
          change: change.toFixed(1),
          changePercent,
          avg: avg.toFixed(1),
          trend,
          emoji,
          suggestion,
        };
      }, [chartData, metric, settings]);

      // 圖表配置
      const metricConfig: Record<string, any> = {
        bodyComposition: { label: '身體組成', unit: '', color: '#5c9c84' }, // 🆕 合併圖表
        weight: { label: '體重', unit: 'kg', color: '#5c9c84', yAxisDomain: [50, 80] },
        bodyFat: { label: '體脂率', unit: '%', color: '#e68a3a', yAxisDomain: [10, 40] },
        skeletalMuscle: { label: '骨骼肌率', unit: '%', color: '#10b981', yAxisDomain: [20, 40] }, // 🆕
        calories: { label: '淨熱量', unit: 'kcal', color: '#4a90e2', yAxisDomain: [0, 3000] },
        nutrition: { label: '三大營養素', unit: 'g', color: '#5c9c84' }, // 合併圖表
      };

      const config = metricConfig[metric];

      // 🆕 生成並分享圖片
      const handleShareImage = async () => {
        try {
          setIsGenerating(true);
          showToast('正在生成分享圖...', 'info');

          // 生成圖片
          const imageData = await generateShareImage({
            period,
            metric,
            chartData,
          });

          // 檢查是否為原生 App
          if (Capacitor.isNativePlatform()) {
            // 原生 App：使用 Capacitor Share API
            await Share.share({
              title: 'Ju Smile 數據分析',
              text: `我的${getPeriodLabel(period)}${getMetricLabel(metric)}趨勢`,
              url: imageData,
              dialogTitle: '分享到...',
            });
          } else {
            // Web：下載圖片
            const link = document.createElement('a');
            link.href = imageData;
            link.download = `ju_smile_${metric}_${period}_${new Date().getTime()}.png`;
            link.click();
          }

          showToast('分享圖生成成功！', 'success');
        } catch (error) {
          console.error('生成分享圖失敗:', error);
          showToast('生成失敗，請稍後再試', 'error');
        } finally {
          setIsGenerating(false);
        }
      };

      // 🆕 工具函數
      const getPeriodLabel = (p: string) => {
        const map: Record<string, string> = {
          '7d': '近 7 天',
          '30d': '近 30 天',
          '90d': '近 90 天',
          '180d': '近半年',
          '365d': '近一年'
        };
        return map[p] || '';
      };

      const getMetricLabel = (m: string) => {
        const map: Record<string, string> = {
          bodyComposition: '身體組成',
          weight: '體重',
          bodyFat: '體脂率',
          skeletalMuscle: '骨骼肌率',
          calories: '熱量',
          protein: '蛋白質'
        };
        return map[m] || '';
      };


      return (
        <div className="page" style={{ padding: 16, paddingBottom: '96px', paddingTop: 'calc(16px + env(safe-area-inset-top))' }}>
          {/* 新的標題區塊：包含圖片 Icon 與樣式 */}
          {/* 標題區塊：使用 Flexbox 強制並排 */}

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between', // 🆕 改成 space-between
            marginBottom: 16,
            paddingBottom: 12,
            borderBottom: '1px solid #e9ecef'
          }}>

            {/* 左側：圖示 + 標題 */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                marginRight: 12
              }}>
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#5c9c84"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="20" x2="18" y2="10"></line>
                  <line x1="12" y1="20" x2="12" y2="4"></line>
                  <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
              </div>

              <h1 style={{
                fontSize: 22,
                margin: 0,
                color: '#333',
                fontWeight: 700
              }}>
                數據趨勢分析
              </h1>
            </div>

            {/* 🆕 右側：分享按鈕 */}
            <button
              onClick={handleShareImage}
              disabled={isGenerating || chartData.length < 2}
              style={{
                padding: '10px 18px',
                background: isGenerating ? '#e9ecef' : 'linear-gradient(135deg, #97d0ba 0%, #5c9c84 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 600,
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: isGenerating ? 'none' : '0 4px 12px rgba(92, 156, 132, 0.3)',
                opacity: isGenerating ? 0.6 : 1,
                transition: 'all 0.2s ease'
              }}
            >
              {isGenerating ? (
                <>
                  <span style={{
                    display: 'inline-block',
                    width: 14,
                    height: 14,
                    border: '2px solid #fff',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 0.6s linear infinite'
                  }}></span>
                  生成中...
                </>
              ) : (
                <>
                  📸 生成分享圖
                </>
              )}
            </button>
          </div>

          {/* 🆕 加入旋轉動畫 */}
          <style>{`
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`}</style>

          {/* 數據洞察卡片（身體組成模式不顯示） */}
          {insights && metric !== 'bodyComposition' && (
            <section className="card" style={{ background: 'linear-gradient(135deg, #f6fbff 0%, #fffaf6 100%)', border: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 24 }}>{insights.emoji}</span>
                <h2 style={{ margin: 0, fontSize: 18 }}>數據洞察</h2>
              </div>
              <div style={{ fontSize: 15, lineHeight: 1.6 }}>
                <p style={{ margin: '4px 0' }}>
                  <b>{period === '7d' ? '本週' : period === '30d' ? '本月' : period === '90d' ? '90 天' : period === '180d' ? '半年' : '年度'}{config.label}趨勢：{insights.trend}</b>
                </p>
                <p style={{ margin: '4px 0', color: 'var(--text-sub)' }}>
                  從 <b>{insights.firstValue}</b> {config.unit} → <b>{insights.lastValue}</b> {config.unit}
                  （{insights.change > 0 ? '+' : ''}{insights.change} {config.unit}，{insights.changePercent > 0 ? '+' : ''}{insights.changePercent}%）
                </p>
                <p style={{ margin: '4px 0', color: 'var(--text-sub)' }}>
                  平均值：<b>{insights.avg}</b> {config.unit}
                </p>
                <div style={{ marginTop: 12, padding: 10, background: '#fff', borderRadius: 8, border: '1px solid #e0e0e0' }}>
                  💡 <b>{insights.suggestion}</b>
                </div>
              </div>
            </section>
          )}


          {/* 時間與指標選擇 */}
          {/* 時間與指標選擇 */}
          <section className="card" style={{ padding: '12px 16px' }}> {/* 🟢 減少卡片內距 */}

            {/* 時間範圍：標題與按鈕距離縮小 */}
            <div style={{ marginBottom: 12 }}>
              <h3 style={{
                fontSize: 14,       // 🟢 字體改小
                fontWeight: 600,
                marginBottom: 6,    // 🟢 標題與按鈕距離縮小
                color: '#666',
                display: 'flex', alignItems: 'center', gap: 6
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5c9c84" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                時間範圍
              </h3>
              <div style={{ display: 'flex', gap: 6, background: '#f3f4f6', borderRadius: 8, padding: 3 }}>
                {[
                  { value: '7d', label: '7天' },
                  { value: '30d', label: '30天' },
                  { value: '90d', label: '90天' },
                  { value: '180d', label: '半年' }, // 🟢 文字簡化一點點
                  { value: '365d', label: '1年' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPeriod(option.value as any)}
                    style={{
                      flex: 1,
                      height: 30,             // 🟢 高度變矮 (原本36)
                      padding: '0',           // 🟢 移除左右padding，靠flex置中
                      border: 'none',
                      borderRadius: 6,
                      background: period === option.value ? '#fff' : 'transparent',
                      color: period === option.value ? 'var(--mint-dark, #5c9c84)' : '#6b7280',
                      boxShadow: period === option.value ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      fontWeight: period === option.value ? 700 : 500,
                      fontSize: '12px',       // 🟢 字體變小
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 指標選擇：改成 3 欄，更集中 */}
            <div style={{ marginBottom: 0 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: '#666' }}>
                顯示指標
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)', // 🟢 改成 3 欄 (原本 1fr 1fr)
                gap: 6 // 🟢 間距縮小 (原本 8)
              }}>

                {/* 身體組成：移除 gridColumn: '1 / -1'，讓它乖乖當第一格 */}
                <button
                  onClick={() => setMetric('bodyComposition')}
                  style={{
                    padding: '8px 4px', // 🟢 縮小內距
                    borderRadius: 8,
                    border: metric === 'bodyComposition' ? '1.5px solid #5c9c84' : '1px solid #e9ecef', // 邊框變細
                    background: metric === 'bodyComposition' ? '#f0f8f4' : '#fff',
                    fontWeight: metric === 'bodyComposition' ? 700 : 400,
                    color: metric === 'bodyComposition' ? '#1f2937' : '#666',
                    cursor: 'pointer',
                    fontSize: '13px', // 🟢 字體變小
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
                  }}
                >
                  <span>身體組成</span>
                </button>

                {/* 其他按鈕：統一縮小樣式 */}
                {[
                  { id: 'weight', label: '體重', color: '#5c9c84' },
                  { id: 'bodyFat', label: '體脂率', color: '#e68a3a' },
                  { id: 'skeletalMuscle', label: '骨骼肌', color: '#10b981' },
                  { id: 'calories', label: '淨熱量', color: '#4a90e2' },
                  { id: 'nutrition', label: '三大營養素', color: '#5c9c84' },
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => setMetric(item.id as any)}
                    style={{
                      padding: '8px 4px', // 🟢 縮小內距
                      borderRadius: 8,
                      border: metric === item.id ? `1.5px solid ${item.color}` : '1px solid #e9ecef',
                      background: metric === item.id ? `${item.color}15` : '#fff', // 加上透明度
                      fontWeight: metric === item.id ? 700 : 400,
                      color: metric === item.id ? '#1f2937' : '#666',
                      cursor: 'pointer',
                      fontSize: '13px', // 🟢 字體變小
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* 趨勢圖 - Ju Smile 風格版 */}
          <section className="card">
            {/* 標題與圖例說明 */}
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>{config.label}趨勢</h2>
            </div>

            {/* 外層橫向捲動容器 */}
            <div style={{ width: '100%', overflowX: 'auto', paddingBottom: 10 }}>
              {/* 圖表容器 */}
              <div style={{
                minWidth: (period === '90d' || period === '180d' || period === '365d') ? 600 : '100%',
                height: 300,
                minHeight: 300,
                fontSize: '12px' // 調整整體字體大小
              }}>

                {/* 📊 情境 A：身體組成合併圖表（雙 Y 軸） */}
                {metric === 'bodyComposition' ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                      {/* 1. 背景：只留水平線，顏色極淡 */}
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />

                      {/* 2. X 軸 */}
                      <XAxis
                        dataKey="date"
                        axisLine={false} // 隱藏軸線
                        tickLine={false} // 隱藏刻度線
                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                        interval="preserveStartEnd"
                        angle={-45}
                        textAnchor="end"
                        height={60}
                        dy={10}
                      />

                      {/* 左邊 Y 軸 (體重)：加寬到 40 */}
                      <YAxis
                        yAxisId="left"
                        domain={['auto', 'auto']}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#1f2937', fontWeight: 600, fontSize: 11 }}
                        tickFormatter={(v) => `${v}`}
                        width={40}  // 🟢 改大一點
                      />

                      {/* 右邊 Y 軸 (體脂)：加寬到 40 */}
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        domain={['auto', 'auto']}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                        tickFormatter={(v) => `${v}%`}
                        width={40}  // 🟢 改大一點
                      />

                      {/* 5. 提示框：圓角卡片風 */}
                      {/* 修正後的 Tooltip：判斷中文名稱來顯示正確單位 */}
                      <Tooltip
                        cursor={{ stroke: '#9ca3af', strokeWidth: 1, strokeDasharray: '4 4' }}
                        contentStyle={{
                          backgroundColor: '#fff',
                          borderRadius: '12px',
                          border: 'none',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                          padding: '12px'
                        }}
                        formatter={(value: any, name: string) => {
                          // 🟢 修正：這裡要判斷 <Line name="..."> 設定的中文
                          if (name === '體重') return [`${Number(value).toFixed(1)} kg`, name];
                          if (name === '體脂率') return [`${Number(value).toFixed(1)}%`, name];
                          if (name === '骨骼肌率') return [`${Number(value).toFixed(1)}%`, name];
                          // 預設回傳
                          return [value, name];
                        }}
                      />

                      <Legend verticalAlign="top" iconType="circle" height={36} />

                      {/* 線條 A: 體重 (最重要，用深色 Charcoal) */}
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="weight"
                        name="體重"
                        stroke="#1f2937"
                        strokeWidth={3}
                        dot={{ r: 3, fill: '#1f2937', stroke: '#fff', strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: '#1f2937', strokeWidth: 0 }}
                        connectNulls
                      />
                      {/* 線條 B: 體脂 (用警示橘色，但在品牌色系內) */}
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="bodyFat"
                        name="體脂率"
                        stroke="#f59e0b" // Amber
                        strokeWidth={2}
                        strokeDasharray="5 5" // 虛線區隔
                        dot={{ r: 3, fill: '#f59e0b', stroke: '#fff', strokeWidth: 1 }}
                        activeDot={{ r: 5 }}
                        connectNulls
                      />
                      {/* 線條 C: 骨骼肌 (用品牌色 Mint) */}
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="skeletalMuscle"
                        name="骨骼肌率"
                        stroke="#97d0ba" // Mint
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#97d0ba', stroke: '#fff', strokeWidth: 1 }}
                        activeDot={{ r: 5 }}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : metric === 'nutrition' ? (

                  // 📊 情境 A2：三大營養素合併圖表
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>  // ✅ 加入 data
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />  // ✅ 加入網格

                      <XAxis   // ✅ 加入 X 軸
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                        interval="preserveStartEnd"
                        angle={-45}
                        textAnchor="end"
                        height={60}
                        dy={10}
                      />

                      <YAxis  // ✅ 加入 Y 軸
                        domain={['auto', 'auto']}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                        width={45}
                      />

                      <Tooltip  // ✅ 加入提示框
                        cursor={{ stroke: '#9ca3af', strokeWidth: 1, strokeDasharray: '4 4' }}
                        contentStyle={{
                          backgroundColor: '#fff',
                          borderRadius: '12px',
                          border: 'none',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                          padding: '12px'
                        }}
                        formatter={(value: any, name: string) => {
                          if (name === '蛋白質') return [`${Number(value).toFixed(1)} g`, name];
                          if (name === '碳水化合物') return [`${Number(value).toFixed(1)} g`, name];
                          if (name === '脂肪') return [`${Number(value).toFixed(1)} g`, name];
                          return [value, name];
                        }}
                      />

                      <Legend verticalAlign="top" iconType="circle" height={36} />  // ✅ 加入圖例

                      {/* 線條 A: 蛋白質 (綠色 - 與首頁進度條一致) */}
                      <Line
                        type="monotone"
                        dataKey="protein"
                        name="蛋白質"
                        stroke="#5c9c84"
                        strokeWidth={3}
                        dot={{ r: 3, fill: '#5c9c84', stroke: '#fff', strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: '#5c9c84', strokeWidth: 0 }}
                        connectNulls
                      />
                      {/* 線條 B: 碳水化合物 (橘色 - 與首頁進度條一致) */}
                      <Line
                        type="monotone"
                        dataKey="carb"
                        name="碳水化合物"
                        stroke="#ffbe76"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={{ r: 3, fill: '#ffbe76', stroke: '#fff', strokeWidth: 1 }}
                        activeDot={{ r: 5 }}
                        connectNulls
                      />
                      {/* 線條 C: 脂肪 (紅色 - 與首頁進度條一致) */}
                      <Line
                        type="monotone"
                        dataKey="fat"
                        name="脂肪"
                        stroke="#ff7979"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#ff7979', stroke: '#fff', strokeWidth: 1 }}
                        activeDot={{ r: 5 }}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (

                  // 📊 情境 B：單一指標圖表
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />

                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                        interval="preserveStartEnd"
                        angle={-45}
                        textAnchor="end"
                        height={60}
                        dy={10}
                      />

                      {/* Y 軸：加寬到 45 (為了容納 2000 這種大數字) */}
                      <YAxis
                        domain={config.yAxisDomain}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                        width={45}  // 🟢 45px 足夠放下 4 位數
                      />

                      <Tooltip
                        cursor={{ stroke: '#9ca3af', strokeWidth: 1, strokeDasharray: '4 4' }}
                        contentStyle={{
                          backgroundColor: '#fff',
                          borderRadius: '12px',
                          border: 'none',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                          padding: '8px 12px'
                        }}
                        formatter={(value: any) => [`${Number(value).toFixed(1)} ${config.unit}`, config.label]}
                      />

                      <Line
                        type="monotone"
                        dataKey={metric}
                        stroke="#97d0ba" // 🟢 強制統一使用品牌色 Mint
                        strokeWidth={3}
                        dot={{ r: 4, fill: '#97d0ba', stroke: '#fff', strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: '#1f2937', strokeWidth: 0 }} // 按下時變深色
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* 底部滑動提示 */}
              {(period === '90d' || period === '180d' || period === '365d') && (
                <div style={{ textAlign: 'center', fontSize: 13, color: '#9ca3af', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <span>←</span>
                  <span style={{ fontSize: 12 }}>左右滑動查看歷史數據</span>
                  <span>→</span>
                </div>
              )}
            </div>
          </section>
        </div>
      );
    };

    // ======== App Root Render ========

    return (
      <ToastContext.Provider value={{ showToast }}>
        <ToastStyles />

        {/* 動畫樣式保持不變 */}
        <style>{`
      @keyframes slideIn { from { transform: translateY(100%); } to { transform: translateY(0); } }
      @keyframes slideInFromRight { from { transform: translateY(100%); } to { transform: translateY(0); } }
      @keyframes slideInUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      @keyframes slideOut { from { transform: translateY(0); } to { transform: translateY(100%); } }
      .modal-backdrop > div { animation: slideInFromRight 0.3s ease-out; border-radius: 24px 24px 0 0; }
    `}</style>

        {/* 1️⃣ 最外層：鎖定螢幕，禁止整體彈性捲動 */}
        <div className="app" style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          width: '100%',
          overflow: 'hidden',
          backgroundColor: 'var(--bg)'
        }}>

          <ToastContainer toasts={toasts} onDismiss={dismissToast} />

          {/* 2️⃣ 中間內容區：設定 flex: 1 與 overflow-y: auto，只有這裡會捲動 */}
          {/* 🟢 修改：加上 ref={mainContentRef} */}
      <main 
        ref={mainContentRef} 
        style={{
          flex: 1,
          overflowY: 'auto',
            overflowX: 'hidden',
            position: 'relative',
            WebkitOverflowScrolling: 'touch', // 讓 iOS 滑動順暢
            paddingBottom: '20px' // 底部給一點緩衝空間
          }}>

            {tab === 'today' && (
              <TodayPage onAddExercise={goToExerciseRecord} />
            )}

            {/* 👇 完整保留你原本的 RecordsPage 資料傳遞 */}
            {tab === 'records' && (
              <RecordsPage
                recordTab={recordTab}
                setRecordTab={setRecordTab}
                defaultMealType={recordDefaultMealType}
                foodMealType={currentFoodMealType}
                setFoodMealType={setCurrentFoodMealType}
                selectedDate={recordsDate}
                setSelectedDate={setRecordsDate}
                weekStart={recordsWeekStart}
                setWeekStart={setRecordsWeekStart}
                exForm={exerciseFormState}
                onUpdateExForm={handleUpdateExForm}
                meals={meals}
                setMeals={setMeals}
                exercises={exercises}
                setExercises={setExercises}
                combos={combos}
                setCombos={setCombos}
                days={days}
                todayLocal={todayLocal}
                typeTable={typeTable}
                unitMap={unitMap}
                foodDb={foodDb}
                exerciseMet={exerciseMet}
              />
            )}

            {tab === 'trends' && (
              <TrendsPage />
            )}

            {tab === 'settings' && (
              <div style={{ height: '100%', overflowY: 'visible' }}>
                <SettingsPage
                  settings={settings}
                  setSettings={setSettings}
                  onOpenAbout={() => setTab('about')}
                />
              </div>
            )}

            {tab === 'plan' && <PlanPage />}

            {tab === 'about' && <AboutPage onBack={() => setTab('settings')} />}

          </main>
          {showUpdateBar && (
            <div className="update-toast">
              <span>系統已優化，點擊以套用最新功能</span>
              <button onClick={handleReloadForUpdate}>
                更新
              </button>
            </div>
          )}

          {/* 3️⃣ 底部導航：移出 main 之外，加上安全區設定 */}
          <nav className="bottom-nav" style={{
            flexShrink: 0,
            paddingBottom: '10px',
            paddingTop: '8px'
          }}>



            <button
              className={tab === 'today' ? 'active' : ''}
              onClick={() => setTab('today')}
            >
              <div className="nav-icon">🏠</div>
              <div className="nav-label">首頁</div>
            </button>
            <button
              className={tab === 'records' ? 'active' : ''}
              onClick={() => {
                // 點擊底部「紀錄」按鈕時，自動帶入今天日期，提升 UX
                setRecordsDate(todayLocal);
                setRecordsWeekStart(dayjs(todayLocal).startOf('week').format('YYYY-MM-DD'));
                setTab('records');
              }}
            >
              <div className="nav-icon">📋</div>
              <div className="nav-label">記錄</div>
            </button>
            <button
              className={tab === 'trends' ? 'active' : ''}
              onClick={() => setTab('trends')}
            >
              <div className="nav-icon">📈</div>
              <div className="nav-label">趨勢</div>
            </button>
            <button
              className={tab === 'settings' ? 'active' : ''}
              onClick={() => setTab('settings')}
            >
              <div className="nav-icon">🦋</div>
              <div className="nav-label">我的</div>
            </button>
            <button
              className={tab === 'plan' ? 'active' : ''}
              onClick={() => setTab('plan')}
            >
              <div className="nav-icon">🎯</div>
              <div className="nav-label">Plan</div>
            </button>
          </nav>
        </div>
      </ToastContext.Provider>
    );
  };
  
export default App;

