import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import dayjs from 'dayjs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { VisualPortionPicker } from './VisualPortionPicker';

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
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.0)', zIndex: 200, // 背景改為全透明
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        pointerEvents: 'auto' /* 🟢 關鍵修改：讓點擊穿透背景，這樣你可以直接點擊其他欄位來切換 */
      }}
      onClick={onClose} 
    >
      <div
        style={{
          width: '100%', maxWidth: 420, background: '#f0f2f5',
          borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: '24px 20px',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
          animation: 'slideIn 0.2s ease-out',
          pointerEvents: 'auto' /* 🟢 恢復內容區塊的點擊感應 */
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' }}>
          {/* 🟢 移除 X，只留標題 */}
          <span style={{ fontSize: 16, fontWeight: 600, color: '#666' }}>{title}</span>

          <div style={{ fontSize: 28, fontWeight: 700, color: '#1f2937' }}>
            {value || '0'} <span style={{fontSize:16, fontWeight:500, color:'#888'}}>{unit}</span>
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
            fontSize: 'var(--font-xs)',
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
                fontSize: 'var(--font-sm)',
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
                fontSize: 15,
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
          <p style={{ fontSize: 'var(--font-xs)', color: '#666', marginBottom: 0 }}>
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
          <ul style={{ paddingLeft: 20, marginBottom: 0, fontSize: 'var(--font-xs)' }}>
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
      let touchEndX = 0;

      const handleTouchStart = (e: TouchEvent) => {
        touchStartX = e.touches[0].clientX;
        touchEndX = e.touches[0].clientX;
      };

      const handleTouchMove = (e: TouchEvent) => {
        touchEndX = e.touches[0].clientX;
      };

      const handleTouchEnd = () => {
        const diff = touchStartX - touchEndX;
        const threshold = 50;

        if (Math.abs(diff) > threshold) {
          if (diff > 0) {
            // 左滑 → 下一週
            setWeekStart(dayjs(weekStart).add(7, 'day').format('YYYY-MM-DD'));
          } else {
            // 右滑 → 上一週
            setWeekStart(dayjs(weekStart).subtract(7, 'day').format('YYYY-MM-DD'));
          }
        }
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

// 單位列表 (固定順序，方便計算索引)
const unitList = [
  '個', '杯', '碗', '盤', '片', '瓶', '包', 'g', 'ml','湯匙', '茶匙',
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
      showToast('success',`已將組合「${combo.name}」加入 ${formMealType}。`); // 🟢 提示文字也改
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
      <header className="top-bar">
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
    onClick={() => setRecordTab('food')}
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
            

            {/* 🆕 輸入模式切換 */}
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
    onClick={() => setFoodInputMode('search')}
    style={{
      flex: 1,
      height: 36,
      padding: '0 10px',
      border: 'none',
      borderRadius: 999,
      background: foodInputMode === 'search' ? '#fff' : 'transparent',
      color: foodInputMode === 'search' ? 'var(--mint-dark, #5c9c84)' : '#6b7280',
      boxShadow: foodInputMode === 'search' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
fontWeight: foodInputMode === 'search' ? 800 : 700,
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
    🔍&nbsp;快速搜尋
  </button>

  <button
    type="button"
    onClick={() => setFoodInputMode('palm')}
    style={{
      flex: 1,
      height: 36,
      padding: '0 10px',
      border: 'none',
      borderRadius: 999,
      background: foodInputMode === 'palm' ? '#fff' : 'transparent',
      color: foodInputMode === 'palm' ? 'var(--mint-dark, #5c9c84)' : '#6b7280',
      boxShadow: foodInputMode === 'palm' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
      fontWeight: foodInputMode === 'palm' ? 800 : 700,
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
   <img 
    src={palmImg} 
    alt="hand" 
    style={{ width: 24, height: 24, marginRight: 6, objectFit: 'contain' }} 
  />
  手掌法
</button>
</div>

            

            {/* 🆕 快速搜尋模式 */}
            {foodInputMode === 'search' && (
            <div className="form-section">
              {/* 貼上這一段新的搜尋框程式碼 */}

  <div ref={searchTopRef} style={{ marginBottom: 0 }}>
  <div style={{ position: 'relative' }}>
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
      }}
      placeholder="輸入關鍵字 (例: 雞蛋, 雞胸肉)..."
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
                      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
                      onClick={() => setShowUnitQtyModal(false)}
                    >
                      <div 
                        style={{ width: '100%', maxWidth: 420, background: '#f0f2f5', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, boxShadow: '0 -4px 20px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: 16 }}
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
                {autoFoodInfo.kcal > 0 && (
                  <div className="hint">
                    目前估算熱量:約 {autoFoodInfo.kcal} kcal
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
                      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
                      onClick={() => setShowGramModal(false)}
                    >
                      <div 
                        style={{ width: '100%', maxWidth: 420, background: '#f0f2f5', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, boxShadow: '0 -4px 20px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: 16 }}
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
                {autoFoodInfo.kcal > 0 && (
                  <div className="hint">
                    目前估算熱量:約 {autoFoodInfo.kcal} kcal
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
              P: {round1(m.protein || 0)}g · C: {round1(m.carbs || 0)}g · F: {round1(m.fats || 0)}g
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
        尚未建立常用組合。<br/>
        試著在下方選取多個食物後點擊「儲存組合」！
      </div>
    ) : (
      <div className="quick-list-scroll-horizontal">
        {combos.map((combo) => {
          const totalKcal = combo.items.reduce((sum, item) => sum + item.kcal, 0);
          const totalProtein = combo.items.reduce((sum, item) => sum + (item.protein || 0), 0);
          const totalCarbs = combo.items.reduce((sum, item) => sum + (item.carbs || 0), 0);
          const totalFats = combo.items.reduce((sum, item) => sum + (item.fats || 0), 0);
          
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
                        {item.kcal} kcal · P: {round1(item.protein || 0)}g · C: {round1(item.carbs || 0)}g · F: {round1(item.fats || 0)}g
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
{foodSearchResults.unitMatches.length === 0 &&
  foodSearchResults.foodMatches.length > 0 && (
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
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center' 
      }}
      onClick={() => setShowServingsModal(false)}
    >
      <div 
        style={{ 
          width: '100%', maxWidth: 420, background: '#f0f2f5', 
          borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
          display: 'flex', flexDirection: 'column', gap: 16
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
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100,
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center' 
            }}
            onClick={() => setShowQtyPad(false)}
          >
            <div 
              style={{ 
                width: '100%', maxWidth: 420, background: '#f0f2f5', 
                borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20,
                boxShadow: '0 -4px 20px rgba(0,0,0,0.1)' 
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
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100,
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center' 
            }}
            onClick={() => setShowQtyPad(false)}
          >
            <div 
              style={{ 
                width: '100%', maxWidth: 420, background: '#f0f2f5', 
                borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20,
                boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
                display: 'flex', flexDirection: 'column', gap: 16
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
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100,
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center' 
            }}
            onClick={() => setShowUnitPicker(false)}
          >
            <div 
              style={{ 
                width: '100%', maxWidth: 420, background: '#fff', 
                borderTopLeftRadius: 20, borderTopRightRadius: 20,
                display: 'flex', flexDirection: 'column', 
                paddingBottom: 20, // 底部留白 (適應 iPhone Home Bar)
                boxShadow: '0 -4px 20px rgba(0,0,0,0.1)'
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
                              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
                              onClick={() => setEditingMacro(null)}
                            >
                              <div 
                                style={{ width: '100%', maxWidth: 420, background: '#f0f2f5', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, boxShadow: '0 -4px 20px rgba(0,0,0,0.1)' }}
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
{/* === 份量輸入彈窗 (Servings Modal) === */}
  {showServingsModal && (
    <div 
      className="modal-backdrop"
      style={{ 
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center' 
      }}
      onClick={() => setShowServingsModal(false)}
    >
      <div 
        style={{ 
          width: '100%', maxWidth: 420, background: '#f0f2f5', 
          borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
          display: 'flex', flexDirection: 'column', gap: 16
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
            )}
            {/* 🆕 手掌法模式結束 */}
            {/* 🆕 手掌法輸入模式 */}
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
  <label style={{ marginBottom: 12, fontSize: 16, fontWeight: 700, display: 'block', color:'#333' }}>
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
                if(wInput) wInput.focus();
              }, 100);
            }
          }}
        >
          <div className="intensity-icon">{opt.icon}</div>
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
          if(recordMode === 'detail') setQuickExercise(null); 
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
              <div style={{flex: 1}}>
                <div style={{fontWeight: 600, color: '#333'}}>{row.活動}</div>
                <div style={{fontSize: 12, color: '#666'}}>
                  MET: {row.MET} <span style={{opacity:0.3}}>|</span> 強度: {row.intensity}
                </div>
              </div>
              {selectedMetRow === row && <span style={{color: '#5c9c84', fontWeight:'bold'}}>✔</span>}
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

      </div>
    );
  };

// 定義三種強度 (低 2.5 / 中 4.0 / 高 7.0) 與對應樣式
const INTENSITY_OPTIONS = [
  { id: 'low', label: '低強度', val: '低強度運動', icon: '🧘', met: 2.5, className: 'low' },
  { id: 'medium', label: '中強度', val: '中強度運動', icon: '🏃', met: 4.0, className: 'medium' },
  { id: 'high', label: '高強度', val: '高強度運動', icon: '🔥', met: 7.0, className: 'high' },
];


  const App: React.FC = () => {
  const [tab, setTab] = useState<Tab>('today');
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

// 1. 註冊與監聽新版本發現
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
    } catch {}
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
        <header className="top-bar">
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
  onOpenNumericKeyboard: (target: string, currentValue: string) => void; // 新增
};

const SettingsPage: React.FC<SettingsPageProps> = ({ onOpenAbout, onOpenNumericKeyboard }) => {
  const { showToast } = React.useContext(ToastContext);
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

  showToast('success','已儲存目標設定');
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
    <div className="page page-settings" style={{ paddingBottom: '100px', background: '#f5fbf8' }}>
      
      {/* 頁面標題 */}
      <div style={{ padding: '12px 16px 20px' }}>
        <h1 style={{ margin: 0, fontSize: '28px', color: '#1f2937' }}>我的設定</h1>
        <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '14px' }}>
          打造專屬於你的健康計畫
        </p>
      </div>

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
               <input className="settings-input-clean" value={srcType} onChange={e=>setSrcType(e.target.value)} placeholder="Type Table URL" style={{background:'#f3f4f6', padding:8, borderRadius:6, width:'100%', boxSizing:'border-box'}} />
               <input className="settings-input-clean" value={srcUnit} onChange={e=>setSrcUnit(e.target.value)} placeholder="Unit Map URL" style={{background:'#f3f4f6', padding:8, borderRadius:6, width:'100%', boxSizing:'border-box'}} />
               <input className="settings-input-clean" value={srcFood} onChange={e=>setSrcFood(e.target.value)} placeholder="Food DB URL" style={{background:'#f3f4f6', padding:8, borderRadius:6, width:'100%', boxSizing:'border-box'}} />
               <input className="settings-input-clean" value={srcMet} onChange={e=>setSrcMet(e.target.value)} placeholder="Exercise Met URL" style={{background:'#f3f4f6', padding:8, borderRadius:6, width:'100%', boxSizing:'border-box'}} />
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
                <input value={editingComboName} onChange={(e) => setEditingComboName(e.target.value)} placeholder="例如：午餐便當組合" style={{width:'100%', padding:8, marginTop:4}} />
              </label>
            </div>
            <h4 style={{ marginBottom: 8 }}>組合明細 ({editingComboItems.length} 項)</h4>
            <div className="list-section" style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 8 }}>
              {editingComboItems.map((item, index) => (
                <div key={index} style={{ marginBottom: 12, borderBottom: '1px dotted #ccc', paddingBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <b style={{ fontSize: 15 }}>{item.label}</b>
                    <button className="small" onClick={() => setEditingComboItems((prev) => prev.filter((_, i) => i !== index))} style={{ padding: '2px 8px', background:'#fee2e2', color:'#dc2626' }}>移除</button>
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
                <div key={c.id} className="card" style={{ marginBottom: '12px', padding: '16px', borderRadius:16, border:'none', boxShadow:'0 2px 8px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color:'var(--mint-dark)' }}>{c.name}</div>
                  <details style={{ marginBottom: '12px' }}>
                    <summary style={{ fontSize: '14px', cursor: 'pointer', color:'#555' }}>{c.items.length} 品項 · 總計約 {c.items.reduce((sum, item) => sum + item.kcal, 0)} kcal</summary>
                    <ul style={{ paddingLeft: '20px', marginTop: '8px', color:'#777' }}>
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
          <li><b>常用組合</b>：搜尋框下方顯示，點擊 <b>+</b> 一鍵加入。</li>
          <li><b>食物搜尋</b>：輸入名稱（如「雞胸肉」），選取結果並填入份量。</li>
          <li><b>類別估算</b>：若無資料，切換「類別/估算模式」，選食物類型輸入份數。</li>
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
    適用：<b>水果、熟蔬菜、飯/麵</b><br/>
    • 1 個拳頭水果 ≈ 1 份 (約 130g)<br/>
    • 1 個拳頭熟菜 ≈ 1 份 (約 100g)<br/>
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
    適用：<b>肉類、魚類、豆腐</b><br/>
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
    適用：<b>油脂、堅果、種子</b><br/>
    • 1 個指節 ≈ 1 份 (約 5g 油)
  </div>
</div>

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
            <div style={{ fontSize: 15, opacity: 0.75 }}>{label}</div>
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
              <div style={{ fontSize: 15, color: '#5c9c84', fontWeight: 700, letterSpacing: 1 }}>BMR</div>
              <div style={{ fontSize: 28, fontWeight: 800, margin: '4px 0 8px 0' }}>{bmr || 0}</div>
              <div style={{ fontSize: 13, opacity: 0.8 }}>基礎代謝率 · 維持生命最低熱量</div>
            </div>
            <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 16, background: '#fffaf6' }}>
              <div style={{ fontSize: 15, color: '#e68a3a', fontWeight: 700, letterSpacing: 1 }}>TDEE</div>
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
    const [period, setPeriod] = useState<'7d' | '30d' | '90d' | '180d' | '365d'>('7d');
    const [metric, setMetric] = useState<'bodyComposition' | 'weight' | 'bodyFat' | 'skeletalMuscle' | 'calories' | 'protein'>('bodyComposition');



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
    
    // 🔧 如果當天沒有體重數據，跳過
    if (!day || (day.weight == null && day.bodyFat == null && day.skeletalMuscle == null)) {
      continue;
    }
    
    const dayMeals = meals.filter(m => m.date === dateStr);
    const dayExercises = exercises.filter(e => e.date === dateStr);

    const totalKcal = dayMeals.reduce((sum, m) => sum + (m.kcal || 0), 0);
    const burnedKcal = dayExercises.reduce((sum, e) => sum + (e.kcal || 0), 0);
    const netKcal = totalKcal - burnedKcal;
    const totalProtein = dayMeals.reduce((sum, m) => sum + (m.protein || 0), 0);

    data.push({
      date: currentDate.format('MM/DD'),
      fullDate: dateStr,
      weight: day.weight ?? null,
      bodyFat: day.bodyFat ?? null,
      skeletalMuscle: day.skeletalMuscle ?? null,
      calories: totalKcal > 0 ? netKcal : null,
      protein: totalProtein > 0 ? totalProtein : null,
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
    if (!day) continue;
    
    const dateStr = day.date;
    const dayMeals = meals.filter(m => m.date === dateStr);
    const dayExercises = exercises.filter(e => e.date === dateStr);

    const totalKcal = dayMeals.reduce((sum, m) => sum + (m.kcal || 0), 0);
    const burnedKcal = dayExercises.reduce((sum, e) => sum + (e.kcal || 0), 0);
    const netKcal = totalKcal - burnedKcal;
    const totalProtein = dayMeals.reduce((sum, m) => sum + (m.protein || 0), 0);

    data.push({
      date: targetDate.format('MM/DD'),
      fullDate: dateStr,
      weight: day.weight ?? null,
      bodyFat: day.bodyFat ?? null,
      skeletalMuscle: day.skeletalMuscle ?? null,
      calories: totalKcal > 0 ? netKcal : null,
      protein: totalProtein > 0 ? totalProtein : null,
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
    if (!day) continue;
    
    const dateStr = day.date;
    const dayMeals = meals.filter(m => m.date === dateStr);
    const dayExercises = exercises.filter(e => e.date === dateStr);

    const totalKcal = dayMeals.reduce((sum, m) => sum + (m.kcal || 0), 0);
    const burnedKcal = dayExercises.reduce((sum, e) => sum + (e.kcal || 0), 0);
    const netKcal = totalKcal - burnedKcal;
    const totalProtein = dayMeals.reduce((sum, m) => sum + (m.protein || 0), 0);

    data.push({
      date: targetDate.format('MM/DD'),
      fullDate: dateStr,
      weight: day.weight ?? null,
      bodyFat: day.bodyFat ?? null,
      skeletalMuscle: day.skeletalMuscle ?? null,
      calories: totalKcal > 0 ? netKcal : null,
      protein: totalProtein > 0 ? totalProtein : null,
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
    if (!day) continue;
    
    const dateStr = day.date;
    const dayMeals = meals.filter(m => m.date === dateStr);
    const dayExercises = exercises.filter(e => e.date === dateStr);

    const totalKcal = dayMeals.reduce((sum, m) => sum + (m.kcal || 0), 0);
    const burnedKcal = dayExercises.reduce((sum, e) => sum + (e.kcal || 0), 0);
    const netKcal = totalKcal - burnedKcal;
    const totalProtein = dayMeals.reduce((sum, m) => sum + (m.protein || 0), 0);

    data.push({
      date: targetMonth.format('M月'),
      fullDate: dateStr,
      weight: day.weight ?? null,
      bodyFat: day.bodyFat ?? null,
      skeletalMuscle: day.skeletalMuscle ?? null,
      calories: totalKcal > 0 ? netKcal : null,
      protein: totalProtein > 0 ? totalProtein : null,
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
    if (!day) continue;
    
    const dateStr = day.date;
    const dayMeals = meals.filter(m => m.date === dateStr);
    const dayExercises = exercises.filter(e => e.date === dateStr);

    const totalKcal = dayMeals.reduce((sum, m) => sum + (m.kcal || 0), 0);
    const burnedKcal = dayExercises.reduce((sum, e) => sum + (e.kcal || 0), 0);
    const netKcal = totalKcal - burnedKcal;
    const totalProtein = dayMeals.reduce((sum, m) => sum + (m.protein || 0), 0);

    data.push({
      date: targetMonth.format('M月'),
      fullDate: dateStr,
      weight: day.weight ?? null,
      bodyFat: day.bodyFat ?? null,
      skeletalMuscle: day.skeletalMuscle ?? null,
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
    {/* 新的標題區塊：包含圖片 Icon 與樣式 */}
    {/* 標題區塊：使用 Flexbox 強制並排 */}
<div style={{ 
  display: 'flex',          // 👈 關鍵：讓內容左右並排
  alignItems: 'center',     // 垂直置中對齊
  marginBottom: 16,         // 與下方內容保持距離
  paddingBottom: 12,        // 標題區塊內留白
  borderBottom: '1px solid #e9ecef' // 加一條淡淡的底線增加質感
}}>
  
  {/* 左側：SVG 圖示 (白色圓底 + 陰影) */}
  <div style={{
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: '#fff',
    display: 'flex',           // 讓 SVG 在圓圈內置中
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    marginRight: 12            // 👈 圖示與文字的間距
  }}>
    {/* 直接內嵌 SVG，保證不會 404 */}
    <svg 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="#5c9c84"         // 使用品牌 Mint 色
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <line x1="18" y1="20" x2="18" y2="10"></line>
      <line x1="12" y1="20" x2="12" y2="4"></line>
      <line x1="6" y1="20" x2="6" y2="14"></line>
    </svg>
  </div>

  {/* 右側：標題文字 */}
  <h1 style={{ 
    fontSize: 22, 
    margin: 0,                // 移除預設邊距，避免跑版
    color: '#333',
    fontWeight: 700
  }}>
    數據趨勢分析
  </h1>

</div>

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
<section className="card">
  {/* 時間範圍選擇：帶 Icon */}
  <div style={{ marginBottom: 16 }}>
    <h3 style={{ 
      fontSize: 15, 
      fontWeight: 600, 
      marginBottom: 8, 
      color: '#666',
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }}>
      <svg 
  width="20" 
  height="20" 
  viewBox="0 0 24 24" 
  fill="none" 
  stroke="#5c9c84"
  strokeWidth="2" 
  strokeLinecap="round" 
  strokeLinejoin="round"
>
  <circle cx="12" cy="12" r="10"></circle>
  <polyline points="12 6 12 12 16 14"></polyline>
</svg>
時間範圍
    </h3>
    <div
      style={{
        display: 'flex',
        gap: 8,
        background: '#f3f4f6',
        borderRadius: 999,
        padding: 4,
        overflow: 'hidden',
      }}
    >
      {[
        { value: '7d', label: '7天' },
        { value: '30d', label: '30天' },
        { value: '90d', label: '90天' },
        { value: '180d', label: '180天' },
        { value: '365d', label: '1年' },
      ].map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setPeriod(option.value as any)}
          style={{
            flex: 1,
            height: 36,
            padding: '0 8px',
            border: 'none',
            borderRadius: 999,
            background: period === option.value ? '#fff' : 'transparent',
            color: period === option.value ? 'var(--mint-dark, #5c9c84)' : '#6b7280',
            boxShadow: period === option.value ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
            fontWeight: period === option.value ? 800 : 700,
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'all 0.18s ease',
            whiteSpace: 'nowrap',
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  </div>

  {/* 指標選擇：移除標題 */}
  <div style={{ marginBottom: 0 }}>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {/* 身體組成按鈕（佔滿整行） */}
      <button
        onClick={() => setMetric('bodyComposition')}
        style={{
          padding: '12px',
          borderRadius: 8,
          border: metric === 'bodyComposition' ? '2px solid #5c9c84' : '1px solid var(--line)',
          background: metric === 'bodyComposition' ? 'linear-gradient(135deg, #f0f8f4 0%, #fffaf6 100%)' : '#fff',
          fontWeight: metric === 'bodyComposition' ? 700 : 400,
          cursor: 'pointer',
          gridColumn: '1 / -1',
          fontSize: 'var(--font-md)',
        }}
      >
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
    <img src={`${import.meta.env.BASE_URL}icons/analysis-icon.png`} alt="" style={{ width: 32, height: 32 }} />
    <span>身體組成</span>
  </div>
</button>
      
      {/* 其他指標按鈕 */}
      <button
        onClick={() => setMetric('weight')}
        style={{
          padding: '12px',
          borderRadius: 8,
          border: metric === 'weight' ? '2px solid #5c9c84' : '1px solid var(--line)',
          background: metric === 'weight' ? '#f0f8f4' : '#fff',
          fontWeight: metric === 'weight' ? 700 : 400,
          cursor: 'pointer',
          fontSize: 'var(--font-md)',
        }}
      >
        體重
      </button>
      <button
        onClick={() => setMetric('bodyFat')}
        style={{
          padding: '12px',
          borderRadius: 8,
          border: metric === 'bodyFat' ? '2px solid #e68a3a' : '1px solid var(--line)',
          background: metric === 'bodyFat' ? '#fffaf6' : '#fff',
          fontWeight: metric === 'bodyFat' ? 700 : 400,
          cursor: 'pointer',
          fontSize: 'var(--font-md)',
        }}
      >
        體脂率
      </button>
      <button
        onClick={() => setMetric('skeletalMuscle')}
        style={{
          padding: '12px',
          borderRadius: 8,
          border: metric === 'skeletalMuscle' ? '2px solid #10b981' : '1px solid var(--line)',
          background: metric === 'skeletalMuscle' ? '#f0fdf4' : '#fff',
          fontWeight: metric === 'skeletalMuscle' ? 700 : 400,
          cursor: 'pointer',
          fontSize: 'var(--font-md)',
        }}
      >
        骨骼肌率
      </button>
      <button
        onClick={() => setMetric('calories')}
        style={{
          padding: '12px',
          borderRadius: 8,
          border: metric === 'calories' ? '2px solid #4a90e2' : '1px solid var(--line)',
          background: metric === 'calories' ? '#f6fbff' : '#fff',
          fontWeight: metric === 'calories' ? 700 : 400,
          cursor: 'pointer',
          fontSize: 'var(--font-md)',
        }}
      >
        淨熱量
      </button>
      <button
        onClick={() => setMetric('protein')}
        style={{
          padding: '12px',
          borderRadius: 8,
          border: metric === 'protein' ? '2px solid #d64545' : '1px solid var(--line)',
          background: metric === 'protein' ? '#fff6f6' : '#fff',
          fontWeight: metric === 'protein' ? 700 : 400,
          cursor: 'pointer',
          fontSize: 'var(--font-md)',
        }}
      >
        蛋白質
      </button>
    </div>
  </div>
</section>

        {/* 趨勢圖 */}
        <section className="card">
          <h2 style={{ marginBottom: 16 }}>{config.label}趨勢</h2>
          
          {/* 🆕 優化：外層加入橫向捲動容器，避免 X 軸過擠 */}
          <div style={{ width: '100%', overflowX: 'auto', paddingBottom: 10 }}>
            {/* 設定 minWidth，資料多時自動變寬讓使用者滑動 */}
            <div style={{ 
  minWidth: (period === '90d' || period === '180d' || period === '365d') ? 600 : '100%', 
  height: 300,
  minHeight: 300
}}>
              
              {/* 🆕 身體組成合併圖表（雙 Y 軸） */}
              {metric === 'bodyComposition' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis 
                      dataKey="date" 
                      style={{ fontSize: 15 }}
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
                      style={{ fontSize: 15 }}
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
            {(period === '90d' || period === '180d' || period === '365d') && (
  <div style={{ textAlign: 'center', fontSize: 15, color: '#999', marginTop: 4 }}>
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
    
    {/* 🆕 數字鍵盤動畫 - 由下往上滑入 */}
    <style>{`
  /* 由下往上滑入 */
  @keyframes slideIn {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }
  
  @keyframes slideInFromRight {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }
  
  @keyframes slideInUp {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }
  
  /* 滑出動畫（如果需要） */
  @keyframes slideOut {
    from {
      transform: translateY(0);
    }
    to {
      transform: translateY(100%);
    }
  }
  
  .modal-backdrop > div {
    animation: slideInFromRight 0.3s ease-out;
    border-radius: 24px 24px 0 0;
  }
`}</style>
    
    <div className="app">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {tab === 'today' && (
        <TodayPage onAddExercise={goToExerciseRecord} />
      )}

      {/* 👇 [修改] 傳入完整的資料 Props */}
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
          // 👇 補上這些資料傳遞
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
          <span>發現新版本！點擊更新以取得最新功能。</span>
          <button
            type="button"
            onClick={handleReloadForUpdate}
            style={{
              borderRadius: 999,
              border: 'none',
              padding: '6px 10px',
              fontSize: 15,
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