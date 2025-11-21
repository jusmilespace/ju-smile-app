import React, { useState, useEffect } from 'react';

/** 輕量內嵌圖示（不用外部套件） */
const IconChevronDown = ({ size = 14, style = {} }) => (
  <span style={{ display: 'inline-block', transform: 'translateY(-1px)', ...style }}>▼</span>
);
const IconChevronUp = ({ size = 14, style = {} }) => (
  <span style={{ display: 'inline-block', transform: 'translateY(-1px)', ...style }}>▲</span>
);

/** 目標卡片 */
const GoalCard = ({ title, calories, diff, warning, recommended, onSelect, selected }) => (
  <div
    className="card"
    style={{
      border: selected ? '2px solid #5c9c84' : '1px solid var(--line)',
      cursor: 'pointer',
      background: recommended ? '#fafffc' : '#fff'
    }}
    onClick={() => onSelect && onSelect(calories)}
  >
    <div className="meal-header">
      {selected && (
        <span className="tag" style={{ marginRight: '8px', background: '#5c9c84' }}>
          已選
        </span>
      )}
      <span
        className="meal-title"
        style={{ color: recommended ? 'var(--mint-dark)' : 'var(--text-main)' }}
      >
        {title}
      </span>
      {recommended && <span className="tag" style={{ marginLeft: '8px' }}>推薦</span>}
    </div>
    <div className="meal-body">
      <div className="kcal">{Math.round(calories)} kcal</div>
      <div className="tip">{diff}</div>
      {warning && <div className="warning" style={{ color: '#d64545' }}>{warning}</div>}
    </div>
  </div>
);

