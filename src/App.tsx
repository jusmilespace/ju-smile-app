import React, { useEffect, useMemo, useState, useRef } from 'react';
import Papa from 'papaparse';
import dayjs from 'dayjs';
import BmrCalculator from './BmrCalculator';

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

type Tab = 'today' | 'records' | 'settings' | 'plan';
type RecordSubTab = 'food' | 'exercise';

// ======== 常數 & 工具 ========
// 可客製字體大小的下拉，且互斥展開（選了值/打開時會關閉其他）
type BigOption = { value: string; label: string };
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

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  useEffect(() => {
    function onAnyOpen(ev: Event) {
      const detail = (ev as CustomEvent<any>).detail;
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
          document.dispatchEvent(
            new CustomEvent('bigselect:open', { detail: idRef.current })
          );
          setOpen((o) => !o);
        }}
        style={{
          width: '100%',
          fontSize: 20,
          padding: '10px 12px',
          borderRadius: 10,
          border: '1px solid #ddd',
          background: '#fff',
          textAlign: 'left',
        }}
      >
        {current ? current.label : (placeholder ?? '請選擇')}
        <span style={{ float: 'right' }}>▾</span>
      </button>

      {open ? (
        <div
          style={{
            position: 'absolute',
            zIndex: 1000,
            top: '100%',
            left: 0,
            right: 0,
            background: '#fff',
            border: '1px solid #ddd',
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            maxHeight: 320,
            overflowY: 'auto',
            marginTop: 6,
          }}
        >
          {options.map((opt) => (
            <div
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                document.dispatchEvent(
                  new CustomEvent('bigselect:open', { detail: idRef.current })
                );
                setOpen(false);
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

// ======== App 主元件 ========

const App: React.FC = () => {
  const [tab, setTab] = useState<Tab>('today');
    const [recordDefaultMealType, setRecordDefaultMealType] =
    useState<'早餐' | '午餐' | '晚餐' | '點心'>('早餐');

  const [recordTab, setRecordTab] = useState<RecordSubTab>('food');

  const [settings, setSettings] = useState<Settings>(() =>
    loadJSON<Settings>(STORAGE_KEYS.SETTINGS, {})
  );

  const [days, setDays] = useState<DaySummary[]>(() =>
    loadJSON<DaySummary[]>(STORAGE_KEYS.DAYS, [])
  );

  const [meals, setMeals] = useState<MealEntry[]>(() =>
    loadJSON<MealEntry[]>(STORAGE_KEYS.MEALS, [])
  );

  const [exercises, setExercises] = useState<ExerciseEntry[]>(() =>
    loadJSON<ExerciseEntry[]>(STORAGE_KEYS.EXERCISES, [])
  );

  // 預帶「目標攝取熱量」：若尚未設定，使用 Plan 頁面選取的目標攝取
  useEffect(() => {
    if (settings.calorieGoal == null) {
      const planGoal = Number(localStorage.getItem('JU_PLAN_GOAL_KCAL') || '0') || 0;
      if (planGoal > 0) {
        setSettings((prev) => ({ ...prev, calorieGoal: planGoal }));
      }
    }
  }, []);

  const [todayLocal, setTodayLocal] = useState(
    dayjs().format('YYYY-MM-DD')
  );

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

  // 儲存 settings / days / meals / exercises
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


  // ======== 今天頁 ========

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
    // 目標攝取（優先用「我的」頁設定；否則帶 Plan 頁選的值）
const calorieGoal: number | undefined =
  settings.calorieGoal ??
  (Number(localStorage.getItem('JU_PLAN_GOAL_KCAL') || '0') || undefined);

// 讀取 Plan 頁面計算出的 BMR（沒有就視為 0）
const planBmr = Number(localStorage.getItem('JU_PLAN_BMR') || '0') || 0;

// 淨熱量 = 攝取 - 消耗 - BMR
const net = todayIntake - todayBurn - planBmr;

let netDisplayValue = Math.abs(Math.round(net));
let netStatusLabel = '';
let netColor = '#444';

if (net > 0) {
  netStatusLabel = '熱量超標';
  netColor = '#d64545';
} else if (net < 0) {
  netStatusLabel = '熱量赤字';
  netColor = '#3b8c5a';
} else {
  netStatusLabel = '熱量平衡';
  netColor = '#3b8c5a';
}

// 今日總運動時間

 
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
    style={{ marginBottom: 12, textAlign: 'center' }}  // 👈 多這個
  >
    <div
      className="label"
      style={{ fontSize: 13, color: '#666', marginBottom: 4 }}
    >
      淨熱量
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
    if (!foodName.trim()) {
      return {
        unitMatches: [] as UnitMapRow[],
        foodMatches: [] as FoodDbRow[],
      };
    }
    const kw = foodName.trim().toLowerCase();
    const unitMatches = unitMap.filter((u) =>
      normalizeText(u.Food).includes(kw)
    );
    const foodMatches = foodDb.filter((f) =>
      normalizeText(f.food).includes(kw)
    );
    return { unitMatches, foodMatches };
  }, [foodName, unitMap, foodDb]);
  const typeOptions = useMemo(
    () => Array.from(new Set(typeTable.map((t) => t.Type))),
    [typeTable]
  );

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
              1. 選日期與餐別,輸入食物名稱。
              <br />
              2. 若有顯示份量代換(Unit_Map),點選後輸入幾個/幾份。
              <br />
              3. 若顯示 100g 精準資料(Food_DB),點選後輸入克數。
              <br />
              4. 都沒有時,可手動估算熱量後按「加入/更新飲食記錄」。
            </p>
          </details>

          <div className="form-section">
            <label>
              餐別
              <select
  value={foodMealType}
  onChange={(e) =>
    setFoodMealType(e.target.value as any)
  }
  style={{ fontSize: 16 }}
>

                <option value="早餐">早餐</option>
                <option value="午餐">午餐</option>
                <option value="晚餐">晚餐</option>
                <option value="點心">點心</option>
              </select>
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
                placeholder="輸入關鍵字,例如:白飯、雞蛋…"
              />
            </label>

                        {/* 搜尋結果：選到食物後就收起來 */}
            {foodName.trim() &&
  !selectedUnitFood &&
  !selectedFoodDbRow && (
    <div className="search-results">
      {/* 沒找到任何資料時的提示 */}
      {foodSearchResults.unitMatches.length === 0 &&
        foodSearchResults.foodMatches.length === 0 && (
          <div className="hint">
            目前尚無此食物資料，可以改用下面的
            「類別估算 / 其他類 / 自定義熱量」來粗估。
          </div>
        )}

      {/* C：類別估算 / 其他類 / 自定義熱量：不管有沒有搜尋結果都可以用 */}
      <div className="type-fallback-card">
        <label>
          類別 / 估算模式
          <select
            value={fallbackType}
            onChange={(e) => {
              setFallbackType(e.target.value);
              setFallbackServings('');
              setFallbackQty('');
              setFallbackProtPerServ('');
              setFallbackCarbPerServ('');
              setFallbackFatPerServ('');
              setFallbackKcalPerServ('');
            }}
            style={{ fontSize: 16 }}  // 👈 順便放大字
          >
            <option value="">請選擇</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
            <option value="其他類">其他類</option>
            <option value="自定義熱量">自定義熱量</option>
          </select>
        </label>

        {/* C1：一般類型 */}
        {fallbackType &&
          fallbackType !== '其他類' &&
          fallbackType !== '自定義熱量' && (
            <>
              <div className="hint">
                從類別估算：{fallbackType}
              </div>
              <label>
                份量 (份)
                <input
                  type="number"
                  value={fallbackServings}
                  onChange={(e) =>
                    setFallbackServings(e.target.value)
                  }
                  placeholder="例如:1 或 1.5"
                />
              </label>
            </>
          )}

        {/* C2：其他類 */}
        {fallbackType === '其他類' && (
          <>
            <label>
              份量 (份)
              <input
                type="number"
                value={fallbackServings}
                onChange={(e) =>
                  setFallbackServings(e.target.value)
                }
                placeholder="例如:1"
              />
            </label>

            <label>
              參考數量 (選填)
              <div className="inline-inputs">
                <input
                  type="number"
                  value={fallbackQty}
                  onChange={(e) =>
                    setFallbackQty(e.target.value)
                  }
                  placeholder="例如:2"
                  style={{ flex: 1 }}
                />
                <select
                  value={fallbackUnitLabel}
                  onChange={(e) =>
                    setFallbackUnitLabel(e.target.value)
                  }
                  style={{ fontSize: 16 }}   // 👈 字體
                >
                  <option value="份">份</option>
                  <option value="個">個</option>
                  <option value="杯">杯</option>
                  <option value="碗">碗</option>
                  <option value="片">片</option>
                  <option value="湯匙">湯匙</option>
                  <option value="茶匙">茶匙</option>
                  <option value="根">根</option>
                  <option value="粒">粒</option>
                  <option value="張">張</option>
                  <option value="g">g</option>
                  <option value="米杯">米杯</option>
                  <option value="瓣">瓣</option>
                </select>
              </div>
            </label>

            <label>
              每份蛋白質 (g)
              <input
                type="number"
                value={fallbackProtPerServ}
                onChange={(e) =>
                  setFallbackProtPerServ(e.target.value)
                }
                placeholder="例如:7"
              />
            </label>
            <label>
              每份碳水 (g)
              <input
                type="number"
                value={fallbackCarbPerServ}
                onChange={(e) =>
                  setFallbackCarbPerServ(e.target.value)
                }
                placeholder="例如:10"
              />
            </label>
            <label>
              每份脂肪 (g)
              <input
                type="number"
                value={fallbackFatPerServ}
                onChange={(e) =>
                  setFallbackFatPerServ(e.target.value)
                }
                placeholder="例如:5"
              />
            </label>

            <div className="hint">
              系統會依 P×4 + C×4 + F×9
              自動估算每份與總熱量。
            </div>
          </>
        )}

        {/* C3：自定義熱量 */}
        {fallbackType === '自定義熱量' && (
          <>
            <label>
              份量 (份)
              <input
                type="number"
                value={fallbackServings}
                onChange={(e) =>
                  setFallbackServings(e.target.value)
                }
                placeholder="例如:1"
              />
            </label>
            <label>
              每份熱量 (kcal)
              <input
                type="number"
                value={fallbackKcalPerServ}
                onChange={(e) =>
                  setFallbackKcalPerServ(e.target.value)
                }
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
              }}
            >
              <div>
                <div>{u.Food}</div>
                <div className="sub">
                  單位:{u.Unit} · 每單位
                  {u.ServingsPerUnit} 份 · 類別:
                  {u.Type}
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

            {!selectedUnitFood &&
  !selectedFoodDbRow &&
  !fallbackType && (
    <label>
      估算總熱量 (kcal)
      <input
        type="number"
        value={manualFoodKcal}
        onChange={(e) =>
          setManualFoodKcal(e.target.value)
        }
        placeholder="例如:350"
      />
    </label>
  )}


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
            <h3>{selectedDate} 飲食明細</h3>
            {dayMeals.length === 0 && (
              <div className="hint">尚未記錄飲食</div>
            )}
            {dayMeals.map((m) => (
              <div key={m.id} className="list-item">
                <div>
                  <div>{m.label}</div>
                  <div className="sub">
                    {m.mealType}
                    {m.amountText ? ` · ${m.amountText}` : ''}
                    {' · '}
                    {m.kcal} kcal
                  </div>
                </div>
                <div className="btn-row">
                  <button onClick={() => startEditMeal(m)}>編輯</button>
                  <button
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
            ))}
          </div>
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
    </div>
  );
};


  // ======== 我的頁 ========

  const SettingsPage: React.FC = () => {
    const [localSettings, setLocalSettings] =
      useState<Settings>(settings);

    const fileInputRef = useRef<HTMLInputElement | null>(null);

    function saveSettings() {
      setSettings(localSettings);
      alert('已儲存目標設定');
    }

    function handleExportJson() {
      const data = {
        settings,
        days,
        meals,
        exercises,
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
          alert('匯入完成');
        } catch {
          alert('匯入失敗:JSON 格式不正確');
        }
      };
      reader.readAsText(file);
    }

    function handleBackupToDrive() {
      alert(
        '一鍵備份到 Google Drive：此版本先以本地匯出 JSON 為主，之後可再串接 Google Drive API。'
      );
    }

    return (
      
    <div className="page page-settings" style={{ paddingBottom: '90px' }}>

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

      {tab === 'settings' && <SettingsPage />}

      {tab === 'plan' && <BmrCalculator />}

      <nav className="bottom-nav">
        <button
          className={tab === 'today' ? 'active' : ''}
          onClick={() => setTab('today')}
        >
          <div className="nav-icon">📅</div>
          <div className="nav-label">今天</div>
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
          <div className="nav-icon">📐</div>
          <div className="nav-label">Plan</div>
        </button>
      </nav>
    </div>
  );
};

export default App;
