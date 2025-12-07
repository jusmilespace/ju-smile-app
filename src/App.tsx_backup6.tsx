import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import dayjs from 'dayjs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { VisualPortionPicker } from './VisualPortionPicker';
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
};

type MealCombo = {
  id: string;
  name: string;
  items: ComboItem[];
};

type ToastType = 'success' | 'error' | 'warning' | 'info';

type ToastMessage = {
  id: string;
  type: ToastType;
  message: string;
};


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
const APP_VERSION = '0.1.0';

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



// 把呼叫傳進來的字串，轉成真正要拿去 fetch 的 URL
function resolveCsvUrl(input: string): string {
  // 已經是 http / https 完整網址，就原樣用
  if (input.startsWith('http://') || input.startsWith('https://')) {
    return input;
  }

  // 這裡處理像 "data/Food_DB.csv" 或 "/data/Food_DB.csv" 這種
  const base = APP_BASE_URL.replace(/\/+$/, ''); // 去掉結尾多餘斜線
  const path = input.replace(/^\/+/, '');        // 去掉開頭多餘斜線

  // 如果 input 本身已經是 "/ju-smile-app/xxx"，就不要重複加
  if (('/' + path).startsWith(base + '/')) {
    return '/' + path;
  }

  return `${base}/${path}`;
}

async function fetchCsv<T = any>(url: string): Promise<T[]> {
  const finalUrl = resolveCsvUrl(url);

  try {
    const res = await fetch(finalUrl, { cache: 'no-cache' });
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
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            padding: '8px 12px',
            background: '#333',
            color: '#fff',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            zIndex: 30,
          }}
        >
          <span>提示：可以把 Ju Smile App 安裝到手機主畫面，使用更方便。</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={openModal}
              style={{
                borderRadius: 999,
                border: 'none',
                padding: '4px 8px',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              看教學
            </button>
            <button
              type="button"
              onClick={handleNeverShow}
              style={{
                borderRadius: 999,
                border: 'none',
                padding: '4px 8px',
                fontSize: 12,
                background: 'transparent',
                color: '#fff',
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
            >
              不再顯示
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
          <p style={{ fontSize: 13, color: '#666', marginBottom: 0 }}>
            一般使用者如果沒有自己改 CSV，可以忽略「同步精準資料」，照平常使用即可。
          </p>
        </div>
      </section>

      <section className="card">
        <div className="form-section" style={{ lineHeight: 1.6 }}>
          <h2>版本資訊</h2>
          <p style={{ marginBottom: 4 }}>
            目前版本：<b>Ju Smile App v{APP_VERSION}</b>
          </p>
          <ul style={{ paddingLeft: 20, marginBottom: 0, fontSize: 13 }}>
            <li>v0.1.0：初始版本，提供體重 / 飲食 / 運動紀錄與 JSON 匯出 / 匯入功能。</li>
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
  showToast: () => {},
});





  const App: React.FC = () => {
  const [tab, setTab] = useState<Tab>('today');
  const [showUpdateBar, setShowUpdateBar] = useState(false);

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



  const [recordDefaultMealType, setRecordDefaultMealType] =
    useState<'早餐' | '午餐' | '晚餐' | '點心'>('早餐');
  
  // 🆕 持久化使用者在 Records 頁面選擇的餐別
  const [currentFoodMealType, setCurrentFoodMealType] =
    useState<'早餐' | '午餐' | '晚餐' | '點心'>(recordDefaultMealType);

  const [recordTab, setRecordTab] = useState<RecordSubTab>('food');

  const [settings, setSettings] = useState<Settings>(() =>
    loadJSON<Settings>(STORAGE_KEYS.SETTINGS, {})
  );


// 🔔 監聽 Service Worker 是否有安裝新版本
useEffect(() => {
  if (!('serviceWorker' in navigator)) {
    console.warn('⚠️ 此瀏覽器不支援 Service Worker');
    return;
  }

  navigator.serviceWorker
    .getRegistration()
    .then((reg) => {
      if (!reg) {
        console.warn('⚠️ 沒有找到 Service Worker 註冊');
        return;
      }

      console.log('✅ Service Worker 已就緒，開始監聽更新');

      // 🆕 每 60 秒檢查一次更新
      const updateInterval = setInterval(() => {
        console.log('🔄 定期檢查更新...');
        reg.update();
      }, 60000);

      // 監聽更新
      reg.addEventListener('updatefound', () => {
        console.log('🆕 發現新的 Service Worker');
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          console.log('📦 Service Worker 狀態:', newWorker.state);
          
          // 有舊 SW 在控制頁面，且新 SW 安裝完成 → 有「新版本」
          if (
            newWorker.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            console.log('✅ 新版本已安裝，顯示更新提示');
            setShowUpdateBar(true);
          }
        });
      });

      // 🆕 清理函數
      return () => {
        clearInterval(updateInterval);
      };
    })
    .catch((err) => {
      console.error('❌ Service Worker 錯誤:', err);
    });

  // 🆕 監聽 Service Worker 控制權變更
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('🔄 Service Worker 控制權已變更');
    if (!refreshing) {
      refreshing = true;
      console.log('♻️ 自動重新整理頁面');
      window.location.reload();
    }
  });
}, []);

