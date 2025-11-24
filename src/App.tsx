import React, { useEffect, useMemo, useState, useRef } from 'react';
import Papa from 'papaparse';
import dayjs from 'dayjs';

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
  waterMl: number;
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
  exerciseMinutesGoal?: number;
  startDate?: string;
  targetDate?: string;
};

type Tab = 'today' | 'records' | 'settings' | 'plan' | 'about';
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


// ======== 常數 & 工具 ========
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
  TYPE_TABLE: '/ju-smile-app/data/Type_Table.csv',
  UNIT_MAP: '/ju-smile-app/data/Unit_Map.csv',
  FOOD_DB: '/ju-smile-app/data/Food_DB.csv',
  EXERCISE_MET: '/ju-smile-app/data/Exercise_Met.csv',
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

async function fetchCsv<T = any>(url: string): Promise<T[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`無法下載: ${url}`);
  const text = await res.text();
  const parsed = Papa.parse<T>(text, {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length) {
    console.warn('CSV parse errors', parsed.errors);
  }
  return parsed.data;
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




// ======== App 主元件 ========

const App: React.FC = () => {
  const [tab, setTab] = useState<Tab>('today');
  const [showUpdateBar, setShowUpdateBar] = useState(false);

  const [recordDefaultMealType, setRecordDefaultMealType] =
    useState<'早餐' | '午餐' | '晚餐' | '點心'>('早餐');

  const [recordTab, setRecordTab] = useState<RecordSubTab>('food');

  const [settings, setSettings] = useState<Settings>(() =>
    loadJSON<Settings>(STORAGE_KEYS.SETTINGS, {})
  );

    // 🔔 監聽 Service Worker 是否有安裝新版本
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .getRegistration()
      .then((reg) => {
        if (!reg) return;

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            // 有舊 SW 在控制頁面，且新 SW 安裝完成 → 有「新版本」
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              setShowUpdateBar(true);
            }
          });
        });
      })
      .catch(() => {
        // 忽略錯誤
      });
  }, []);

    function handleReloadForUpdate() {
    // 告訴 SW：可以跳過 waiting，直接啟用新版本
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    }
    // 重新載入頁面，載入最新版
    window.location.reload();
  }

  // 監聽 Plan 頁送來的目標熱量，立即更新「我的」頁的 目標攝取熱量(kcal)
  useEffect(() => {
    function onSetGoal(ev: any) {
      const kcal = Number(ev?.detail);
      if (!isNaN(kcal) && kcal > 0) {
        setSettings((s) => ({ ...s, calorieGoal: kcal }));
      }
    }
    document.addEventListener('ju:set-goal-kcal', onSetGoal as any);
    return () => document.removeEventListener('ju:set-goal-kcal', onSetGoal as any);
  }, []);

  const [days, setDays] = useState<DaySummary[]>(() =>
    loadJSON<DaySummary[]>(STORAGE_KEYS.DAYS, [])
  );

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

  const [srcType, setSrcType] = useState<string>(
    () => localStorage.getItem('JU_SRC_TYPE') || CSV_DEFAULT_URLS.TYPE_TABLE
  );
  const [srcUnit, setSrcUnit] = useState<string>(
    () => localStorage.getItem('JU_SRC_UNIT') || CSV_DEFAULT_URLS.UNIT_MAP
  );
  const [srcFood, setSrcFood] = useState<string>(
    () => localStorage.getItem('JU_SRC_FOOD') || CSV_DEFAULT_URLS.FOOD_DB
  );
  const [srcMet, setSrcMet] = useState<string>(
    () => localStorage.getItem('JU_SRC_MET') || CSV_DEFAULT_URLS.EXERCISE_MET
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
      day = { date, waterMl: 0 };
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
    } catch (err: any) {
      console.error(err);
      setCsvError('同步 CSV 發生錯誤，請檢查 URL 或稍後再試。');
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

  const MealCard: React.FC<{
    title: '早餐' | '午餐' | '晚餐' | '點心';
    kcal: number;
    protein: number;
    carb: number;
    fat: number;
    onAdd: () => void;
  }> = ({ title, kcal, protein, carb, fat, onAdd }) => {
    return (
      <div className="meal-card">
        <div className="meal-header">
          <div className="meal-title">{title}</div>
          <div className="meal-kcal">{kcal} kcal</div>
        </div>
        <div className="meal-macros">
          蛋白質 {round1(protein)} g · 碳水 {round1(carb)} g · 脂肪{' '}
          {round1(fat)} g
        </div>

        <div className="meal-actions">
          <button onClick={onAdd}>新增</button>
        </div>
      </div>
    );
  };

  // ======== 首頁 ========

  type TodayPageProps = {
    onAddExercise: () => void;
  };

  const TodayPage: React.FC<TodayPageProps> = ({ onAddExercise }) => {
    const todaySummary = getDay(todayLocal);

    const [wInput, setWInput] = useState<string>('');
    const [bfInput, setBfInput] = useState<string>('');
    const [vfInput, setVfInput] = useState<string>('');
    const [waterInput, setWaterInput] = useState<string>('');
    const [showBodyModal, setShowBodyModal] = useState(false);

    useEffect(() => {
      setWInput(
        todaySummary.weight != null ? String(todaySummary.weight) : ''
      );
      setBfInput(
        todaySummary.bodyFat != null ? String(todaySummary.bodyFat) : ''
      );
      setVfInput(
        todaySummary.visceralFat != null
          ? String(todaySummary.visceralFat)
          : ''
      );
    }, [todaySummary.weight, todaySummary.bodyFat, todaySummary.visceralFat]);
    // 取得依日期排序過的紀錄
    const sortedDays = [...days].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    const firstWeightDay = sortedDays.find((d) => d.weight != null);
    const firstBodyFatDay = sortedDays.find((d) => d.bodyFat != null);
    const firstVisceralFatDay = sortedDays.find(
      (d) => d.visceralFat != null
    );

    // 以減重起始日期作為「起始值」，若沒有就用最早有紀錄的一天，再不行才用今日數值
    const startDay = settings.startDate
      ? days.find((d) => d.date === settings.startDate)
      : undefined;

    const startWeight =
      startDay?.weight ??
      firstWeightDay?.weight ??
      todaySummary.weight;

    const startBodyFat =
      startDay?.bodyFat ??
      firstBodyFatDay?.bodyFat ??
      todaySummary.bodyFat;

    const startVisceralFat =
      startDay?.visceralFat ??
      firstVisceralFatDay?.visceralFat ??
      todaySummary.visceralFat;

    const todayMeals = meals.filter((m) => m.date === todayLocal);
    const todayExercises = exercises.filter((e) => e.date === todayLocal);

    const todayIntake = todayMeals.reduce((s, m) => s + (m.kcal || 0), 0);
    const todayBurn = todayExercises.reduce(
      (s, e) => s + (e.kcal || 0),
      0
    );
    const calorieGoal =
      settings.calorieGoal != null ? settings.calorieGoal : undefined;

    // 先算出今天的「淨熱量」= 攝取 - 消耗
    const netKcal = todayIntake - todayBurn;

    // 要顯示在畫面上的數字
    let netDisplayValue = 0;
    let netStatusLabel = '';
    let netColor = '#444';

    // 有設定目標時：用「淨熱量 - 目標」判斷
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
      // 沒設定目標時，就退回舊邏輯：和 0 比較
      netDisplayValue = Math.abs(Math.round(netKcal));
      const isDeficit = netKcal < 0;
      netStatusLabel = isDeficit ? '赤字(相對運動)' : '盈餘';
      netColor = isDeficit ? '#3b8c5a' : '#d64545';
    }

    const todayExerciseMinutes = todayExercises.reduce(
      (s, e) => s + (e.minutes || 0),
      0
    );

    const breakfastKcal = todayMeals
      .filter((m) => m.mealType === '早餐')
      .reduce((s, m) => s + m.kcal, 0);
    const lunchKcal = todayMeals
      .filter((m) => m.mealType === '午餐')
      .reduce((s, m) => s + m.kcal, 0);
    const dinnerKcal = todayMeals
      .filter((m) => m.mealType === '晚餐')
      .reduce((s, m) => s + m.kcal, 0);
    const snackKcal = todayMeals
      .filter((m) => m.mealType === '點心')
      .reduce((s, m) => s + m.kcal, 0);

    const breakfastProt = todayMeals
      .filter((m) => m.mealType === '早餐')
      .reduce((s, m) => s + (m.protein ?? 0), 0);
    const breakfastCarb = todayMeals
      .filter((m) => m.mealType === '早餐')
      .reduce((s, m) => s + (m.carb ?? 0), 0);
    const breakfastFat = todayMeals
      .filter((m) => m.mealType === '早餐')
      .reduce((s, m) => s + (m.fat ?? 0), 0);

    const lunchProt = todayMeals
      .filter((m) => m.mealType === '午餐')
      .reduce((s, m) => s + (m.protein ?? 0), 0);
    const lunchCarb = todayMeals
      .filter((m) => m.mealType === '午餐')
      .reduce((s, m) => s + (m.carb ?? 0), 0);
    const lunchFat = todayMeals
      .filter((m) => m.mealType === '午餐')
      .reduce((s, m) => s + (m.fat ?? 0), 0);

    const dinnerProt = todayMeals
      .filter((m) => m.mealType === '晚餐')
      .reduce((s, m) => s + (m.protein ?? 0), 0);
    const dinnerCarb = todayMeals
      .filter((m) => m.mealType === '晚餐')
      .reduce((s, m) => s + (m.carb ?? 0), 0);
    const dinnerFat = todayMeals
      .filter((m) => m.mealType === '晚餐')
      .reduce((s, m) => s + (m.fat ?? 0), 0);

    const snackProt = todayMeals
      .filter((m) => m.mealType === '點心')
      .reduce((s, m) => s + (m.protein ?? 0), 0);
    const snackCarb = todayMeals
      .filter((m) => m.mealType === '點心')
      .reduce((s, m) => s + (m.carb ?? 0), 0);
    const snackFat = todayMeals
      .filter((m) => m.mealType === '點心')
      .reduce((s, m) => s + (m.fat ?? 0), 0);

    const todayProtein = todayMeals.reduce(
      (s, m) => s + (m.protein ?? 0),
      0
    );

    function saveBody() {
      updateDay(todayLocal, {
        weight: wInput ? Number(wInput) : undefined,
        bodyFat: bfInput ? Number(bfInput) : undefined,
        visceralFat: vfInput ? Number(vfInput) : undefined,
      });
      alert('已儲存今日身體紀錄');
    }

    function addWaterManual() {
      if (!waterInput.trim()) return;
      const value = Number(waterInput);
      if (isNaN(value) || value <= 0) {
        alert('請輸入大於 0 的數字');
        return;
      }
      addWater(value);
      setWaterInput('');
    }

    return (
      <div
        className="page page-today"
        style={{ paddingBottom: '90px' }}
      >
        <header className="top-bar">
          <button
            onClick={() =>
              setTodayLocal(
                dayjs(todayLocal)
                  .subtract(1, 'day')
                  .format('YYYY-MM-DD')
              )
            }
          >
            ◀
          </button>
          <div className="date-text">
            {todayLocal}{' '}
            {todayLocal === dayjs().format('YYYY-MM-DD') && '(今天)'}
          </div>
          <button
            onClick={() =>
              setTodayLocal(
                dayjs(todayLocal)
                  .add(1, 'day')
                  .format('YYYY-MM-DD')
              )
            }
          >
            ▶
          </button>
        </header>

        <section className="card">
          <h2>今日概況</h2>

          {/* 上層：大大的淨熱量＋狀態 */}
          <div
            className="net-block"
            style={{ marginBottom: 12, textAlign: 'center' }}
          >
            <div
              className="label"
              style={{ fontSize: 13, color: '#666', marginBottom: 4 }}
            >
              熱量目標差距
            </div>
            <div
              className="value"
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: netColor,
                marginBottom: 4,
              }}
            >
              {netDisplayValue} kcal {netStatusLabel}
            </div>

          </div>

          {/* 下層：三個小欄位（攝取 / 消耗 / 目標攝取） */}
          <div className="summary-row">
            <div>
              <div className="label">🍽️ 攝取</div>
              <div
                className="value"
                style={{ color: '#444', fontWeight: 600 }}
              >
                {todayIntake} kcal
              </div>
            </div>
            <div>
              <div className="label">🔥 消耗</div>
              <div
                className="value"
                style={{ color: '#e68a3a', fontWeight: 600 }}
              >
                {todayBurn} kcal
              </div>
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
          <div
            className="rings-row"
            style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'space-between',
              alignItems: 'stretch',
            }}
          >
            <MacroRing
              label="蛋白質"
              current={todayProtein}
              target={settings.proteinGoal}
              unit="g"
            />
            <MacroRing
              label="飲水"
              current={todaySummary.waterMl}
              target={settings.waterGoalMl}
              unit="ml"
            />
            <MacroRing
              label="運動"
              current={todayExerciseMinutes}
              target={settings.exerciseMinutesGoal}
              unit="min"
            />
          </div>
        </section>

        {/* 🔵 身體指標進度（放在今日飲水上方） */}
        <section className="card rings-card">
          <h2>身體指標進度</h2>
          <div
            className="rings-row"
            style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'space-between',
              alignItems: 'stretch',
            }}
          >
            <BodyRing
              label="體重"
              start={startWeight}
              current={todaySummary.weight}
              target={settings.targetWeight}
              unit="kg"
              onClick={() => setShowBodyModal(true)}
            />
            <BodyRing
              label="體脂率"
              start={startBodyFat}
              current={todaySummary.bodyFat}
              target={settings.bodyFatGoal}
              unit="%"
              onClick={() => setShowBodyModal(true)}
            />
            <BodyRing
              label="內臟脂肪"
              start={startVisceralFat}
              current={todaySummary.visceralFat}
              target={settings.visceralFatGoal}
              unit=""
              onClick={() => setShowBodyModal(true)}
            />
          </div>
          <div className="hint">點擊圓環可快速編輯今日身體紀錄</div>
        </section>

        <section className="card">
          <h2>今日飲水</h2>
          <div className="water-row">
          </div>
          <div className="btn-row">
            <button onClick={() => addWater(500)}>+500 ml</button>
            <button onClick={() => addWater(1000)}>+1000 ml</button>
            <button onClick={() => addWater(2000)}>+2000 ml</button>
          </div>
          <div className="form-section">
            <label>
              自訂增加 (ml)
              <input
                type="number"
                value={waterInput}
                onChange={(e) =>
                  setWaterInput(e.target.value)
                }
                placeholder="例如:300"
              />
            </label>
            <button className="primary" onClick={addWaterManual}>
              加入今日飲水
            </button>
          </div>
        </section>

        <section className="card meals-card">
          <MealCard
            title="早餐"
            kcal={breakfastKcal}
            protein={breakfastProt}
            carb={breakfastCarb}
            fat={breakfastFat}
            onAdd={() => {
              setRecordDefaultMealType('早餐');
              setTab('records');
              setRecordTab('food');
              // 🆕 增加滾動到頂部
            setTimeout(() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }, 0);
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
              setTab('records');
              setRecordTab('food');
              // 🆕 增加滾動到頂部
            setTimeout(() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }, 0);
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
              setTab('records');
              setRecordTab('food');
              // 🆕 增加滾動到頂部
            setTimeout(() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }, 0);
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
              setTab('records');
              setRecordTab('food');
              // 🆕 增加滾動到頂部
            setTimeout(() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }, 0);
            }}
          />
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
                    {e.minutes != null
                      ? `${e.minutes} 分鐘 · `
                      : ''}
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
              <input
                type="number"
                value={wInput}
                onChange={(e) => setWInput(e.target.value)}
                placeholder="例如:70"
              />
            </label>
            <label>
              體脂率 (%)
              <input
                type="number"
                value={bfInput}
                onChange={(e) => setBfInput(e.target.value)}
                placeholder="例如:30"
              />
            </label>
            <label>
              內臟脂肪指數
              <input
                type="number"
                value={vfInput}
                onChange={(e) => setVfInput(e.target.value)}
                placeholder="例如:8"
              />
            </label>
            <button className="primary" onClick={saveBody}>
              儲存今日身體紀錄
            </button>
          </div>
        </section>

        {/* 編輯今日身體紀錄彈窗 */}
        {showBodyModal && (
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
              <h3 style={{ marginTop: 0 }}>編輯今日身體紀錄</h3>
              <div className="form-section">
                <label>
                  體重 (kg)
                  <input
                    type="number"
                    value={wInput}
                    onChange={(e) => setWInput(e.target.value)}
                    placeholder="例如:70"
                  />
                </label>
                <label>
                  體脂率 (%)
                  <input
                    type="number"
                    value={bfInput}
                    onChange={(e) => setBfInput(e.target.value)}
                    placeholder="例如:30"
                  />
                </label>
                <label>
                  內臟脂肪指數
                  <input
                    type="number"
                    value={vfInput}
                    onChange={(e) => setVfInput(e.target.value)}
                    placeholder="例如:8"
                  />
                </label>
              </div>
              <div className="btn-row">
                <button
                  className="primary"
                  onClick={() => {
                    saveBody();
                    setShowBodyModal(false);
                  }}
                >
                  儲存
                </button>
                <button onClick={() => setShowBodyModal(false)}>
                  取消
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ======== 記錄頁 ========

  const RecordsPage: React.FC<{
    recordTab: RecordSubTab;
    setRecordTab: (tab: RecordSubTab) => void;
    defaultMealType: '早餐' | '午餐' | '晚餐' | '點心';
  }> = ({ recordTab, setRecordTab, defaultMealType }) => {

    const [selectedDate, setSelectedDate] = useState(todayLocal);

    // 飲食表單
    const [foodMealType, setFoodMealType] =
      useState<'早餐' | '午餐' | '晚餐' | '點心'>('早餐');
    useEffect(() => {
      setFoodMealType(defaultMealType);
    }, [defaultMealType]);

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

    // C2：其他類 - 每份 P/C/F
    const [fallbackProtPerServ, setFallbackProtPerServ] = useState('');
    const [fallbackCarbPerServ, setFallbackCarbPerServ] = useState('');
    const [fallbackFatPerServ, setFallbackFatPerServ] = useState('');

    // C3：自定義熱量 - 每份 kcal
    const [fallbackKcalPerServ, setFallbackKcalPerServ] = useState('');

    const [manualFoodKcal, setManualFoodKcal] = useState(''); // 給你保留舊有「直接輸入總熱量」備用

    const [editingMealId, setEditingMealId] = useState<string | null>(null);
    
    // 🆕 常用組合相關狀態
    const [selectedMealIds, setSelectedMealIds] = useState<string[]>([]);
    const [comboNameInput, setComboNameInput] = useState('');
    const [showSaveComboModal, setShowSaveComboModal] = useState(false);


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

    // 🚴‍♀️ 常見運動快速選擇（由低 MET 排到高）
    const COMMON_EXERCISES = [
      { name: '走路', met: 3.0 },
      { name: '有氧運動', met: 4.5 },
      { name: '騎自行車', met: 5.5 },
      { name: '重訓', met: 6.0 },
      { name: '爬山', met: 6.5 },
      { name: '游泳', met: 7.0 },
    ];

    // 運動體重預帶當日體重
    useEffect(() => {
      if (exWeight) return;
      const day = days.find((d) => d.date === selectedDate);
      if (day && day.weight != null) {
        setExWeight(String(day.weight));
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
      
      // 🆕 常用組合搜尋
      const comboMatches = combos.filter(c =>
        normalizeText(c.name).includes(kw)
      );

      // 如果沒有關鍵字，則顯示全部常用組合，但不顯示 food/unit 搜尋結果
      if (!kw) {
        return {
          unitMatches: [] as UnitMapRow[],
          foodMatches: [] as FoodDbRow[],
          comboMatches: combos, 
        };
      }
      
      const unitMatches = unitMap.filter((u) =>
        normalizeText(u.Food).includes(kw)
      );
      const foodMatches = foodDb.filter((f) =>
        normalizeText(f.food).includes(kw)
      );

      // 如果有關鍵字，則顯示搜尋到的常用組合、unitMatches、foodMatches
      return { unitMatches, foodMatches, comboMatches };
    }, [foodName, unitMap, foodDb, combos]);
    
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
        alert('請先輸入食物名稱');
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
          alert('請先輸入正確的份量 / 克數 / 份量,才能計算熱量。');
          return;
        }
        kcal = autoFoodInfo.kcal;
        protein = autoFoodInfo.protein;
        carb = autoFoodInfo.carb;
        fat = autoFoodInfo.fat;
        amountText = autoFoodInfo.amountText;
      } else {
        if (!manualFoodKcal.trim()) {
          alert('請先輸入估算總熱量(kcal)。');
          return;
        }
        kcal = Number(manualFoodKcal);
        if (!kcal || isNaN(kcal)) {
          alert('請輸入正確的熱量數字。');
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
        alert('請先選擇至少一個飲食紀錄品項');
        return;
      }
      if (!comboNameInput.trim()) {
        alert('請為常用組合命名');
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
      alert(`已成功儲存常用組合: ${newCombo.name}`);
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
      alert(`已將組合「${combo.name}」加入 ${foodMealType}。`);
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
        alert('請先輸入運動名稱');
        return;
      }
      if (!usedMet) {
        alert('請先選擇一項運動或輸入自訂 MET。');
        return;
      }
      if (!autoExerciseKcal) {
        alert('請先填寫體重與時間(分鐘),才能計算熱量。');
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
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
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
            <details open>
              <summary>如何記錄飲食?</summary>
              <p>
                「Ju Smile App」提供多種快速記錄方式：
                <br />
                1. **常用組合**：在搜尋框下方點擊
                <span 
                  style={{
                    display: 'inline-block',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: 'var(--mint-dark, #5c9c84)', /* 使用品牌綠色 */
                    color: '#fff',
                    textAlign: 'center',
                    lineHeight: '16px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    margin: '0 4px',
                    verticalAlign: 'middle',
                  }}
                >
                  +
                </span>
                鈕**一鍵加入**。
                <br />
                2. **快速搜尋**：輸入食物名稱，點選結果並填入份量/克數。
                <br />
                3. **類別估算**：若無資料，可切換至「類別/估算模式」。
                <br />
                &nbsp;&nbsp;&nbsp;&nbsp;🔹 **App 精選食物類型**：選擇**食物類型** (例如：**豆魚蛋肉類(低脂)**、**全榖雜糧類**) 後，依**份數**快速估算。
                <br />
                &nbsp;&nbsp;&nbsp;&nbsp;🔹 **其他類**：手動輸入**每份**的蛋白質/碳水/脂肪 (P/C/F) 數值。
                <br />
                &nbsp;&nbsp;&nbsp;&nbsp;🔹 **自定義熱量**：若懶得估算P/C/F，可直接輸入「份量」及「每份熱量」。
                <br />
                <br />
                🔥 **祕訣：** 點選已記錄的品項，可選取多項儲存為「常用組合」。
              </p> 
              {/* 🛑 修正：將 hr 移到 <p> 之外，避免 DOM 嵌套錯誤 */}
              <div style={{ marginTop: '8px' }}> 
                <hr style={{ margin: '0', border: 'none', borderTop: '1px solid #e9ecef' }} />
                <p style={{ marginTop: '8px', fontSize: '13px', color: '#666' }}> 
                  💡 **資料說明：** App 中的食物數據庫 (精選食物類型、份量代換、Food DB) 是由 Ju Smile 團隊**精選整合**，提供您快速、可靠的熱量與營養素參考。
                </p>
              </div>
            </details>

            {/* ✅ 常見食物重量參考 */}
            <details style={{ marginTop: 8 }}>
              <summary>常見食物重量參考</summary>
              <ul className="met-list">
                <li>一碗飯 ≈ 200 g</li>
                <li>一個拳頭大小的水果 ≈ 150–200 g</li>
                <li>一片吐司 ≈ 30–40 g</li>
                <li>一顆雞蛋 ≈ 50–60 g</li>
                <li>一湯匙油 ≈ 15 g</li>
              </ul>
            </details>

            <div className="form-section">
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
                />
              </label>

              {/* 🆕 常用組合清單 (根據搜尋結果顯示，且收納在 details 內) */}
              {/* 修正：合併條件渲染，避免結構錯誤 */}
              {/* 🆕 常用組合清單 (根據搜尋結果顯示，且收納在 details 內) */}
          {/* 修正：優化常用組合列表的顯示，增加明細展開 */}
          {(foodName.trim() === '' && combos.length > 0) ? (
            <details open style={{ marginBottom: '12px' }}>
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
                (foodSearchResults.unitMatches.length > 0 || foodSearchResults.foodMatches.length > 0) && (
                  <div className="search-results" style={{ marginBottom: '12px' }}>
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
    { value: '其他類', value: '其他類', label: '其他類 (自訂 P/C/F)' },
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
                              value={fallbackServings}
                              onChange={(e) => setFallbackServings(e.target.value)}
                              placeholder="例如:1 或 1.5"
                            />
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
                            placeholder="例如:1"
                          />
                        </label>

                        <label>
  參考數量 (選填)
  <div
    className="inline-inputs"
    style={{ display: 'flex', gap: '10px', alignItems: 'center' }}
  >
    {/* 左邊：數量欄位放大 */}
    <input
      type="number"
      value={fallbackQty}
      onChange={(e) => setFallbackQty(e.target.value)}
      placeholder="例如:2"
      style={{ flex: '1 1 0', width: '100%' }}   // 這行讓數量欄位吃掉剩餘空間
    />

    {/* 右邊：單位下拉固定寬度較小 */}
    <div style={{ flex: '0 0 120px' }}>       {/* 單位欄位大約 120px 寬 */}
      <BigSelect
        options={[
          { value: '個', label: '個' },
          { value: '杯', label: '杯' },
          { value: '碗', label: '碗' },
          { value: '盤', label: '盤' },
          { value: '片', label: '片' },
          { value: '瓶', label: '瓶' },        // ✅ 新增
          { value: '包', label: '包' },        // ✅ 新增
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


              {selectedUnitFood && (
                <>
                  <label>
                    數量({selectedUnitFood.Unit})
                    <input
                      type="number"
                      value={unitQuantity}
                      onChange={(e) =>
                        setUnitQuantity(e.target.value)
                      }
                      placeholder="例如:1"
                    />
                  </label>
                  <div className="hint">
                    目前估算熱量:約 {autoFoodInfo.kcal || 0} kcal
                  </div>
                  {selectedUnitFood.Notes && (
                    <div className="hint">
                      備註：{selectedUnitFood.Notes}
                    </div>
                  )}
                </>
              )}

              {selectedFoodDbRow && (
                <>
                  <label>
                    食用重量 (g)
                    <input
                      type="number"
                      value={foodAmountG}
                      onChange={(e) =>
                        setFoodAmountG(e.target.value)
                      }
                      placeholder="例如:80"
                    />
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
                        {m.amountText ? ` · ${m.amountText}` : ''}
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

            <div className="form-section">
              <label>
                運動名稱
                <input
                  id="exercise-name-input"
                  value={exName}
                  onChange={(e) => {
                    setExName(e.target.value);
                    setSelectedMetRow(null);
                  }}
                  placeholder="輸入關鍵字,例如:快走、重訓…"
                />
              </label>

              {/* ✅ 常見運動快速選擇 */}
              <div className="chips-row">
                {COMMON_EXERCISES.map((ex) => (
                  <button
                    key={ex.name}
                    className="chip"
                    type="button"
                    onClick={() => {
                      setExName(ex.name);
                      setCustomMet(String(ex.met));
                      setSelectedMetRow(null);
                    }}
                  >
                    {ex.name}（{ex.met} MET）
                  </button>
                ))}
              </div>

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
                      {exerciseMatches.map((row, i) => (
                        <div
                          key={i}
                          className="list-item clickable"
                          onClick={() => {
                            setSelectedMetRow(row);
                            setCustomMet(String(row.MET ?? ''));  // ← 自動把該活動的 MET 填到輸入框
                            // ✅ 選擇後把資料表中的活動名稱帶回輸入框，覆蓋原本關鍵字
                            setExName(row.活動 || '');
                          }}
                        >
                          <div>
                            <div>{row.活動}</div>
                            <div className="sub">
                              強度:{row.intensity} · MET:{row.MET}
                            </div>
                          </div>
                          <span className="tag">
                            {selectedMetRow === row ? '已選' : '選擇'}
                          </span>
                        </div>
                      ))}
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
                  }}
                >
                  取消編輯
                </button>
              )}

            </div>

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
        {/* 🆕 浮動常用組合動作列 (當有選取項目時才顯示) -- 請將以下代碼塊貼到這裡 */}
        {selectedMealIds.length > 0 && (
          <div className="fixed-combo-bar">
            <div className="combo-summary">
              已選取 <b>{selectedMealIds.length}</b> 個品項
            </div>
            <div className="btn-row">
              <button
                className="secondary"
                onClick={() => setSelectedMealIds([])}
                style={{ padding: '8px 16px' }}
              >
                取消選取
              </button>
              <button
                className="primary"
                onClick={() => setShowSaveComboModal(true)}
                style={{ padding: '8px 16px' }}
              >
                存為組合
              </button>
            </div>
          </div>
        )}
        {/* 浮動動作列代碼塊貼到這裡結束 */}
      </div>
    );
  };

  // ======== 我的頁 ========

type SettingsPageProps = {
  onOpenAbout: () => void;
};

const SettingsPage: React.FC<SettingsPageProps> = ({ onOpenAbout }) => {
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
    alert('已儲存目標設定');
  }

  // 🆕 儲存常用組合的編輯（包含明細）
  function saveComboEdit() {
    if (!editingCombo || !editingComboName.trim()) return;

    if (editingComboItems.length === 0) {
      alert('組合中必須至少包含一項食物明細。');
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

    alert(`組合「${oldName}」已更新並更名為「${newName}」`);
  }

  // 🆕 刪除常用組合
  function deleteCombo(id: string) {
    if (window.confirm('確定要刪除這個常用組合嗎？')) {
      setCombos((prev) => prev.filter((c) => c.id !== id));
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
        alert('匯入完成');
      } catch {
        alert('匯入失敗:JSON 格式不正確');
      }
    };
    reader.readAsText(file);
  }

  function handleBackupToDrive() {
    handleExportJson();
    try {
      window.open('https://drive.google.com/drive/my-drive', '_blank');
    } catch {
      // ignore popup block
    }
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
                  alert(`已加入目標熱量：${selectedGoal} kcal`);
                } catch { }
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
  // ======== App Root Render ========

  return (
    <div className="app">
      {tab === 'today' && (
        <TodayPage onAddExercise={goToExerciseRecord} />
      )}

      {tab === 'records' && (
        <RecordsPage
          recordTab={recordTab}
          setRecordTab={setRecordTab}
          defaultMealType={recordDefaultMealType}
        />
      )}

      {tab === 'settings' && (
  <SettingsPage
    onOpenAbout={() => setTab('about')}
    />
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
  );
};

export default App;