/** BMR/TDEE 計算，並可選擇「目標攝取」 */
const BmrCalculator = () => {
  const [gender, setGender] = useState('female');
  const [age, setAge] = useState(30);
  const [height, setHeight] = useState(165); // cm
  const [weight, setWeight] = useState(60);  // kg
  const [activityLevel, setActivityLevel] = useState('light'); // sedentary/light/moderate/active/very

  const [bmr, setBmr] = useState(0);
  const [tdee, setTdee] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);

  // 初始讀取
  useEffect(() => {
    const g = localStorage.getItem('JU_PLAN_GOAL_KCAL');
    if (g) setSelectedGoal(Number(g));
    const b = localStorage.getItem('JU_PLAN_BMR');
    if (b) setBmr(Number(b));
    const t = localStorage.getItem('JU_PLAN_TDEE');
    if (t) setTdee(Number(t));
  }, []);

  // 計算 BMR/TDEE
  useEffect(() => {
    const w = Number(weight) || 0;
    const h = Number(height) || 0;
    const a = Number(age) || 0;

    let b = 0;
    if (gender === 'male') {
      b = 10 * w + 6.25 * h - 5 * a + 5;
    } else {
      b = 10 * w + 6.25 * h - 5 * a - 161;
    }
    const bmrRounded = Math.round(b);
    setBmr(bmrRounded);

    const activityMultipliers = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very: 1.9,
    };
    const multiplier = activityMultipliers[activityLevel] || 1.375;
    const tdeeCalc = Math.round(bmrRounded * multiplier);
    setTdee(tdeeCalc);
  }, [gender, age, height, weight, activityLevel]);

  // 寫入 localStorage，給 App 讀
  useEffect(() => {
    if (bmr > 0) localStorage.setItem('JU_PLAN_BMR', String(bmr));
    if (tdee > 0) localStorage.setItem('JU_PLAN_TDEE', String(tdee));
    if (selectedGoal != null) localStorage.setItem('JU_PLAN_GOAL_KCAL', String(selectedGoal));
  }, [bmr, tdee, selectedGoal]);

  return (
    <div className="wrap" style={{ padding: 16 }}>
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>BMR / TDEE 計算</h1>

      <section className="card">
        <h2>基本資料</h2>
        <div className="form-section">
          <label>
            性別
            <select value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="female">女性</option>
              <option value="male">男性</option>
            </select>
          </label>
          <label>
            年齡
            <input type="number" value={age} onChange={(e) => setAge(Number(e.target.value))} />
          </label>
          <label>
            身高 (cm)
            <input type="number" value={height} onChange={(e) => setHeight(Number(e.target.value))} />
          </label>
          <label>
            體重 (kg)
            <input type="number" value={weight} onChange={(e) => setWeight(Number(e.target.value))} />
          </label>
          <label>
            活動量
            <select value={activityLevel} onChange={(e) => setActivityLevel(e.target.value)}>
              <option value="sedentary">久坐(1.2)</option>
              <option value="light">輕量(1.375)</option>
              <option value="moderate">中等(1.55)</option>
              <option value="active">活躍(1.725)</option>
              <option value="very">非常活躍(1.9)</option>
            </select>
          </label>
        </div>
      </section>

      <section className="card">
        <h2>計算結果</h2>
        <div className="row">
          <div>BMR（基礎代謝）</div>
          <div className="kcal">{bmr} kcal</div>
        </div>
        <div className="row">
          <div>TDEE（總消耗）</div>
          <div className="kcal">{tdee} kcal</div>
        </div>
      </section>

      <section className="card">
        <h2>目標攝取建議</h2>
        <div className="meals-card">
          <GoalCard
            title="維持目前體重"
            calories={tdee}
            diff="熱量平衡 (Net 0)"
            onSelect={(c) => setSelectedGoal(c)}
            selected={selectedGoal === tdee}
          />

          <GoalCard
            title="溫和減重"
            calories={tdee - 300}
            diff="每日赤字 -300 (月減 1.2kg)"
            recommended={true}
            onSelect={(c) => setSelectedGoal(c)}
            selected={selectedGoal === (tdee - 300)}
          />

          {showDetails && (
            <>
              <GoalCard
                title="標準減重"
                calories={tdee - 500}
                diff="每日赤字 -500 (月減 2kg)"
                warning={tdee - 500 < bmr ? '低於基礎代謝，請小心' : null}
                onSelect={(c) => setSelectedGoal(c)}
                selected={selectedGoal === (tdee - 500)}
              />
              <GoalCard
                title="積極減重"
                calories={tdee - 1000}
                diff="每日赤字 -1000 (月減 4kg)"
                warning="不建議長期執行，易流失肌肉"
                onSelect={(c) => setSelectedGoal(c)}
                selected={selectedGoal === (tdee - 1000)}
              />
            </>
          )}
        </div>

        <button
          className="details-toggle"
          onClick={() => setShowDetails(!showDetails)}
          style={{ marginTop: 12 }}
        >
          {showDetails ? (
            <>收合更多選項 <IconChevronUp /></>
          ) : (
            <>查看更多強度選項 <IconChevronDown /></>
          )}
        </button>

        <div className="hint" style={{ textAlign: 'center', marginTop: 8 }}>
          目前選擇的目標攝取：{selectedGoal ?? '未選擇'} kcal（會自動帶到「今天」與「我的」頁）
        </div>

        {/* 加入目標熱量按鈕 */}
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button
            className="btn primary"
            disabled={selectedGoal == null}
            onClick={() => {
              if (selectedGoal == null) return;
              try {
                localStorage.setItem('JU_PLAN_GOAL_KCAL', String(selectedGoal));
                // 通知 App 立即更新「我的」頁的目標攝取熱量
                document.dispatchEvent(new CustomEvent('ju:set-goal-kcal', { detail: selectedGoal }));
                alert(`已加入目標熱量：${selectedGoal} kcal`);
              } catch {}
            }}
            style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: '#5c9c84', color: '#fff', fontSize: 16 }}
          >
            加入目標熱量
          </button>
        </div>
      </section>
    </div>
  );
};

export default BmrCalculator;