function handleReloadForUpdate() {
  console.log('🔄 使用者點擊更新按鈕');
  
  // 告訴 SW：可以跳過 waiting，直接啟用新版本
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    console.log('📨 發送 SKIP_WAITING 訊息');
    navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
  }
  
  // 給 Service Worker 一點時間處理
  setTimeout(() => {
    console.log('♻️ 重新載入頁面');
    window.location.reload();
  }, 100);
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
// ✅ 修正：確保在 App 載入時，時間狀態能正確初始化為當下時間
// 雖然 useState 已經初始化，但這個 useEffect 能確保在客戶端環境中，
// 初始渲染後的時間狀態是準確的，避免午夜交界點的誤差。
useEffect(() => {
    setTodayLocal(dayjs().format('YYYY-MM-DD'));
}, []); // 僅在元件首次掛載時執行一次

  function goToExerciseRecord() {
    setTab('records');         // 切到「記錄」頁
    setRecordTab('exercise');  // 切到「運動」子頁

    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 0);
  }

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

  // 初始載入 CSV
  useEffect(() => {
    syncCsv();
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

  const MacroRing: React.FC<{
    label: string;
    current?: number;
    target?: number;
    unit: string;
  }> = ({ label, current, target, unit }) => {
    const safeCurrent = current ?? 0;
    const safeTarget = target && target > 0 ? target : 0;

    // 真實比例（可能 > 1）
    const rawRatio =
      safeTarget > 0 ? safeCurrent / safeTarget : 0;

    // 真實百分比（可能 > 100，用來顯示在字上）
    const rawPercent =
      safeTarget > 0 ? Math.round(rawRatio * 100) : 0;

    // 圓環實際填滿的百分比（最多 100）
    const ringPercent =
      safeTarget > 0 ? Math.min(100, rawPercent) : 0;

    const displayCurrent = round1(safeCurrent);
    const displayTarget =
      safeTarget > 0 ? round1(safeTarget) : undefined;

    return (
      <div className="ring-card">
        <div
          className="ring"
          aria-label={label}
          style={{ ['--p' as any]: ringPercent }}
        >
          <div className="ring-center">
            {/* 中間顯示真實百分比，可以超過 100% */}
            <div className="ring-value">{rawPercent}%</div>
          </div>
        </div>
        <div className="ring-label">{label}</div>
        <div className="ring-sub">
          {displayCurrent}
          {unit}
          {displayTarget != null ? `/${displayTarget}${unit}` : ''}
        </div>
      </div>
    );
  };

  const BodyRing: React.FC<{
    label: string;
    start?: number;
    current?: number;
    target?: number;
    unit: string;
    onClick?: () => void;
  }> = ({ label, start, current, target, unit, onClick }) => {
    const s =
      start != null && !isNaN(start)
        ? Number(start)
        : current != null && !isNaN(current)
          ? Number(current)
          : undefined;
    const c =
      current != null && !isNaN(current) ? Number(current) : undefined;
    const t =
      target != null && !isNaN(target) ? Number(target) : undefined;

    let percent = 0;

    // 目標為「往下減」：(起始值 - 當前值) / (起始值 - 目標值)
    if (s != null && c != null && t != null && s !== t) {
      const raw = (s - c) / (s - t);
      percent = Math.round(Math.max(0, Math.min(1, raw)) * 100);
    }

    const displayCurrent = round1(c ?? 0);
    const displayTarget = t != null ? round1(t) : undefined;

    return (
      <div
        className="ring-card body-ring"
        onClick={onClick}
        style={onClick ? { cursor: 'pointer' } : undefined}
      >
        <div
          className="ring"
          aria-label={label}
          style={{ ['--p' as any]: percent }}
        >
          <div className="ring-center">
            <div className="ring-value">{percent}%</div>
          </div>
        </div>
        <div className="ring-label">{label}</div>
        <div className="ring-sub">
          {displayCurrent}
          {unit}
          {displayTarget != null ? ` → ${displayTarget}${unit}` : ''}
        </div>
      </div>
    );
  };

  // 優化樣式：更緊湊，移除按鈕改為整張卡片可點擊
  const MealCard: React.FC<{
    title: '早餐' | '午餐' | '晚餐' | '點心';
    kcal: number;
    protein: number;
    carb: number;
    fat: number;
    onAdd: () => void;
  }> = ({ title, kcal, protein, carb, fat, onAdd }) => {
    return (
      <div 
        className="meal-card"
        onClick={onAdd}
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '100%',
          cursor: 'pointer',
          position: 'relative',
          padding: '16px', // 增加內距
          transition: 'all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1)', // 平滑動畫
          borderRadius: '20px', // 更圓
          background: '#fff',
          // ✨ 魔法：預設有輕微陰影，按下去或 hover 時浮起
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)', 
          border: '1px solid #f0f0f0'
        }}
        // 加入 Hover 效果 (React inline style 模擬)
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 12px 20px rgba(0,0,0,0.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03)';
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div className="meal-title" style={{ fontSize: 16, fontWeight: 700, color: '#333' }}>{title}</div>
          <div style={{ 
            background: '#5c9c84', 
            color: '#fff', 
            borderRadius: '50%', 
            width: 24, 
            height: 24, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontSize: 16,
            fontWeight: 'bold',
            lineHeight: 1
          }}>+</div>
        </div>

        <div style={{ flex: 1 }}>
           <div className="meal-kcal" style={{ fontSize: 20, fontWeight: 800, color: '#5c9c84', marginBottom: 4 }}>
             {kcal} <span style={{ fontSize: 12, fontWeight: 400, color: '#888' }}>kcal</span>
           </div>
           <div style={{ fontSize: 11, color: '#888', lineHeight: 1.4 }}>
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

  const TodayPage: React.FC<TodayPageProps> = ({ onAddExercise }) => {
    const { showToast } = React.useContext(ToastContext);
    const todaySummary = getDay(todayLocal);
    
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

    const [wInput, setWInput] = useState<string>('');
    const [bfInput, setBfInput] = useState<string>('');
    const [vfInput, setVfInput] = useState<string>('');
    const [smInput, setSmInput] = useState<string>(''); // 🆕 骨骼肌率輸入
    const [waterInput, setWaterInput] = useState<string>('');
    
    // 🗑️ 已移除 showBodyModal 與 bodyMetricsExpanded 相關狀態

    // 初始化輸入框數值
    useEffect(() => {
      setWInput(todaySummary.weight != null ? String(todaySummary.weight) : '');
      setBfInput(todaySummary.bodyFat != null ? String(todaySummary.bodyFat) : '');
      setVfInput(todaySummary.visceralFat != null ? String(todaySummary.visceralFat) : '');
      setSmInput(todaySummary.skeletalMuscle != null ? String(todaySummary.skeletalMuscle) : '');
    }, [todaySummary.weight, todaySummary.bodyFat, todaySummary.visceralFat, todaySummary.skeletalMuscle]);

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

    const todayProtein = todayMeals.reduce((s, m) => s + (m.protein ?? 0), 0);

    function saveBody() {
      updateDay(todayLocal, {
        weight: wInput ? Number(wInput) : undefined,
        bodyFat: bfInput ? Number(bfInput) : undefined,
        skeletalMuscle: smInput ? Number(smInput) : undefined,
        visceralFat: vfInput ? Number(vfInput) : undefined,
      });
      showToast('success','已儲存今日身體紀錄');
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
        <header className="top-bar">
          <button
            type="button"
            onClick={() => setTodayLocal(dayjs(todayLocal).subtract(7, 'day').format('YYYY-MM-DD'))}
            style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', padding: '4px 8px' }}
          >
            ◀
          </button>

          <div className="date-text" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div 
              style={{ fontSize: 13, color: '#666', fontWeight: 500, cursor: 'pointer' }}
              onClick={openTodayDatePicker}
            >
              {dayjs(todayLocal).format('dddd, MMM D')} {todayLocal === dayjs().format('YYYY-MM-DD') && '▼'}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {Array.from({ length: 7 }).map((_, i) => {
                const date = dayjs(todayLocal).startOf('week').add(i, 'day');
                const dateStr = date.format('YYYY-MM-DD');
                const isSelected = dateStr === todayLocal;
                const isToday = dateStr === dayjs().format('YYYY-MM-DD');
                return (
                  <button
                    key={i}
                    onClick={() => setTodayLocal(dateStr)}
                    style={{
                      width: 32, height: 32, borderRadius: 8,
                      border: isSelected ? '2px solid #97d0ba' : (isToday ? '2px solid #d1f0e3' : '1px solid #e9ecef'),
                      background: isSelected ? '#97d0ba' : (isToday ? '#fff' : 'transparent'),
                      color: isSelected ? '#fff' : (isToday ? '#97d0ba' : '#333'),
                      fontSize: 14, fontWeight: isSelected ? 700 : (isToday ? 600 : 400),
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: isSelected ? '0 2px 4px rgba(151, 208, 186, 0.3)' : 'none',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {date.format('D')}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setTodayLocal(dayjs(todayLocal).add(7, 'day').format('YYYY-MM-DD'))}
            style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', padding: '4px 8px' }}
          >
            ▶
          </button>

          <input
            ref={todayDateInputRef}
            type="date"
            value={todayLocal}
            onChange={(e) => {
              if (!e.target.value) return;
              setTodayLocal(e.target.value);
            }}
            style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
          />
        </header>

        <section className="card">
          <h2>今日概況</h2>
          {/* 上層：今日熱量儀表板 (Gradient Card) */}
          <div
            className="net-block"
            style={{ 
              marginBottom: 20, 
              textAlign: 'center',
              padding: '24px',
              // ✨ 魔法：使用品牌色漸層，創造高級感
              background: 'linear-gradient(135deg, #97d0ba 0%, #5c9c84 100%)',
              borderRadius: 24,
              color: '#fff', // 文字改為白色
              boxShadow: '0 10px 25px rgba(92, 156, 132, 0.4)', // 發光的陰影
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* 裝飾用的背景圓圈，增加層次感 */}
            <div style={{
              position: 'absolute', top: -20, right: -20, width: 100, height: 100,
              background: 'rgba(255,255,255,0.1)', borderRadius: '50%'
            }} />
            <div style={{
              position: 'absolute', bottom: -10, left: -10, width: 60, height: 60,
              background: 'rgba(255,255,255,0.1)', borderRadius: '50%'
            }} />

            <div
              className="label"
              style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', marginBottom: 4, fontWeight: 500 }}
            >
              {calorieGoal != null ? (netKcal > calorieGoal ? '⚠️ 已超過目標' : '✨ 距離熱量上限還有') : '今日淨熱量'}
            </div>
            <div
              className="value"
              style={{
                fontSize: 42, // 數字再加大
                fontWeight: 800,
                color: '#fff',
                lineHeight: 1.1,
                textShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              {netDisplayValue} <span style={{ fontSize: 16, fontWeight: 500, opacity: 0.9 }}>kcal</span>
            </div>
            {calorieGoal != null && (
               <div style={{ 
                 marginTop: 8,
                 display: 'inline-block',
                 padding: '4px 12px',
                 background: 'rgba(255,255,255,0.2)',
                 borderRadius: 20,
                 fontSize: 13, 
                 fontWeight: 600,
                 backdropFilter: 'blur(4px)'
               }}>
                 {netStatusLabel}
               </div>
            )}
          </div>

          <div className="summary-row">
            <div>
              <div className="label">🍽️ 攝取</div>
              <div className="value" style={{ color: '#444', fontWeight: 600 }}>{todayIntake} kcal</div>
            </div>
            <div>
              <div className="label">🔥 消耗</div>
              <div className="value" style={{ color: '#e68a3a', fontWeight: 600 }}>{todayBurn} kcal</div>
            </div>
            <div>
              <div className="label">目標攝取</div>
              <div className="value" style={{ fontWeight: 600 }}>
                {calorieGoal != null ? `${calorieGoal} kcal` : '未設定'}
              </div>
            </div>
          </div>
        </section>

        <section className="card rings-card">
          <h2>目標達成率</h2>
          <div className="rings-row" style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'stretch' }}>
            <MacroRing label="蛋白質" current={todayProtein} target={settings.proteinGoal} unit="g" />
            <MacroRing label="飲水" current={todaySummary.waterMl} target={settings.waterGoalMl} unit="ml" />
            <MacroRing label="運動" current={todayExerciseMinutes} target={settings.exerciseMinutesGoal} unit="min" />
          </div>
        </section>

        <section className="card">
          <h2>今日飲水</h2>
          <div className="btn-row">
            <button onClick={() => addWater(100)}>+100 ml</button>
            <button onClick={() => addWater(500)}>+500 ml</button>
            <button onClick={() => addWater(1000)}>+1000 ml</button>
          </div>
          <div className="form-section">
            <label>
              自訂增加 (ml)
              <input
                type="number"
                value={waterInput}
                onChange={(e) => setWaterInput(e.target.value)}
                placeholder="例如:300"
              />
            </label>
            <button className="primary" onClick={addWaterManual}>
              加入今日飲水
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
            <MealCard
              title="早餐"
              kcal={breakfastKcal}
              protein={breakfastProt}
              carb={breakfastCarb}
              fat={breakfastFat}
              onAdd={() => {
                setRecordDefaultMealType('早餐');
                setCurrentFoodMealType('早餐');
                setTab('records');
                setRecordTab('food');
                setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
              }}
            />
            <MealCard
              title="午餐"
              kcal={lunchKcal}
              protein={lunchProt}
              carb={lunchCarb}
              fat={lunchFat}
              onAdd={() => {
                setRecordDefaultMealType('午餐');
                setCurrentFoodMealType('午餐');
                setTab('records');
                setRecordTab('food');
                setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
              }}
            />
            <MealCard
              title="晚餐"
              kcal={dinnerKcal}
              protein={dinnerProt}
              carb={dinnerCarb}
              fat={dinnerFat}
              onAdd={() => {
                setRecordDefaultMealType('晚餐');
                setCurrentFoodMealType('晚餐');
                setTab('records');
                setRecordTab('food');
                setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
              }}
            />
            <MealCard
              title="點心"
              kcal={snackKcal}
              protein={snackProt}
              carb={snackCarb}
              fat={snackFat}
              onAdd={() => {
                setRecordDefaultMealType('點心');
                setCurrentFoodMealType('點心');
                setTab('records');
                setRecordTab('food');
                setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
              }}
            />
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <h2>今日運動</h2>
            <button className="secondary" onClick={onAddExercise}>
              新增運動
            </button>
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
          <h2>今日身體紀錄</h2>
          <div className="form-section">
            <label>
              體重 (kg)
              <input type="number" value={wInput} onChange={(e) => setWInput(e.target.value)} placeholder="例如:70" />
            </label>
            <label>
              體脂率 (%)
              <input type="number" value={bfInput} onChange={(e) => setBfInput(e.target.value)} placeholder="例如:30" />
            </label>
            <label>
              骨骼肌率 (%)
              <input type="number" value={smInput} onChange={(e) => setSmInput(e.target.value)} placeholder="例如:25" />
            </label>
            <label>
              內臟脂肪指數
              <input type="number" value={vfInput} onChange={(e) => setVfInput(e.target.value)} placeholder="例如:8" />
            </label>
            <button className="primary" onClick={saveBody}>
              儲存今日身體紀錄
            </button>
          </div>
        </section>
      </div>
    );
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

  const RecordsPage: React.FC<{
    recordTab: RecordSubTab;
    setRecordTab: (tab: RecordSubTab) => void;
    defaultMealType: '早餐' | '午餐' | '晚餐' | '點心';
    foodMealType: '早餐' | '午餐' | '晚餐' | '點心';
    setFoodMealType: (type: '早餐' | '午餐' | '晚餐' | '點心') => void;
  }> = ({ recordTab, setRecordTab, defaultMealType, foodMealType, setFoodMealType }) => {
    const { showToast } = React.useContext(ToastContext);

    // 🆕 工具函數：將手掌法的手勢 emoji 轉換成代表圖案
    const convertPalmEmojis = (amountText: string): string => {
      if (!amountText) return '';
      
      return amountText
        .replace(/✋/g, '🍗') // 手掌心 → 雞腿
        .replace(/👍/g, '🥜') // 大拇指 → 堅果
        .replace(/🥛/g, '🥛'); // 乳品保持不變
      // 註：👊 拳頭在 VisualPortionPicker 裡已經是類別名稱了，不會出現在 amountText
    };

    const [selectedDate, setSelectedDate] = useState(todayLocal);
// 🆕 點標題日期時打開原生 date picker
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
    const [unitQuantity, setUnitQuantity] = useState('1');
    const [foodAmountG, setFoodAmountG] = useState('');

    // C：類別估算 / 其他類 / 自定義熱量
    const [fallbackType, setFallbackType] = useState<string>('');
    const [fallbackServings, setFallbackServings] = useState(''); // 幾份
    const [fallbackQty, setFallbackQty] = useState(''); // 參考數量, 例如 2
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

    const [manualFoodKcal, setManualFoodKcal] = useState(''); // 給你保留舊有「直接輸入總熱量」備用

    const [editingMealId, setEditingMealId] = useState<string | null>(null);
    
    // 🆕 飲食輸入模式（快速搜尋 vs 手掌法）
    const [foodInputMode, setFoodInputMode] = useState<'search' | 'palm'>('search');
    
    const recentMealsForQuickAdd = useMemo(() => {
  if (!meals.length) return [] as MealEntry[];

  const base = dayjs(selectedDate || todayLocal);
  const cutoff = base.subtract(14, 'day');
  const map = new Map<string, MealEntry>();

  for (const m of meals) {
    if (m.date === selectedDate) continue;
    const d = dayjs(m.date);
    if (d.isBefore(cutoff)) continue;

    const key = `${m.label}|${m.amountText || ''}|${m.kcal}`;
    if (!map.has(key)) {
      map.set(key, m);
    }
  }

  // 按日期排序,最新的在前面
  return Array.from(map.values())
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 20);
}, [meals, selectedDate, todayLocal]);
    // 🆕 常用組合相關狀態
    const [selectedMealIds, setSelectedMealIds] = useState<string[]>([]);
    const [comboNameInput, setComboNameInput] = useState('');
    const [showSaveComboModal, setShowSaveComboModal] = useState(false);

// ======== 運動相關 state ========
  
  // 🆕 運動記錄模式（快速 vs 精確）
  const [recordMode, setRecordMode] = useState<'quick' | 'detail'>('quick');
  
  // 🆕 快速記錄選中的運動
  const [quickExercise, setQuickExercise] = useState<{
    name: string;
    met: number;
  } | null>(null);

    // 運動表單
    const [exName, setExName] = useState('');
    const [exMinutes, setExMinutes] = useState('');
    const [exWeight, setExWeight] = useState('');
    const [customMet, setCustomMet] = useState('');
    const [selectedMetRow, setSelectedMetRow] =
      useState<ExerciseMetRow | null>(null);

    const dayMeals = meals.filter((m) => m.date === selectedDate);
    const dayExercises = exercises.filter((e) => e.date === selectedDate);
    const [editingExerciseId, setEditingExerciseId] =
      useState<string | null>(null);


    // 運動體重預帶當日體重，若無則預帶最後一次體重
useEffect(() => {
  if (exWeight) return;
  const day = days.find((d) => d.date === selectedDate);
  
  // 優先使用當日體重
  if (day && day.weight != null) {
    setExWeight(String(day.weight));
    return;
  }
  
  // 🆕 當日沒有體重時，找最後一次輸入的體重
  // 將 days 按日期排序（由近到遠），找到第一個有體重的紀錄
  const daysWithWeight = days
    .filter((d) => d.weight != null)
    .sort((a, b) => dayjs(b.date).diff(dayjs(a.date)));
  
  if (daysWithWeight.length > 0) {
    setExWeight(String(daysWithWeight[0].weight));
  }
}, [selectedDate, days, exWeight]);

    function startEditExercise(e: ExerciseEntry) {
      setSelectedDate(e.date);
      setExName(e.name);
      setExMinutes(
        e.minutes != null ? String(e.minutes) : ''
      );
      // 體重保留目前欄位，不強制帶入
      setEditingExerciseId(e.id);
      setRecordTab('exercise');
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
        const qty = Number(unitQuantity || '0');
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
        const g = Number(foodAmountG || '0');
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

      const servings = Number(fallbackServings || '0');
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
                mealType: foodMealType,
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
          mealType: foodMealType,
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

    function startEditMeal(m: MealEntry) {
      setSelectedDate(m.date);
      setFoodMealType(m.mealType);
      setFoodName(m.label);
      setManualFoodKcal(String(m.kcal));
      setSelectedUnitFood(null);
      setSelectedFoodDbRow(null);
      setUnitQuantity('1');
      setFoodAmountG('');
      setEditingMealId(m.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setRecordTab('food');
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
      showToast('success',`已成功儲存常用組合: ${newCombo.name}`);
    }

    // 🆕 載入常用組合
    function addComboToMeals(combo: MealCombo, multiplier: number = 1) {
      const newEntries = combo.items.map((item) => ({
        id: uuid(),
        date: selectedDate,
        mealType: foodMealType, // 套用目前選擇的餐別
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
      setTab('today'); // 紀錄完成後自動跳回首頁
      showToast('success',`已將組合「${combo.name}」加入 ${foodMealType}。`);
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

    function addExercise() {
      if (!exName.trim()) {
        showToast('error', '請先輸入運動名稱');
        return;
      }
      if (!usedMet) {
        showToast('error', '請先選擇一項運動或輸入自訂 MET。');
        return;
      }
      if (!autoExerciseKcal) {
        showToast('error', '請先填寫體重與時間(分鐘),才能計算熱量。');
        return;
      }

      const base: ExerciseEntry = {
        id: editingExerciseId || uuid(),
        date: selectedDate,
        name: exName.trim(),
        kcal: autoExerciseKcal,
        minutes: Number(exMinutes || '0') || undefined,
      };

      if (editingExerciseId) {
        // 更新既有紀錄
        setExercises((prev) =>
          prev.map((e) => (e.id === editingExerciseId ? base : e))
        );
        setEditingExerciseId(null);
      } else {
        // 新增
        setExercises((prev) => [...prev, base]);
      }

      // 重置部分欄位（保留體重方便連續記錄）
      setExMinutes('');
    }

    return (
      <div className="page page-records"
        style={{ paddingBottom: '90px' }}
      >
<header className="top-bar">
  <button
    type="button"
    onClick={() =>
      setSelectedDate(
        dayjs(selectedDate)
          .subtract(7, 'day')
          .format('YYYY-MM-DD')
      )
    }
    style={{
      background: 'none',
      border: 'none',
      fontSize: 18,
      cursor: 'pointer',
      padding: '4px 8px',
    }}
  >
    ◀
  </button>

  <div
    className="date-text"
    style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
    }}
  >
    {/* 週標題：點這一行會開 date picker */}
    <div
      style={{
        fontSize: 13,
        color: '#666',
        fontWeight: 500,
        cursor: 'pointer',
      }}
      onClick={openRecordsDatePicker}
    >
      {dayjs(selectedDate).format('dddd, MMM D')}
      <span style={{ marginLeft: 4 }}>▼</span>
    </div>

    {/* 7天日期選擇器 */}
    <div style={{ display: 'flex', gap: 4 }}>
      {Array.from({ length: 7 }).map((_, i) => {
        const date = dayjs(selectedDate).startOf('week').add(i, 'day');
        const dateStr = date.format('YYYY-MM-DD');
        const isSelected = dateStr === selectedDate;
        const isToday = dateStr === dayjs().format('YYYY-MM-DD');

        return (
          <button
            key={i}
            onClick={() => setSelectedDate(dateStr)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
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
              fontSize: 14,
              fontWeight: isSelected ? 700 : isToday ? 600 : 400,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isSelected
                ? '0 2px 4px rgba(151, 208, 186, 0.3)'
                : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {date.format('D')}
          </button>
        );
      })}
    </div>
  </div>

  <button
    type="button"
    onClick={() =>
      setSelectedDate(
        dayjs(selectedDate)
          .add(7, 'day')
          .format('YYYY-MM-DD')
      )
    }
    style={{
      background: 'none',
      border: 'none',
      fontSize: 18,
      cursor: 'pointer',
      padding: '4px 8px',
    }}
  >
    ▶
  </button>

  {/* 隱藏的 date input，用來打開原生日期選擇器 */}
  <input
    ref={recordsDateInputRef}
    type="date"
    value={selectedDate}
    onChange={(e) => {
      if (!e.target.value) return;
      setSelectedDate(e.target.value);
    }}
    style={{
      position: 'absolute',
      opacity: 0,
      width: 1,
      height: 1,
    }}
  />
</header>


        <div className="subtabs">
          <button
            className={recordTab === 'food' ? 'active' : ''}
            onClick={() => setRecordTab('food')}
          >
            飲食
          </button>
          <button
            className={recordTab === 'exercise' ? 'active' : ''}
            onClick={() => setRecordTab('exercise')}
          >
            運動
          </button>
        </div>

        {/* 飲食 */}
        {recordTab === 'food' && (
          <div className="card">
            {/* 🆕 餐別選項（移到最上面） */}
            <div className="form-section" style={{ marginBottom: 16 }}>
              <label>
                餐別
                <BigSelect
                  options={[
                    { value: '早餐', label: '早餐' },
                    { value: '午餐', label: '午餐' },
                    { value: '晚餐', label: '晚餐' },
                    { value: '點心', label: '點心' },
                  ]}
                  value={foodMealType}
                  onChange={(v) => {
                    setFoodMealType(v as any);
                  }}
                />
              </label>
            </div>

            {/* 🆕 輸入模式切換 */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                onClick={() => setFoodInputMode('search')}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 8,
                  border: foodInputMode === 'search' ? '2px solid #97d0ba' : '1px solid #e9ecef',
                  background: foodInputMode === 'search' ? '#f7faf9' : '#fff',
                  fontWeight: foodInputMode === 'search' ? 700 : 400,
                  cursor: 'pointer',
                  fontSize: 15,
                }}
              >
                🔍 快速搜尋
              </button>
              <button
                onClick={() => setFoodInputMode('palm')}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 8,
                  border: foodInputMode === 'palm' ? '2px solid #97d0ba' : '1px solid #e9ecef',
                  background: foodInputMode === 'palm' ? '#f7faf9' : '#fff',
                  fontWeight: foodInputMode === 'palm' ? 700 : 400,
                  cursor: 'pointer',
                  fontSize: 15,
                }}
              >
                🖐️ 手掌法
              </button>
            </div>

            

            {/* 🆕 快速搜尋模式 */}
            {foodInputMode === 'search' && (
            <div className="form-section">
              <label>
  食物名稱
  <input
    value={foodName}
    onChange={(e) => {
      setFoodName(e.target.value);
      setSelectedUnitFood(null);
      setSelectedFoodDbRow(null);
      setEditingMealId(null);
    }}
    placeholder="輸入關鍵字,例如:白飯、雞蛋、午餐組合…"
    name="foodSearchQuery"
    autoComplete="off"
    autoCorrect="off"
    spellCheck="false"
  />
</label>

              {/* UX-05：從歷史紀錄快速加入（新版，版型比照「飲食明細」） */}
{recentMealsForQuickAdd.length > 0 && (
  <details style={{ marginTop: 8 }}>
    <summary>從歷史紀錄快速加入</summary>

    <div className="list-section" style={{ marginTop: 8 }}>
      {recentMealsForQuickAdd.map((m: MealEntry) => (
        <div
          key={m.id}
          className="list-item"
          style={{
            alignItems: 'center',
            paddingLeft: 16,
            paddingRight: 12,
          }}
        >
          {/* 左邊：名稱＋小字說明（版型同飲食明細） */}
          <div style={{ flex: 1 }}>
            <div>{m.label}</div>
            <div className="sub">
              {m.mealType}
              {m.amountText ? ` · ${m.amountText}` : ''}
              {' · '}
              {m.kcal} kcal
            </div>
          </div>

          {/* 右邊：加入按鈕 */}
          <div
            className="btn-row"
            style={{ flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="small"
              onClick={() => {
                const copied: MealEntry = {
                  ...m,
                  id: uuid(),
                  date: selectedDate,
                  mealType: foodMealType,
                };
                setMeals((prev) => [...prev, copied]);
              }}
            >
              加入
            </button>
          </div>
        </div>
      ))}
    </div>
  </details>
)}

              {/* 🆕 常用組合清單 (根據搜尋結果顯示，且收納在 details 內) */}
              {/* 修正：合併條件渲染，避免結構錯誤 */}
              {/* 🆕 常用組合清單 (根據搜尋結果顯示，且收納在 details 內) */}
          {/* 修正：優化常用組合列表的顯示，增加明細展開 */}
          {(foodName.trim() === '' && combos.length > 0) ? (
            <details style={{ marginBottom: '12px' }}>
              <summary>🎯 常用組合 ({combos.length} 組)</summary>
              <div className="search-results" style={{ padding: '4px 0', border: 'none', background: 'none' }}>
                {combos.map((combo) => (
                  <div key={combo.id} className="list-item combo-item" style={{ flexDirection: 'column', alignItems: 'flex-start', paddingBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <div>{combo.name}</div>
                        <div className="sub">
                          總計約{' '}
                          {combo.items.reduce((sum, item) => sum + item.kcal, 0)} kcal
                        </div>
                      </div>
                      <button 
                            className="primary small" 
                            onClick={() => addComboToMeals(combo)}
                            style={{ 
                              flexShrink: 0, 
                              width: '32px', // 設定固定寬度
                              height: '32px', // 設定固定高度
                              padding: 0, 
                              fontSize: '20px', 
                              lineHeight: 1, 
                              borderRadius: '50%' // 讓它變成圓形
                            }}
                          >
                            +
                          </button>
                    </div>
                    <details style={{ width: '100%', marginTop: '4px' }}>
                        <summary style={{ fontSize: '12px', color: '#666' }}>查看組合明細 ({combo.items.length} 項)</summary>
                        <ul style={{ paddingLeft: '16px', margin: '4px 0 0 0', listStyleType: 'disc', fontSize: '13px', color: '#888' }}>
                            {combo.items.map((item, index) => (
                                <li key={index}>
                                    {item.label}{' '}
                                    {item.amountText ? `(${item.amountText})` : ''}
                                    {item.kcal ? ` · ${item.kcal} kcal` : ''}
                                </li>
                            ))}
                        </ul>
                    </details>
                  </div>
                ))}
              </div>
            </details>
          ) : (foodName.trim() !== '' && foodSearchResults.comboMatches.length > 0) && (
                <div className="search-results" style={{ marginBottom: '12px' }}>
                  <div className="result-title">🎯 常用組合 (搜尋結果)</div>
              {foodSearchResults.comboMatches.map((combo) => (
                <div key={combo.id} className="list-item combo-item" style={{ flexDirection: 'column', alignItems: 'flex-start', paddingBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div>{combo.name}</div>
                      <div className="sub">
                        總計約{' '}
                        {combo.items.reduce((sum, item) => sum + item.kcal, 0)} kcal
                      </div>
                    </div>
                    <button 
                            className="primary small" 
                            onClick={() => addComboToMeals(combo)}
                            style={{ 
                              flexShrink: 0, 
                              width: '32px', // 設定固定寬度
                              height: '32px', // 設定固定高度
                              padding: 0, 
                              fontSize: '20px', 
                              lineHeight: 1, 
                              borderRadius: '50%' // 讓它變成圓形
                            }}
                          >
                            +
                          </button>
                  </div>
                  <details style={{ width: '100%', marginTop: '4px' }}>
                        <summary style={{ fontSize: '12px', color: '#666' }}>查看組合明細 ({combo.items.length} 項)</summary>
                        <ul style={{ paddingLeft: '16px', margin: '4px 0 0 0', listStyleType: 'disc', fontSize: '13px', color: '#888' }}>
                            {combo.items.map((item, index) => (
                                <li key={index}>
                                    {item.label}{' '}
                                    {item.amountText ? `(${item.amountText})` : ''}
                                    {item.kcal ? ` · ${item.kcal} kcal` : ''}
                                </li>
                            ))}
                        </ul>
                    </details>
                </div>
              ))}
            </div>
          )}


              {/* 搜尋結果：選到食物後就收起來 */}
              {/* 修正：修正條件，確保在沒有選取 Unit/FoodDB 時才顯示搜尋結果列表 */}
              {/* 搜尋結果：只顯示 Unit Map 或 Food DB 的匹配清單 */}
              {foodName.trim() &&
  !selectedUnitFood &&
  !selectedFoodDbRow && 
  (foodSearchResults.historyMatches.length > 0 ||
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
          fontSize: 12,
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
          mealType: foodMealType,
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

                    {/* A：Unit_Map 有資料 */}
                    {foodSearchResults.unitMatches.length > 0 && (
                      <>
                        <div className="result-title">
                          有份量代換的食物(Unit_Map)
                        </div>
                        {foodSearchResults.unitMatches.map((u, i) => (
                          <div
                            key={i}
                            className="list-item clickable"
                            onClick={() => {
                              setSelectedUnitFood(u);
                              setSelectedFoodDbRow(null);
                              setFallbackType('');
                              // ✅ 修正: 把精準名稱帶回輸入框，取代原本關鍵字
                              setFoodName(u.Food ?? '');
                            }}
                          >
                            <div>
                              <div>{u.Food}</div>
                              <div className="sub">
                                單位:{u.Unit} · 每單位
                                {u.ServingsPerUnit} 份 · 類別:
                                {u.Type}
                                {u.Notes && ` · 備註: ${u.Notes}`}
                              </div>
                            </div>
                            <span className="tag">
                              {selectedUnitFood === u ? '已選' : '選擇'}
                            </span>
                          </div>
                        ))}
                      </>
                    )}

                    {/* B：只有 Food_DB 有資料 */}
                    {foodSearchResults.unitMatches.length === 0 &&
                      foodSearchResults.foodMatches.length > 0 && (
                        <>
                          <div className="result-title">
                            每 100g 精準資料(Food_DB)
                          </div>
                          {foodSearchResults.foodMatches.map((f, i) => (
                            <div
                              key={i}
                              className="list-item clickable"
                              onClick={() => {
                                setSelectedFoodDbRow(f);
                                setSelectedUnitFood(null);
                                setFallbackType('');
                                // ✅ 修正: 把精準名稱帶回輸入框，取代原本關鍵字
                                setFoodName(f.food ?? '');
                              }}
                            >
                              <div>
                                <div>{f.food}</div>
                                <div className="sub">
                                  {f.kcal} kcal / 100g
                                </div>
                              </div>
                              <span className="tag">
                                {selectedFoodDbRow === f ? '已選' : '選擇'}
                              </span>
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

                    <label>
                      食物類別
                      <BigSelect
                        options={[
    { value: '其他類', label: '其他類 (自訂 P/C/F)' },
    { value: '自定義熱量', label: '自定義熱量 (僅 Kcal)' },
    ...typeOptions.map((t) => ({ value: t, label: t })),
  ]}
                        value={fallbackType}
                        onChange={(v) => {
                          setFallbackType(v);
                          setFallbackServings('');
                          setFallbackQty('');
                          setFallbackProtPerServ('');
                          setFallbackCarbPerServ('');
                          setFallbackFatPerServ('');
                          setFallbackKcalPerServ('');
                        }}
                        placeholder="請選擇食物類型或估算模式"
                        width="100%"
                      />
                    </label>

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

                        

                          <label>
  份量 (份)
  <input
    type="number"
    min={0}
    step={0.1}
    value={fallbackServings}
    onChange={(e) => setFallbackServings(e.target.value)}
    placeholder="例如:1 或 1.5"
  />

  {/* UX-07：份量輸入 DEC / FRAC 切換 */}
  <div
    style={{
      marginTop: 4,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 12,
    }}
  >
    {/* DEC / FRAC 小開關 */}
    <div
      style={{
        display: 'inline-flex',
        borderRadius: 999,
        border: '1px solid var(--line, #ccc)',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setServingsInputMode('dec')}
        style={{
          padding: '2px 10px',
          border: 'none',
          background:
            servingsInputMode === 'dec' ? '#1e88e5' : 'transparent',
          color: servingsInputMode === 'dec' ? '#fff' : 'inherit',
          fontSize: 12,
        }}
      >
        DEC
      </button>
      <button
        type="button"
        onClick={() => setServingsInputMode('frac')}
        style={{
          padding: '2px 10px',
          border: 'none',
          borderLeft: '1px solid var(--line, #ccc)',
          background:
            servingsInputMode === 'frac' ? '#1e88e5' : 'transparent',
          color: servingsInputMode === 'frac' ? '#fff' : 'inherit',
          fontSize: 12,
        }}
      >
        FRAC
      </button>
    </div>

    <span className="sub">
      {servingsInputMode === 'dec'
        ? '直接輸入 1.5、2.25 等小數'
        : '從常用分數中選擇，會自動換算成小數'}
    </span>
  </div>

  {/* 只有在 FRAC 模式時，才顯示分數快捷鍵 */}
  {servingsInputMode === 'frac' && (
    <div
      style={{
        marginTop: 4,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
        fontSize: 12,
      }}
    >
      {[
        '1/8',
        '1/4',
        '1/3',
        '3/8',
        '1/2',
        '5/8',
        '2/3',
        '3/4',
        '7/8',
      ].map((f) => (
        <button
          key={f}
          type="button"
          className="small"
          style={{ padding: '2px 6px' }}
          onClick={() => {
            const [n, d] = f.split('/').map(Number);
            if (!d) return;
            const value = (n / d)
              .toFixed(3)
              .replace(/0+$/, '')
              .replace(/\.$/, '');
            setFallbackServings(value);
          }}
        >
          {f}
        </button>
      ))}
    </div>
  )}
</label>

                        </>
                      )}

                    {/* C2：其他類 (自訂 P/C/F) */}
{fallbackType === '其他類' && (
  <>
    <label>
      份量 (份)
      <input
        type="number"
        value={fallbackServings}
        onChange={(e) => setFallbackServings(e.target.value)}
        placeholder="例如:1 或 1.5"
      />

      {/* UX-07：份量輸入 DEC / FRAC 切換 */}
      <div
        style={{
          marginTop: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
        }}
      >
        {/* DEC / FRAC 小開關 */}
        <div
          style={{
            display: 'inline-flex',
            borderRadius: 999,
            border: '1px solid var(--line, #ccc)',
            overflow: 'hidden',
          }}
        >
          <button
            type="button"
            onClick={() => setServingsInputMode('dec')}
            style={{
              padding: '2px 10px',
              border: 'none',
              background:
                servingsInputMode === 'dec'
                  ? '#1e88e5'
                  : 'transparent',
              color:
                servingsInputMode === 'dec'
                  ? '#fff'
                  : 'inherit',
              fontSize: 12,
            }}
          >
            DEC
          </button>
          <button
            type="button"
            onClick={() => setServingsInputMode('frac')}
            style={{
              padding: '2px 10px',
              border: 'none',
              borderLeft: '1px solid var(--line, #ccc)',
              background:
                servingsInputMode === 'frac'
                  ? '#1e88e5'
                  : 'transparent',
              color:
                servingsInputMode === 'frac'
                  ? '#fff'
                  : 'inherit',
              fontSize: 12,
            }}
          >
            FRAC
          </button>
        </div>

        <span className="sub">
          {servingsInputMode === 'dec'
            ? '直接輸入 1.5、2.25 等小數'
            : '從常用分數中選擇，會自動換算成小數'}
        </span>
      </div>

      {/* 只有在 FRAC 模式時，才顯示 1/8～7/8 快捷按鈕 */}
      {servingsInputMode === 'frac' && (
        <div
          style={{
            marginTop: 4,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            fontSize: 12,
          }}
        >
          {[
  '1/8',
  '1/4',
  '1/3',
  '3/8',
  '1/2',
  '5/8',
  '2/3',
  '3/4',
  '7/8',
].map((f: string) => (
              <button
                key={f}
                type="button"
                className="small"
                style={{ padding: '2px 6px' }}
                onClick={() => {
                  const [n, d] = f.split('/').map(Number);
                  if (!d) return;
                  const value = (n / d)
                    .toFixed(3)
                    .replace(/0+$/, '')
                    .replace(/\.$/, '');
                  setFallbackServings(value);
                }}
              >
                {f}
              </button>
            )
          )}
        </div>
      )}
    </label>

    {/* ⬇️ 這一段「參考數量 (選填)」保留你的版本，不動 */}
    <label>
      參考數量 (選填)
      <div
        className="inline-inputs"
        style={{ display: 'flex', gap: '10px', alignItems: 'center' }}
      >
        {/* 左邊：數量欄位 */}
        <input
          type="number"
          value={fallbackQty}
          onChange={(e) => setFallbackQty(e.target.value)}
          placeholder="例如:2"
          style={{ flex: '1 1 0', width: '100%' }}
        />

        {/* 右邊：單位下拉，跟左邊一樣 flex 佔比 */}
        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <BigSelect
            options={[
              { value: '個', label: '個' },
              { value: '杯', label: '杯' },
              { value: '碗', label: '碗' },
              { value: '盤', label: '盤' },
              { value: '片', label: '片' },
              { value: '瓶', label: '瓶' },
              { value: '包', label: '包' },
              { value: '湯匙', label: '湯匙' },
              { value: '茶匙', label: '茶匙' },
              { value: '根', label: '根' },
              { value: '粒', label: '粒' },
              { value: '張', label: '張' },
              { value: 'g', label: 'g' },
              { value: '米杯', label: '米杯' },
              { value: '瓣', label: '瓣' },
            ]}
            value={fallbackUnitLabel}
            onChange={(v) => setFallbackUnitLabel(v)}
            placeholder="請選擇單位"
          />
        </div>
      </div>
    </label>



                        <label>
                          每份蛋白質 (g)
                          <input
                            type="number"
                            value={fallbackProtPerServ}
                            onChange={(e) => setFallbackProtPerServ(e.target.value)}
                            placeholder="例如:7"
                          />
                        </label>
                        <label>
                          每份碳水 (g)
                          <input
                            type="number"
                            value={fallbackCarbPerServ}
                            onChange={(e) => setFallbackCarbPerServ(e.target.value)}
                            placeholder="例如:10"
                          />
                        </label>
                        <label>
                          每份脂肪 (g)
                          <input
                            type="number"
                            value={fallbackFatPerServ}
                            onChange={(e) => setFallbackFatPerServ(e.target.value)}
                            placeholder="例如:5"
                          />
                        </label>

                        <div className="hint">
                          系統會依 P×4 + C×4 + F×9 自動估算每份與總熱量。
                        </div>
                      </>
                    )}

                    {/* C3：自定義熱量 (僅 Kcal) */}
                    {fallbackType === '自定義熱量' && (
                      <>
                        <label>
                          份量 (份)
                          <input
                            type="number"
                            value={fallbackServings}
                            onChange={(e) => setFallbackServings(e.target.value)}
                            placeholder="例如:1"
                          />
                        </label>
                        <label>
                          每份熱量 (kcal)
                          <input
                            type="number"
                            value={fallbackKcalPerServ}
                            onChange={(e) => setFallbackKcalPerServ(e.target.value)}
                            placeholder="例如:250"
                          />
                        </label>
                        <div className="hint">
                          不在意 P/C/F，只估算總熱量。
                        </div>
                      </>
                    )}

                    {fallbackType && autoFoodInfo.kcal > 0 && (
                      <div className="hint">
                        系統估算總熱量約 {autoFoodInfo.kcal} kcal
                      </div>
                    )}
                  </div>
                )}
{/* 🆕 Food_DB 選中後：顯示公克數輸入框 */}
              {selectedFoodDbRow && (
                <>
                  <label>
                    重量 (g)
                    <input
                      type="number"
                      value={foodAmountG}
                      onChange={(e) => setFoodAmountG(e.target.value)}
                      placeholder="例如:100"
                    />
                  </label>
                  <div className="hint">
                    {selectedFoodDbRow.food}：{selectedFoodDbRow.kcal} kcal / 100g
                  </div>
                  {autoFoodInfo.kcal > 0 && (
                    <div className="hint">
                      目前估算熱量:約 {autoFoodInfo.kcal} kcal
                    </div>
                  )}
                </>
              )}



{selectedUnitFood && (
  <>
      <label>
      數量({selectedUnitFood.Unit})
      <input
        type="number"
        value={unitQuantity}
        onChange={(e) => setUnitQuantity(e.target.value)}
        placeholder="例如:1 或 1.5"
      />

      {/* UX-07：數量輸入 DEC / FRAC 切換 */}
      <div
        style={{
          marginTop: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
        }}
      >
        {/* DEC / FRAC 小開關 */}
        <div
          style={{
            display: 'inline-flex',
            borderRadius: 999,
            border: '1px solid var(--line, #ccc)',
            overflow: 'hidden',
          }}
        >
          <button
            type="button"
            onClick={() => setUnitQtyInputMode('dec')}
            style={{
              padding: '2px 10px',
              border: 'none',
              background:
                unitQtyInputMode === 'dec' ? '#1e88e5' : 'transparent',
              color: unitQtyInputMode === 'dec' ? '#fff' : 'inherit',
              fontSize: 12,
            }}
          >
            DEC
          </button>
          <button
            type="button"
            onClick={() => setUnitQtyInputMode('frac')}
            style={{
              padding: '2px 10px',
              border: 'none',
              borderLeft: '1px solid var(--line, #ccc)',
              background:
                unitQtyInputMode === 'frac' ? '#1e88e5' : 'transparent',
              color: unitQtyInputMode === 'frac' ? '#fff' : 'inherit',
              fontSize: 12,
            }}
          >
            FRAC
          </button>
        </div>

        <span className="sub">
          {unitQtyInputMode === 'dec'
            ? '直接輸入 1.5、2.25 等小數'
            : '從常用分數中選擇，會自動換算成小數'}
        </span>
      </div>

      {/* 只有在 FRAC 模式時，才顯示數量分數快捷鍵 */}
      {unitQtyInputMode === 'frac' && (
        <div
          style={{
            marginTop: 4,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            fontSize: 12,
          }}
        >
          {[
            '1/8',
            '1/4',
            '1/3',
            '3/8',
            '1/2',
            '5/8',
            '2/3',
            '3/4',
            '7/8',
          ].map((f: string) => (
            <button
              key={f}
              type="button"
              className="small"
              style={{ padding: '2px 6px' }}
              onClick={() => {
                const [n, d] = f.split('/').map(Number);
                if (!d) return;
                const value = (n / d)
                  .toFixed(3)
                  .replace(/0+$/, '')
                  .replace(/\.$/, '');
                setUnitQuantity(value);
              }}
            >
              {f}
            </button>
          ))}
        </div>
      )}
    </label>
                  <div className="hint">
                    目前估算熱量:約 {autoFoodInfo.kcal || 0} kcal
                  </div>
                </>
              )}

            
              {/* 獨立移除「估算總熱量」欄位，因為已被「自定義熱量」取代 */}
              
              {effectiveFoodKcal > 0 && (
                <div className="hint">
                  即將{editingMealId ? '更新' : '記錄'}的熱量:約{' '}
                  {effectiveFoodKcal} kcal
                </div>
              )}

              <button className="primary" onClick={saveMeal}>
                {editingMealId ? '更新飲食記錄' : '加入飲食記錄'}
              </button>
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
            )}
            {/* 🆕 手掌法模式結束 */}
            {/* 🆕 手掌法輸入模式 */}
            {foodInputMode === 'palm' && (
              <VisualPortionPicker
                mealType={foodMealType}
                onConfirm={(data) => {
                  const newMeal: MealEntry = {
                    id: uuid(),
                    date: selectedDate,
                    mealType: foodMealType,
                    label: data.foodName,
                    kcal: data.kcal,
                    protein: data.protein,
                    carb: data.carbs,
                    fat: data.fat,
                    amountText: data.amountText,
                  };
                  setMeals((prev) => [...prev, newMeal]);
                  showToast('success', `已加入 ${data.foodName}`);
                  setFoodInputMode('search');
                }}
                onCancel={() => setFoodInputMode('search')}
              />
            )}

            <div className="list-section">
              <div className="card-header" style={{ alignItems: 'flex-start' }}>
                <h3>{selectedDate} 飲食明細</h3>
          
              </div>

              {dayMeals.length === 0 && (
                <div className="hint">尚未記錄飲食</div>
              )}
              {dayMeals.map((m) => {
                const isSelected = selectedMealIds.includes(m.id);
                return (
                  // 修正：整個 list-item 容器被改為可以點擊選取
                  <div
                    key={m.id}
                    className="list-item clickable" // 加上 clickable 樣式
                    onClick={() => toggleMealSelection(m.id)} // 點擊項目即選取/取消選取
                    style={{
                      borderLeft: isSelected
                        ? '4px solid var(--mint-dark)'
                        : '1px solid #f0f4f2',
                      background: isSelected ? '#f7fbf8' : '#fff',
                      paddingLeft: isSelected ? '12px' : '16px',
                      // 增加 flex 佈局確保選取圖標和內容對齊
                      alignItems: 'center',
                    }}
                  >
                    {/* 🆕 新增：勾選標記 */}
                    <div style={{ marginRight: '8px', fontSize: '18px' }}>
                      {isSelected ? '☑️' : '◻️'} 
                    </div>

                    <div style={{ flex: 1 }}> 
                      <div>
                        {m.label}
                      </div>
                      <div className="sub">
                        {m.mealType}
                        {m.amountText ? ` · ${convertPalmEmojis(m.amountText)}` : ''}
                        {' · '}
                        {m.kcal} kcal
                      </div>
                    </div>
                    <div 
                      className="btn-row"
                      onClick={(e) => e.stopPropagation()} // 阻止按鈕點擊觸發父級的 toggleSelection
                    >
                      <button 
                        className="small" 
                        onClick={() => startEditMeal(m)}
                      >
                        編輯
                      </button>
                      <button
                        className="small"
                        onClick={() =>
                          setMeals((prev) =>
                            prev.filter((x) => x.id !== m.id)
                          )
                        }
                      >
                        刪除
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 🆕 儲存常用組合彈窗 */}
            {showSaveComboModal && (
              <div
                className="modal-backdrop"
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0,0,0,0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 20,
                }}
              >
                <div
                  className="modal"
                  style={{
                    background: '#fff',
                    borderRadius: 12,
                    padding: 16,
                    maxWidth: 320,
                    width: '90%',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }}
                >
                  <h3 style={{ marginTop: 0 }}>
                    儲存常用組合 ({selectedMealIds.length} 項)
                  </h3>
                  <div className="form-section">
                    <label>
                      組合名稱
                      <input
                        value={comboNameInput}
                        onChange={(e) => setComboNameInput(e.target.value)}
                        placeholder="例如：午餐便當組合"
                      />
                    </label>
                  </div>
                  <div className="btn-row">
                    <button className="primary" onClick={handleSaveCombo}>
                      儲存組合
                    </button>
                    <button onClick={() => setShowSaveComboModal(false)}>
                      取消
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 運動 */}
{recordTab === 'exercise' && (
  <div className="card">
    <details open>
      <summary>什麼是 MET?</summary>
      <p>
        MET(代謝當量)用來表示活動強度,1 MET 約等於安靜坐著時的消耗。
        <br />
        消耗熱量 ≈ MET × 體重(kg) × 時間(小時)
        <br />
        例如:快走 4.3 MET,60kg,30 分鐘 ≈ 129 kcal。
      </p>
    </details>

    {/* 🆕 記錄模式切換 */}
    <div style={{ 
      display: 'flex', 
      gap: 8, 
      marginBottom: 16,
      marginTop: 12,
    }}>
      <button
        type="button"
        style={{
          flex: 1,
          padding: '12px',
          border: 'none',
          borderBottom: recordMode === 'quick' ? '3px solid var(--mint-dark, #5c9c84)' : '1px solid #ddd',
          background: 'transparent',
          cursor: 'pointer',
          fontWeight: recordMode === 'quick' ? 600 : 400,
          color: recordMode === 'quick' ? 'var(--mint-dark, #5c9c84)' : '#666',
          fontSize: 15,
          transition: 'all 0.2s',
        }}
        onClick={() => setRecordMode('quick')}
      >
        ⚡ 快速記錄
      </button>
      <button
        type="button"
        style={{
          flex: 1,
          padding: '12px',
          border: 'none',
          borderBottom: recordMode === 'detail' ? '3px solid var(--mint-dark, #5c9c84)' : '1px solid #ddd',
          background: 'transparent',
          cursor: 'pointer',
          fontWeight: recordMode === 'detail' ? 600 : 400,
          color: recordMode === 'detail' ? 'var(--mint-dark, #5c9c84)' : '#666',
          fontSize: 15,
          transition: 'all 0.2s',
        }}
        onClick={() => setRecordMode('detail')}
      >
        🔍 精確記錄
      </button>
    </div>

    {/* ========== 快速記錄模式 ========== */}
{recordMode === 'quick' && (
  <div className="form-section">
    <label style={{ marginBottom: 12, fontSize: 15, fontWeight: 600 }}>
      選擇運動類型
    </label>
    
    {/* 🆕 常見運動快速選擇（帶 MET 視覺化） */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
      {COMMON_EXERCISES.map((ex) => {
        const intensity = getIntensityInfo(ex.met);
        const isSelected = quickExercise?.name === ex.name;
        
        return (
          <div
            key={ex.name}
            onClick={() => {
              setQuickExercise(ex);
              setExName(ex.name);
              setCustomMet(String(ex.met));
              setSelectedMetRow(null);
              
              // 🆕 選擇後自動捲動到輸入區域
              setTimeout(() => {
                const weightInput = document.querySelector('#exercise-weight-input') as HTMLInputElement;
                if (weightInput) {
                  weightInput.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                  });
                  // 如果體重還沒填，自動聚焦到體重輸入框
                  if (!exWeight) {
                    weightInput.focus();
                  }
                }
              }, 150); // 延遲 150ms 讓動畫更順暢
            }}
            style={{
              padding: '14px 16px',
              border: `2px solid ${isSelected ? intensity.color : '#e5e7eb'}`,
              borderRadius: 10,
              cursor: 'pointer',
              background: isSelected ? `${intensity.color}10` : '#fff',
              transition: 'all 0.2s',
              boxShadow: isSelected ? `0 2px 8px ${intensity.color}40` : '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontWeight: isSelected ? 700 : 600, 
                  fontSize: 16, 
                  marginBottom: 6,
                  color: isSelected ? intensity.color : '#333',
                }}>
                  {ex.name}
                </div>
                <div style={{ fontSize: 13, color: '#666', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span 
                    style={{ 
                      padding: '3px 10px', 
                      borderRadius: 999, 
                      background: intensity.color,
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.5px',
                    }}
                  >
                    {intensity.label}
                  </span>
                  <span style={{ fontWeight: 500 }}>{ex.met} MET</span>
                </div>
              </div>
              
              {/* MET 視覺化進度條 */}
              <div style={{ width: 70, marginLeft: 16 }}>
                <div style={{ 
                  height: 8, 
                  background: '#e5e7eb', 
                  borderRadius: 4,
                  overflow: 'hidden',
                }}>
                  <div style={{ 
                    height: '100%', 
                    width: `${Math.min(100, (ex.met / 10) * 100)}%`,
                    background: intensity.color,
                    transition: 'width 0.3s ease',
                    borderRadius: 4,
                  }} />
                </div>
                <div style={{ 
                  fontSize: 10, 
                  color: '#999', 
                  textAlign: 'right', 
                  marginTop: 2 
                }}>
                  {Math.round((ex.met / 10) * 100)}%
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>

    <label>
      體重 (kg)
      <input
        id="exercise-weight-input"  
        type="number"
        value={exWeight}
        onChange={(e) => setExWeight(e.target.value)}
        placeholder="例如:70"
      />
    </label>

    <label>
      運動時間 (分鐘)
      <input
        type="number"
        value={exMinutes}
        onChange={(e) => setExMinutes(e.target.value)}
        placeholder="例如:30"
      />
    </label>

    <div className="hint" style={{ 
      padding: '12px 16px', 
      background: '#f0f9ff', 
      borderRadius: 8,
      border: '1px solid #bae6fd',
      marginTop: 12,
    }}>
      <span style={{ fontWeight: 600, color: '#0369a1' }}>預估消耗:</span>
      <span style={{ fontSize: 18, fontWeight: 700, color: '#0369a1', marginLeft: 8 }}>
        約 {autoExerciseKcal || 0} kcal
      </span>
    </div>

    <button 
      className="primary" 
      onClick={addExercise}
      disabled={!quickExercise || !exWeight || !exMinutes}
      style={{
        opacity: (!quickExercise || !exWeight || !exMinutes) ? 0.5 : 1,
        cursor: (!quickExercise || !exWeight || !exMinutes) ? 'not-allowed' : 'pointer',
      }}
    >
      {editingExerciseId ? '更新運動記錄' : '加入運動記錄'}
    </button>
    
    {editingExerciseId && (
      <button
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
)}
    {/* ========== 精確記錄模式（原本的功能） ========== */}
    {recordMode === 'detail' && (
      <div className="form-section">
        <label>
          運動名稱
          <input
            id="exercise-name-input"
            value={exName}
            onChange={(e) => {
              setExName(e.target.value);
              setSelectedMetRow(null);
              setQuickExercise(null);
            }}
            placeholder="輸入關鍵字,例如:快走、重訓…"
            name="exerciseSearchQuery"
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />
        </label>

        {/* 有輸入名稱時才顯示搜尋結果；選到一筆後收起來 */}
        {exName.trim() && !selectedMetRow && (
          <div className="search-results">
            {exerciseMatches.length === 0 ? (
              <>
                <div className="hint">
                  找不到相符的運動,可以在下方輸入自訂 MET。
                </div>

                <details className="met-ref">
                  <summary>展開常見活動 MET 參考</summary>

                  <div className="result-title">
                    🟢 低強度活動 (約 2–3 MET)
                  </div>
                  <ul className="met-list">
                    <li>散步 / 日常走路：約 2–3 MET</li>
                    <li>輕度家事：約 2.5 MET</li>
                  </ul>

                  <div className="result-title">
                    🟡 中強度活動 (約 3–6 MET)
                  </div>
                  <ul className="met-list">
                    <li>快走：約 4.3 MET</li>
                    <li>有氧運動 (輕～中等)：約 4.5～5 MET</li>
                    <li>騎自行車 (一般速度)：約 5.5～6 MET</li>
                  </ul>

                  <div className="result-title">
                    🔴 高強度活動 (6 以上)
                  </div>
                  <ul className="met-list">
                    <li>重訓 (中等強度)：約 6 MET</li>
                    <li>爬山：約 6.5 MET</li>
                    <li>持續游泳：約 7 MET 以上</li>
                  </ul>
                </details>
              </>
            ) : (
              <>
                <div className="result-title">
                  從資料表找到的活動
                </div>
                {exerciseMatches.map((row, i) => {
                  const intensity = getIntensityInfo(Number(row.MET || 0));
                  
                  return (
                    <div
                      key={i}
                      className="list-item clickable"
                      onClick={() => {
                        setSelectedMetRow(row);
                        setCustomMet(String(row.MET ?? ''));
                        setExName(row.活動 || '');
                      }}
                      style={{
                        borderLeft: `4px solid ${intensity.color}`,
                        background: selectedMetRow === row ? `${intensity.color}10` : '#fff',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div>{row.活動}</div>
                        <div className="sub" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>強度:{row.intensity}</span>
                          <span 
                            style={{ 
                              padding: '2px 8px', 
                              borderRadius: 999, 
                              background: intensity.color,
                              color: '#fff',
                              fontSize: 10,
                              fontWeight: 700,
                            }}
                          >
                            {intensity.label}
                          </span>
                          <span>MET:{row.MET}</span>
                        </div>
                      </div>
                      <span className="tag">
                        {selectedMetRow === row ? '已選' : '選擇'}
                      </span>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        <label>
          MET
          <input
            type="number"
            value={customMet}
            onChange={(e) => {
              setCustomMet(e.target.value);
              if (e.target.value) {
                setSelectedMetRow(null);
              }
            }}
            placeholder="例如:4.3"
          />
        </label>

        <label>
          體重 (kg)
          <input
            type="number"
            value={exWeight}
            onChange={(e) => setExWeight(e.target.value)}
            placeholder="例如:70"
          />
        </label>

        <label>
          時間 (分鐘)
          <input
            type="number"
            value={exMinutes}
            onChange={(e) => setExMinutes(e.target.value)}
            placeholder="例如:30"
          />
        </label>

        <div className="hint">
          目前估算消耗:約 {autoExerciseKcal || 0} kcal
        </div>

        <button className="primary" onClick={addExercise}>
          {editingExerciseId ? '更新運動記錄' : '加入運動記錄'}
        </button>
        {editingExerciseId && (
          <button
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
    )}

    {/* 運動明細列表 */}
    <div className="list-section">
      <h3>{selectedDate} 運動明細</h3>
      {dayExercises.length === 0 && (
        <div className="hint">尚未記錄運動</div>
      )}
      {dayExercises.map((e) => (
        <div key={e.id} className="list-item">
          <div>
            <div>{e.name}</div>
            <div className="sub">
              {e.minutes != null ? `${e.minutes} 分鐘 · ` : ''}
              {e.kcal} kcal
            </div>
          </div>
          <div className="btn-row">
            <button onClick={() => startEditExercise(e)}>
              編輯
            </button>
            <button
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

      </div>
    );
  };
  // ======== 我的頁 ========

type SettingsPageProps = {
  onOpenAbout: () => void;
};

const SettingsPage: React.FC<SettingsPageProps> = ({ onOpenAbout }) => {
  const { showToast } = React.useContext(ToastContext);
  const [localSettings, setLocalSettings] = useState<Settings>(settings);

  // 🆕 新增編輯常用組合的狀態
  const [editingCombo, setEditingCombo] = useState<MealCombo | null>(null);
  const [editingComboName, setEditingComboName] = useState('');
  // 🆕 新增：用於編輯組合明細的狀態
  const [editingComboItems, setEditingComboItems] = useState<ComboItem[]>([]);

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

  showToast('success','已儲存目標設定');
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

    showToast('success',`組合「${oldName}」已更新並更名為「${newName}」`);
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
        showToast('success','匯入完成');
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
    <div className="page page-settings" style={{ paddingBottom: '90px' }}>
      {/* 我的目標 */}
      <section className="card">
        <h2>我的目標</h2>
        <div className="form-section">
          <label>
            減重起始日期
            <input
              type="date"
              value={localSettings.startDate || ''}
              onChange={(e) =>
                setLocalSettings((s) => ({
                  ...s,
                  startDate: e.target.value || undefined,
                }))
              }
            />
          </label>
          <label>
            預計達成日期
            <input
              type="date"
              value={localSettings.targetDate || ''}
              onChange={(e) =>
                setLocalSettings((s) => ({
                  ...s,
                  targetDate: e.target.value || undefined,
                }))
              }
            />
          </label>
          <label>
            目標體重 (kg)
            <input
              type="number"
              value={localSettings.targetWeight ?? ''}
              onChange={(e) =>
                setLocalSettings((s) => ({
                  ...s,
                  targetWeight: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                }))
              }
            />
          </label>
          <label>
            目標攝取熱量 (kcal)
            <input
              type="number"
              value={localSettings.calorieGoal ?? ''}
              onChange={(e) =>
                setLocalSettings((s) => ({
                  ...s,
                  calorieGoal: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                }))
              }
            />
          </label>
          <label>
            每日蛋白質目標 (g)
            <div className="hint">
              建議 1.2–1.6 g × 體重(kg)。<br />
              <strong>若有腎臟疾病請依醫師建議調整。</strong>
            </div>
            <input
              type="number"
              value={localSettings.proteinGoal ?? ''}
              onChange={(e) =>
                setLocalSettings((s) => ({
                  ...s,
                  proteinGoal: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                }))
              }
            />
          </label>

          <label>
            每日飲水目標 (ml)
            <div className="hint">建議：30–35 ml × 體重(kg)</div>
            <input
              type="number"
              value={localSettings.waterGoalMl ?? ''}
              onChange={(e) =>
                setLocalSettings((s) => ({
                  ...s,
                  waterGoalMl: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                }))
              }
            />
          </label>

          <label>
            體脂率目標 (%)
            <div className="hint">
              男性健康體脂：約 8–19%。<br />
              女性健康體脂：約 20–30%。
            </div>
            <input
              type="number"
              value={localSettings.bodyFatGoal ?? ''}
              onChange={(e) =>
                setLocalSettings((s) => ({
                  ...s,
                  bodyFatGoal: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                }))
              }
            />
          </label>

          <label>
            骨骼肌率目標 (%)
            <div className="hint">
              男性健康骨骼肌率：約 33–39%。<br />
              女性健康骨骼肌率：約 24–30%。
            </div>
            <input
              type="number"
              value={localSettings.skeletalMuscleGoal ?? ''}
              onChange={(e) =>
                setLocalSettings((s) => ({
                  ...s,
                  skeletalMuscleGoal: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                }))
              }
            />
          </label>

          <label>
            內臟脂肪指數目標
            <div className="hint">建議目標 ≤ 9</div>
            <input
              type="number"
              value={localSettings.visceralFatGoal ?? ''}
              onChange={(e) =>
                setLocalSettings((s) => ({
                  ...s,
                  visceralFatGoal: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                }))
              }
            />
          </label>

          <label>
            每日運動時間目標 (分鐘)
            <div className="hint">
              最低：每週 150 分鐘中等強度（約 30 分鐘 × 5 天）。<br />
              減脂建議：45–60 分鐘/天，5–6 天/週＋每週 2–3 天肌力訓練。
            </div>
            <input
              type="number"
              value={localSettings.exerciseMinutesGoal ?? ''}
              onChange={(e) =>
                setLocalSettings((s) => ({
                  ...s,
                  exerciseMinutesGoal: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                }))
              }
            />
          </label>

          <button className="primary" onClick={saveSettings}>
            儲存目標設定
          </button>
        </div>
      </section>

      {/* 常用飲食組合管理 */}
      <section className="card">
        <h2>常用飲食組合管理 ({combos.length} 組)</h2>
        <div className="list-section">
          {combos.length === 0 && (
            <div className="hint">尚未儲存任何常用組合</div>
          )}
          {combos.map((c) => (
            <div key={c.id} className="list-item">
              <div>
                <div>{c.name}</div>
                <div className="sub">
                  {c.items.length} 品項 · 總計約{' '}
                  {c.items.reduce((sum, item) => sum + item.kcal, 0)} kcal
                </div>
                <details style={{ marginTop: '4px' }}>
                  <summary style={{ fontSize: '12px' }}>查看明細</summary>
                  <ul
                    style={{
                      paddingLeft: '20px',
                      margin: '4px 0 0 0',
                    }}
                  >
                    {c.items.map((item, index) => (
  <li
    key={index}
    style={{
      fontSize: '12px',
      listStyleType: 'disc',
    }}
  >
    {item.label}
    {item.amountText ? ` ${item.amountText}` : ''}
    {` · ${item.kcal} kcal`}
  </li>
))}

                  </ul>
                </details>
              </div>
              <div className="btn-row">
                <button
                  className="secondary small"
                  onClick={() => {
                    setEditingCombo(c);
                    setEditingComboName(c.name);
                    setEditingComboItems(c.items);
                  }}
                >
                  編輯
                </button>
                <button
                  className="secondary small"
                  onClick={() => deleteCombo(c.id)}
                >
                  刪除
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
{/* 📖 使用說明與參考 (從紀錄頁搬移過來) */}
      <section className="card">
        <h2>📖 使用說明與參考</h2>
        <details>
          <summary>如何記錄飲食？</summary>
          <div className="form-section" style={{ fontSize: 14, lineHeight: 1.6, color: '#444' }}>
            <p>
              <strong>🔍 快速搜尋模式</strong><br />
              1. <b>常用組合</b>：搜尋框下方顯示，點擊 <b>+</b> 一鍵加入。<br />
              2. <b>食物搜尋</b>：輸入名稱（如「雞胸肉」），選取結果並填入份量。<br />
              3. <b>類別估算</b>：若無資料，切換「類別/估算模式」，選食物類型輸入份數。
            </p>
            <p style={{ marginTop: 12 }}>
              <strong>🖐️ 手掌法模式</strong><br />
              適合外食或不方便秤重時使用。<br />
              1. 輸入食物名稱。<br />
              2. 依照下方「手掌份量參考」輸入份數。<br />
              3. 系統自動計算營養成分。
            </p>
          </div>
        </details>

        <details style={{ marginTop: 12 }}>
          <summary>🖐️ 手掌份量估算法 & 常見食物重量</summary>
          <ul className="met-list" style={{ marginTop: 8 }}>
            <li>
              <strong>拳頭 (Fist) 👊：</strong>
              <ul style={{ paddingLeft: 20, marginTop: 4, listStyleType: 'disc' }}>
                <li>水果：1 個拳頭 ≈ 1 份 (約 130g)</li>
                <li>熟蔬菜：1 個拳頭 ≈ 1 份 (約 100g)</li>
                <li>飯/麵：1 個拳頭熟飯 ≈ 4 份 (約 160g)</li>
              </ul>
            </li>
            <li style={{ marginTop: 8 }}>
              <strong>手掌心 (Palm) ✋：</strong>
              <ul style={{ paddingLeft: 20, marginTop: 4, listStyleType: 'disc' }}>
                <li>肉/魚：手掌大、小指厚 ≈ 3 份 (約 100g)</li>
              </ul>
            </li>
            <li style={{ marginTop: 8 }}>
              <strong>大拇指 (Thumb) 👍：</strong>
              <ul style={{ paddingLeft: 20, marginTop: 4, listStyleType: 'disc' }}>
                <li>油脂/堅果：1 指節 ≈ 1 份 (5g)</li>
              </ul>
            </li>
          </ul>
        </details>
      </section>
      {/* 編輯常用組合彈窗 */}
      {editingCombo && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 20,
            padding: '20px 0',
          }}
        >
          <div
            className="modal"
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 16,
              maxWidth: 400,
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          >
            <h3 style={{ marginTop: 0 }}>編輯組合：{editingCombo.name}</h3>
            <div className="form-section">
              <label>
                組合名稱
                <input
                  value={editingComboName}
                  onChange={(e) => setEditingComboName(e.target.value)}
                  placeholder="例如：午餐便當組合"
                />
              </label>
            </div>

            <h4 style={{ marginBottom: 8 }}>
              組合明細 ({editingComboItems.length} 項)
            </h4>
            <div
              className="list-section"
              style={{
                border: '1px solid var(--line)',
                borderRadius: 8,
                padding: 8,
              }}
            >
              {editingComboItems.map((item, index) => (
                <div
                  key={index}
                  style={{
                    marginBottom: 12,
                    borderBottom: '1px dotted #ccc',
                    paddingBottom: 8,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <b style={{ fontSize: 15 }}>{item.label}</b>
                    <button
                      className="secondary small"
                      onClick={() =>
                        setEditingComboItems((prev) =>
                          prev.filter((_, i) => i !== index)
                        )
                      }
                      style={{ padding: '2px 8px' }}
                    >
                      移除
                    </button>
                  </div>
                                                                  <div
                    className="inline-inputs"
                    style={{
                      marginTop: 6,
                      display: 'flex',
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          lineHeight: 1.3,
                        }}
                      >
                        Kcal
                      </div>
                      <input
                        type="number"
                        value={item.kcal}
                        onChange={(e) => {
                          const v = Number(e.target.value) || 0;
                          setEditingComboItems((prev) =>
                            prev.map((it, i) =>
                              i === index ? { ...it, kcal: v } : it
                            )
                          );
                        }}
                        style={{
                          padding: '6px',
                          width: '100%',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          lineHeight: 1.3,
                        }}
                      >
                        份量描述
                      </div>
                      <input
                        type="text"
                        value={item.amountText || ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setEditingComboItems((prev) =>
                            prev.map((it, i) =>
                              i === index ? { ...it, amountText: v } : it
                            )
                          );
                        }}
                        style={{
                          padding: '6px',
                          width: '100%',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>



                </div>
              ))}
              {editingComboItems.length === 0 && (
                <div className="hint">組合中無品項，請重新紀錄。</div>
              )}

              <div
                style={{
                  textAlign: 'center',
                  paddingTop: 10,
                  fontSize: 14,
                }}
              >
                總熱量：
                <b>
                  {editingComboItems.reduce(
                    (sum, item) => sum + (item.kcal || 0),
                    0
                  )}{' '}
                  kcal
                </b>
              </div>
            </div>

            <div className="btn-row" style={{ marginTop: 16 }}>
              <button
                className="primary"
                onClick={saveComboEdit}
                disabled={
                  !editingComboName.trim() || editingComboItems.length === 0
                }
              >
                儲存全部變更
              </button>
              <button
                onClick={() => {
                  setEditingCombo(null);
                  setEditingComboItems([]);
                }}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 資料來源同步 (CSV) */}
      <section className="card">
        <h2>資料來源同步 (CSV)</h2>
        <div className="form-section">
          <label>
            Type Table
            <input
              value={srcType}
              onChange={(e) => setSrcType(e.target.value)}
              placeholder="/ju-smile-app/data/Type_Table.csv"
            />
          </label>
          <label>
            Unit Map
            <input
              value={srcUnit}
              onChange={(e) => setSrcUnit(e.target.value)}
              placeholder="/ju-smile-app/data/Unit_Map.csv"
            />
          </label>
          <label>
            Food DB
            <input
              value={srcFood}
              onChange={(e) => setSrcFood(e.target.value)}
              placeholder="/ju-smile-app/data/Food_DB.csv"
            />
          </label>
          <label>
            Exercise MET
            <input
              value={srcMet}
              onChange={(e) => setSrcMet(e.target.value)}
              placeholder="/ju-smile-app/data/Exercise_Met.csv"
            />
          </label>
          <button className="primary" onClick={syncCsv} disabled={csvLoading}>
            {csvLoading ? '同步中…' : '同步精準資料'}
          </button>
          {csvError && <div className="error-text">{csvError}</div>}
        </div>
      </section>

      {/* 資料匯出 / 匯入 */}
      <section className="card">
        <h2>資料匯出 / 匯入</h2>
        <div className="form-section">
          <div className="btn-row">
            <button className="secondary" onClick={handleExportJson}>
              匯出 JSON
            </button>
            <button className="secondary" onClick={handleImportClick}>
              匯入 JSON
            </button>
            <button className="secondary" onClick={handleBackupToDrive}>
              一鍵備份到 Google Drive
            </button>
          </div>
          <input
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            ref={fileInputRef}
            onChange={handleImportJson}
          />
        </div>
      </section>
      <InstallGuideWidget />


      {/* 去關於頁的入口 */}
      <section className="card">
        <h2>關於 Ju Smile App</h2>
        <div className="form-section">
          <p style={{ marginBottom: 8 }}>
            查看 App 版本、資料儲存方式與備份建議。
          </p>
          <button
            type="button"
            className="secondary"
            onClick={onOpenAbout}
            style={{ borderRadius: 999, padding: '8px 16px', cursor: 'pointer' }}
          >
            查看 App 版本 & 詳細說明
          </button>
        </div>
      </section>
    </div>
  );
};

  // ======== Plan 頁 ========
  const PlanPage: React.FC = () => {
    const { showToast } = React.useContext(ToastContext);
    // 這是用來關閉下拉選單的小工具
    const closeDropdown = (e: React.MouseEvent) => {
      const details = e.currentTarget.closest('details');
      if (details) {
        details.removeAttribute('open');
      }
    };
    // 基本資料：從 localStorage 還原，沒有就留空
    const [gender, setGender] = useState<'female' | 'male' | ''>(() => {
      try {
        const raw = localStorage.getItem('JU_PLAN_FORM');
        if (!raw) return '';
        const obj = JSON.parse(raw);
        return obj.gender === 'female' || obj.gender === 'male' ? obj.gender : '';
      } catch {
        return '';
      }
    });

    const [age, setAge] = useState<string>(() => {
      try {
        const raw = localStorage.getItem('JU_PLAN_FORM');
        if (!raw) return '';
        const obj = JSON.parse(raw);
        return obj.age != null ? String(obj.age) : '';
      } catch {
        return '';
      }
    }); // 例: 30

    const [height, setHeight] = useState<string>(() => {
      try {
        const raw = localStorage.getItem('JU_PLAN_FORM');
        if (!raw) return '';
        const obj = JSON.parse(raw);
        return obj.height != null ? String(obj.height) : '';
      } catch {
        return '';
      }
    }); // 例: 165

    const [weight, setWeight] = useState<string>(() => {
      try {
        const raw = localStorage.getItem('JU_PLAN_FORM');
        if (!raw) return '';
        const obj = JSON.parse(raw);
        return obj.weight != null ? String(obj.weight) : '';
      } catch {
        return '';
      }
    }); // 例: 60

    const [activity, setActivity] =
      useState<'sedentary' | 'light' | 'moderate' | 'active' | 'very' | ''>(() => {
        try {
          const raw = localStorage.getItem('JU_PLAN_FORM');
          if (!raw) return '';
          const obj = JSON.parse(raw);
          const v = obj.activity;
          if (
            v === 'sedentary' ||
            v === 'light' ||
            v === 'moderate' ||
            v === 'active' ||
            v === 'very'
          ) {
            return v;
          }
          return '';
        } catch {
          return '';
        }
      });

    const w = Number(weight) || 0;
    const h = Number(height) || 0;
    const a = Number(age) || 0;
    // ...（後面原本程式碼照舊）

    const bmr = useMemo(() => {
      if (!gender || !w || !h || !a) return 0;
      return Math.round(
        gender === 'male'
          ? 10 * w + 6.25 * h - 5 * a + 5
          : 10 * w + 6.25 * h - 5 * a - 161
      );
    }, [gender, w, h, a]);

    const tdee = useMemo(() => {
      if (!bmr || !activity) return 0;
      const mult = {
        sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very: 1.9,
      }[activity];
      return Math.round(bmr * (mult || 0));
    }, [bmr, activity]);

    const [selectedGoal, setSelectedGoal] = useState<number | null>(null);
    // 初始化：還原上次輸入的表單內容
    useEffect(() => {
      try {
        const raw = localStorage.getItem('JU_PLAN_FORM');
        if (raw) {
          const obj = JSON.parse(raw);
          if (obj && typeof obj === 'object') {
            if (obj.gender) setGender(obj.gender);
            if (obj.age != null) setAge(String(obj.age));
            if (obj.height != null) setHeight(String(obj.height));
            if (obj.weight != null) setWeight(String(obj.weight));
            if (obj.activity) setActivity(obj.activity);
            if (obj.selectedGoal != null) setSelectedGoal(Number(obj.selectedGoal));
          }
        }
      } catch { /* ignore */ }
    }, []);

    // 變更時即時保存
    useEffect(() => {
      const data = { gender, age, height, weight, activity, selectedGoal };
      try { localStorage.setItem('JU_PLAN_FORM', JSON.stringify(data)); } catch { /* ignore */ }
    }, [gender, age, height, weight, activity, selectedGoal]);

    // 小圓環
    const ResultRing: React.FC<{ value: number; label: string }> = ({ value, label }) => (
      <div className="ring-card" style={{ minWidth: 140 }}>
        <div className="ring" style={{ ['--p' as any]: 85 }}>
          <div className="ring-center">
            <div className="ring-value" style={{ fontSize: 22, fontWeight: 800 }}>{value || 0}</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>{label}</div>
          </div>
        </div>
        <div className="ring-label" style={{ color: 'var(--mint-dark)', fontWeight: 700 }}>
          {label === 'BMR' ? '基礎代謝率' : '每日總消耗'}
        </div>
        <div className="ring-sub" style={{ opacity: 0.75 }}>
          {label === 'BMR' ? '維持生命最低熱量' : '維持體重熱量'}
        </div>
      </div>
    );

    const GoalCard: React.FC<{ title: string; kcal: number; tip?: string; warn?: string; recommended?: boolean; }> =
      ({ title, kcal, tip, warn, recommended }) => (
        <div
          className="card"
          style={{
            border: selectedGoal === kcal ? '2px solid #5c9c84' : '1px solid var(--line)',
            background: recommended ? '#fafffc' : '#fff',
            cursor: 'pointer'
          }}
          onClick={() => setSelectedGoal(kcal)}
        >
          <div className="meal-header">
            {selectedGoal === kcal && <span className="tag" style={{ marginRight: 8, background: '#5c9c84' }}>已選</span>}
            <span className="meal-title" style={{ color: recommended ? 'var(--mint-dark)' : 'var(--text-main)' }}>
              {title}
            </span>
            {recommended && <span className="tag" style={{ marginLeft: 8 }}>推薦</span>}
          </div>
          <div className="meal-body">
            <div className="kcal">{Math.max(0, Math.round(kcal))} kcal</div>
            {tip && <div className="tip">{tip}</div>}
            {warn && <div className="warning" style={{ color: '#d64545' }}>{warn}</div>}
          </div>
        </div>
      );

    const activityOptions: BigOption[] = [
  { value: 'sedentary', label: '久坐 (1.2) · 幾乎不運動 / 整天久坐' },
  { value: 'light',     label: '輕量 (1.375) · 每週 1–3 天輕度活動' },
  { value: 'moderate',  label: '中等 (1.55) · 每週 3–5 天中等強度活動' },
  { value: 'active',    label: '活躍 (1.725) · 每週 6–7 天運動或站立工作' },
  { value: 'very',      label: '非常活躍 (1.9) · 高強度訓練 / 體力工作' },
];


    return (
      <div className="page page-plan" style={{ padding: 16, paddingBottom: '96px' }}>
        <h1 style={{ fontSize: 22, marginBottom: 12 }}>BMR / TDEE 計算</h1>

        <section className="card">
          <h2>基本資料</h2>
          <div className="form-section">
            <label>
              性別
              <BigSelect
                options={[
                  { value: 'female', label: '女性' },
                  { value: 'male', label: '男性' },
                ]}
                value={gender}
                onChange={(v) => {
                  setGender(v as any);
                }}
                placeholder="請選擇"
              />
            </label>

            <label>
              年齡
              <input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="例: 30" />
            </label>
            <label>
              身高 (cm)
              <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="例: 165" />
            </label>
            <label>
              體重 (kg)
              <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="例: 60" />
            </label>
            <label>
              活動量
              <BigSelect
                options={activityOptions}
                value={activity}
                onChange={(v) => {
                  setActivity(v as any);
                }}
                placeholder="請選擇"
              />
            </label>

          </div>
        </section>

        <section className="card">
          <h2>計算結果</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 16, background: '#f6fbff' }}>
              <div style={{ fontSize: 12, color: '#5c9c84', fontWeight: 700, letterSpacing: 1 }}>BMR</div>
              <div style={{ fontSize: 28, fontWeight: 800, margin: '4px 0 8px 0' }}>{bmr || 0}</div>
              <div style={{ fontSize: 13, opacity: 0.8 }}>基礎代謝率 · 維持生命最低熱量</div>
            </div>
            <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 16, background: '#fffaf6' }}>
              <div style={{ fontSize: 12, color: '#e68a3a', fontWeight: 700, letterSpacing: 1 }}>TDEE</div>
              <div style={{ fontSize: 28, fontWeight: 800, margin: '4px 0 8px 0' }}>{tdee || 0}</div>
              <div style={{ fontSize: 13, opacity: 0.8 }}>每日總消耗 · 維持體重熱量</div>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>目標攝取建議</h2>
          <div className="meals-card">
            <GoalCard title="維持目前體重" kcal={tdee} tip="熱量平衡 (Net 0)" />
            <GoalCard title="溫和減重" kcal={tdee ? tdee - 300 : 0} tip="每日赤字 -300 (月減 ~1.2kg)" recommended />
            <GoalCard title="標準減重" kcal={tdee ? tdee - 500 : 0} tip="每日赤字 -500 (月減 ~2kg)"
              warn={tdee && (tdee - 500) < bmr ? '低於 BMR，請評估是否過低' : undefined} />
            <GoalCard title="積極減重" kcal={tdee ? tdee - 1000 : 0} tip="每日赤字 -1000 (月減 ~4kg)"
              warn="不建議長期執行，易流失肌肉" />
            {/* 增重 */}
            <GoalCard title="溫和增重" kcal={tdee ? tdee + 300 : 0} tip="每日盈餘 +300 (月增 ~1.2kg)" />
            <GoalCard title="標準增重" kcal={tdee ? tdee + 500 : 0} tip="每日盈餘 +500 (月增 ~2kg)" />
          </div>

          <div style={{ textAlign: 'center', marginTop: 12 }}>
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
              style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: '#5c9c84', color: '#fff', fontSize: 16 }}
            >
              加入目標熱量
            </button>
          </div>

          <div className="hint" style={{ marginTop: 8 }}>
            減掉 <b>1 公斤</b> 的體脂肪約需 <b>7,700 kcal</b>；建議以 TDEE 減去 <b>300–500 kcal</b> 做溫和減重。
          </div>
        </section>
      </div>
    );
  };

  // ======== TrendsPage (趨勢分析頁面) ========
  const TrendsPage: React.FC = () => {
    const [period, setPeriod] = useState<'week' | 'longTerm' | 'yearly'>('week');
    const [metric, setMetric] = useState<'bodyComposition' | 'weight' | 'bodyFat' | 'skeletalMuscle' | 'calories' | 'protein'>('bodyComposition');

    // 🆕 檢查是否有足夠的長期數據（90 天以上）
    const hasLongTermData = useMemo(() => {
      const oldestDate = days.reduce((oldest, day) => {
        return !oldest || day.date < oldest ? day.date : oldest;
      }, '');
      
      if (!oldestDate) return false;
      
      const daysSinceFirst = dayjs().diff(dayjs(oldestDate), 'day');
      return daysSinceFirst >= 90;
    }, [days]);

    // 準備圖表數據
    const chartData = useMemo(() => {
      const data: any[] = [];
      const today = dayjs();

      if (period === 'week') {
        // 週報：固定顯示最近 7 天（連續）
        for (let i = 6; i >= 0; i--) {
          const currentDate = today.subtract(i, 'day');
          const dateStr = currentDate.format('YYYY-MM-DD');
          const day = days.find(d => d.date === dateStr);
          const dayMeals = meals.filter(m => m.date === dateStr);
          const dayExercises = exercises.filter(e => e.date === dateStr);

          const totalKcal = dayMeals.reduce((sum, m) => sum + (m.kcal || 0), 0);
          const burnedKcal = dayExercises.reduce((sum, e) => sum + (e.kcal || 0), 0);
          const netKcal = totalKcal - burnedKcal;
          const totalProtein = dayMeals.reduce((sum, m) => sum + (m.protein || 0), 0);

          data.push({
            date: currentDate.format('MM/DD'),
            fullDate: dateStr,
            weight: day?.weight ?? null,
            bodyFat: day?.bodyFat ?? null,
            skeletalMuscle: day?.skeletalMuscle ?? null,
            calories: totalKcal > 0 ? netKcal : null,
            protein: totalProtein > 0 ? totalProtein : null,
          });
        }
      } else if (period === 'longTerm') {
        // 90天趨勢：固定顯示 13 個點，每個點間隔 7 天
        for (let i = 12; i >= 0; i--) {
          const targetDate = today.subtract(i * 7, 'day');
          const dateStr = targetDate.format('YYYY-MM-DD');
          const day = days.find(d => d.date === dateStr);
          const dayMeals = meals.filter(m => m.date === dateStr);
          const dayExercises = exercises.filter(e => e.date === dateStr);

          const totalKcal = dayMeals.reduce((sum, m) => sum + (m.kcal || 0), 0);
          const burnedKcal = dayExercises.reduce((sum, e) => sum + (e.kcal || 0), 0);
          const netKcal = totalKcal - burnedKcal;
          const totalProtein = dayMeals.reduce((sum, m) => sum + (m.protein || 0), 0);

          data.push({
            date: targetDate.format('MM/DD'),
            fullDate: dateStr,
            weight: day?.weight ?? null,
            bodyFat: day?.bodyFat ?? null,
            skeletalMuscle: day?.skeletalMuscle ?? null,
            calories: totalKcal > 0 ? netKcal : null,
            protein: totalProtein > 0 ? totalProtein : null,
          });
        }
      
      } else if (period === 'yearly') {
        // 🆕 年趨勢：顯示最近 12 個月，每月取樣一次（每月 1 號或最接近的日期）
        for (let i = 11; i >= 0; i--) {
          const targetDate = today.subtract(i, 'month').startOf('month'); // 每月 1 號
          const dateStr = targetDate.format('YYYY-MM-DD');
          const day = days.find(d => d.date === dateStr);
          const dayMeals = meals.filter(m => m.date === dateStr);
          const dayExercises = exercises.filter(e => e.date === dateStr);

          const totalKcal = dayMeals.reduce((sum, m) => sum + (m.kcal || 0), 0);
          const burnedKcal = dayExercises.reduce((sum, e) => sum + (e.kcal || 0), 0);
          const netKcal = totalKcal - burnedKcal;
          const totalProtein = dayMeals.reduce((sum, m) => sum + (m.protein || 0), 0);

          data.push({
            date: targetDate.format('M月'),  // X 軸：1月, 2月, 3月...
            fullDate: dateStr,
            weight: day?.weight ?? null,
            bodyFat: day?.bodyFat ?? null,
            skeletalMuscle: day?.skeletalMuscle ?? null,
            calories: totalKcal > 0 ? netKcal : null,
            protein: totalProtein > 0 ? totalProtein : null,
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
      if (metric === 'bodyComposition') return null;

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
      } else if (metric === 'protein') {
        const goal = settings.proteinGoal || 0;
        if (avg >= goal) {
          suggestion = '蛋白質攝取充足,有助於肌肉維持！💪';
        } else {
          suggestion = '蛋白質攝取不足,建議增加豆魚蛋肉類攝取。';
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
      protein: { label: '蛋白質', unit: 'g', color: '#d64545', yAxisDomain: [0, 150] },
    };

    const config = metricConfig[metric];

    return (
      <div className="page" style={{ padding: 16, paddingBottom: '96px' }}>
        <h1 style={{ fontSize: 22, marginBottom: 16 }}>📊 數據趨勢分析</h1>

        {/* 數據洞察卡片（身體組成模式不顯示） */}
        {insights && metric !== 'bodyComposition' && (
          <section className="card" style={{ background: 'linear-gradient(135deg, #f6fbff 0%, #fffaf6 100%)', border: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 24 }}>{insights.emoji}</span>
              <h2 style={{ margin: 0, fontSize: 18 }}>數據洞察</h2>
            </div>
            <div style={{ fontSize: 15, lineHeight: 1.6 }}>
              <p style={{ margin: '4px 0' }}>
                <b>{period === 'week' ? '本週' : period === 'longTerm' ? '90 天' : '年度'}{config.label}趨勢：{insights.trend}</b>
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

        {/* 切換按鈕 */}
        <section className="card">
          {/* 第一排：週報 + 90天趨勢 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button
              onClick={() => setPeriod('week')}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 8,
                border: period === 'week' ? '2px solid #5c9c84' : '1px solid var(--line)',
                background: period === 'week' ? '#f0f8f4' : '#fff',
                fontWeight: period === 'week' ? 700 : 400,
                cursor: 'pointer',
              }}
            >
              週報 (7天)
            </button>
            <button
              onClick={() => setPeriod('longTerm')}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 8,
                border: period === 'longTerm' ? '2px solid #5c9c84' : '1px solid var(--line)',
                background: period === 'longTerm' ? '#f0f8f4' : '#fff',
                fontWeight: period === 'longTerm' ? 700 : 400,
                cursor: 'pointer',
              }}
            >
              90 天趨勢
            </button>
          </div>

          {/* 🆕 第二排：年趨勢（動態顯示：只在有 90 天以上數據時顯示） */}
          {hasLongTermData && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                onClick={() => setPeriod('yearly')}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 8,
                  border: period === 'yearly' ? '2px solid #5c9c84' : '1px solid var(--line)',
                  background: period === 'yearly' ? '#f0f8f4' : '#fff',
                  fontWeight: period === 'yearly' ? 700 : 400,
                  cursor: 'pointer',
                }}
              >
                📅 年趨勢 (365天)
              </button>
            </div>
          )}

          {/* 如果沒有年趨勢按鈕，增加 marginBottom */}
          {!hasLongTermData && <div style={{ marginBottom: 8 }} />}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {/* 🆕 身體組成合併圖表按鈕 */}
            <button
              onClick={() => setMetric('bodyComposition')}
              style={{
                padding: '10px',
                borderRadius: 8,
                border: metric === 'bodyComposition' ? '2px solid #5c9c84' : '1px solid var(--line)',
                background: metric === 'bodyComposition' ? 'linear-gradient(135deg, #f0f8f4 0%, #fffaf6 100%)' : '#fff',
                fontWeight: metric === 'bodyComposition' ? 700 : 400,
                cursor: 'pointer',
                gridColumn: '1 / -1', // 佔滿整行
              }}
            >
              📊 身體組成
            </button>
            <button
              onClick={() => setMetric('weight')}
              style={{
                padding: '10px',
                borderRadius: 8,
                border: metric === 'weight' ? '2px solid #5c9c84' : '1px solid var(--line)',
                background: metric === 'weight' ? '#f0f8f4' : '#fff',
                fontWeight: metric === 'weight' ? 700 : 400,
                cursor: 'pointer',
              }}
            >
              體重
            </button>
            <button
              onClick={() => setMetric('bodyFat')}
              style={{
                padding: '10px',
                borderRadius: 8,
                border: metric === 'bodyFat' ? '2px solid #e68a3a' : '1px solid var(--line)',
                background: metric === 'bodyFat' ? '#fffaf6' : '#fff',
                fontWeight: metric === 'bodyFat' ? 700 : 400,
                cursor: 'pointer',
              }}
            >
              體脂率
            </button>
            <button
              onClick={() => setMetric('skeletalMuscle')}
              style={{
                padding: '10px',
                borderRadius: 8,
                border: metric === 'skeletalMuscle' ? '2px solid #10b981' : '1px solid var(--line)',
                background: metric === 'skeletalMuscle' ? '#f0fdf4' : '#fff',
                fontWeight: metric === 'skeletalMuscle' ? 700 : 400,
                cursor: 'pointer',
              }}
            >
              骨骼肌率
            </button>
            <button
              onClick={() => setMetric('calories')}
              style={{
                padding: '10px',
                borderRadius: 8,
                border: metric === 'calories' ? '2px solid #4a90e2' : '1px solid var(--line)',
                background: metric === 'calories' ? '#f6fbff' : '#fff',
                fontWeight: metric === 'calories' ? 700 : 400,
                cursor: 'pointer',
              }}
            >
              淨熱量
            </button>
            <button
              onClick={() => setMetric('protein')}
              style={{
                padding: '10px',
                borderRadius: 8,
                border: metric === 'protein' ? '2px solid #d64545' : '1px solid var(--line)',
                background: metric === 'protein' ? '#fff6f6' : '#fff',
                fontWeight: metric === 'protein' ? 700 : 400,
                cursor: 'pointer',
              }}
            >
              蛋白質
            </button>
          </div>
        </section>

        {/* 趨勢圖 */}
        <section className="card">
          <h2 style={{ marginBottom: 16 }}>{config.label}趨勢</h2>
          
          {/* 🆕 優化：外層加入橫向捲動容器，避免 X 軸過擠 */}
          <div style={{ width: '100%', overflowX: 'auto', paddingBottom: 10 }}>
            {/* 設定 minWidth，資料多時自動變寬讓使用者滑動 */}
            <div style={{ minWidth: chartData.length > 10 ? 600 : '100%', height: 300 }}>
              
              {/* 🆕 身體組成合併圖表（雙 Y 軸） */}
              {metric === 'bodyComposition' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis 
                      dataKey="date" 
                      style={{ fontSize: 12 }}
                      interval="preserveStartEnd" 
                      tick={{ fontSize: 11 }}
                      angle={-45} // 傾斜標籤避免重疊
                      textAnchor="end"
                      height={60}
                    />
                    {/* 左側 Y 軸：體重 (顯示單位 kg) */}
                    <YAxis
                      yAxisId="left"
                      domain={['auto', 'auto']}
                      style={{ fontSize: 11 }}
                      tickFormatter={(v) => `${v}kg`} 
                      width={50} // 預留寬度給單位
                    />
                    {/* 右側 Y 軸：體脂率 & 骨骼肌率 (顯示單位 %) */}
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      domain={['auto', 'auto']}
                      style={{ fontSize: 11 }}
                      tickFormatter={(v) => `${v}%`}
                      width={45} // 預留寬度給單位
                    />
                    <Tooltip
                      contentStyle={{ background: '#fff', border: '1px solid #ccc', borderRadius: 8 }}
                      formatter={(value: any, name: string) => {
                        if (name === 'weight') return [`${Number(value).toFixed(1)} kg`, '體重'];
                        if (name === 'bodyFat') return [`${Number(value).toFixed(1)}%`, '體脂率'];
                        if (name === 'skeletalMuscle') return [`${Number(value).toFixed(1)}%`, '骨骼肌率'];
                        return [value, name];
                      }}
                    />
                    <Legend verticalAlign="top" height={36}/>
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="weight"
                      name="體重"
                      stroke="#5c9c84"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#5c9c84' }}
                      activeDot={{ r: 6 }}
                      connectNulls
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="bodyFat"
                      name="體脂率"
                      stroke="#e68a3a"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ r: 3, fill: '#e68a3a' }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="skeletalMuscle"
                      name="骨骼肌率"
                      stroke="#10b981"
                      strokeWidth={2}
                      strokeDasharray="2 2"
                      dot={{ r: 3, fill: '#10b981' }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                // 單一指標圖表
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis 
                      dataKey="date" 
                      style={{ fontSize: 12 }}
                      interval="preserveStartEnd"
                      tick={{ fontSize: 11 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    {/* Y 軸加上單位 */}
                    <YAxis
                      domain={config.yAxisDomain}
                      style={{ fontSize: 11 }}
                      tickFormatter={(value) => `${value}${config.unit}`}
                      width={55}
                    />
                    <Tooltip
                      contentStyle={{ background: '#fff', border: '1px solid #ccc', borderRadius: 8 }}
                      formatter={(value: any) => [`${Number(value).toFixed(1)} ${config.unit}`, config.label]}
                    />
                    <Line
                      type="monotone"
                      dataKey={metric}
                      stroke={config.color}
                      strokeWidth={3}
                      dot={{ r: 4, fill: config.color }}
                      activeDot={{ r: 6 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
            {/* 底部提示 */}
            {(period === 'longTerm' || period === 'yearly') && (
               <div style={{ textAlign: 'center', fontSize: 12, color: '#999', marginTop: 4 }}>
                 ← 左右滑動查看更多數據 →
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
    
    <div className="app">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {tab === 'today' && (
        <TodayPage onAddExercise={goToExerciseRecord} />
      )}

      {tab === 'records' && (
        <RecordsPage
          recordTab={recordTab}
          setRecordTab={setRecordTab}
          defaultMealType={recordDefaultMealType}
          foodMealType={currentFoodMealType}
          setFoodMealType={setCurrentFoodMealType}
        />
      )}

      {tab === 'trends' && (
        <TrendsPage />
      )}

      {tab === 'settings' && (
        <SettingsPage onOpenAbout={() => setTab('about')} />
      )}

      {tab === 'plan' && <PlanPage />}
      {tab === 'about' && <AboutPage onBack={() => setTab('settings')} />}

      <nav className="bottom-nav">
        <button
          className={tab === 'today' ? 'active' : ''}
          onClick={() => setTab('today')}
        >
          <div className="nav-icon">🏠</div>
          <div className="nav-label">首頁</div>
        </button>
        <button
          className={tab === 'records' ? 'active' : ''}
          onClick={() => setTab('records')}
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

      {showUpdateBar && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            padding: '8px 12px',
            background: '#222',
            color: '#fff',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            zIndex: 50,
          }}
        >
          <span>Ju Smile App 有新版本，請重新載入取得最新功能。</span>
          <button
            type="button"
            onClick={handleReloadForUpdate}
            style={{
              borderRadius: 999,
              border: 'none',
              padding: '6px 10px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            立即更新
          </button>
        </div>
      )}
    </div>
  </ToastContext.Provider>
);
};

export default App;