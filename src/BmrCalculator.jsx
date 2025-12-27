import React, { useState, useEffect } from 'react';

/** 輕量內嵌圖示（不用外部套件） */
const IconChevronDown = ({ size = 14, style = {} }) => (
  <span style={{ display: 'inline-block', transform: 'translateY(-1px)', ...style }}>▼</span>
);
const IconChevronUp = ({ size = 14, style = {} }) => (
  <span style={{ display: 'inline-block', transform: 'translateY(-1px)', ...style }}>▲</span>
);

/** 目標卡片 Component */
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

/** 主程式：BMR/TDEE 計算器 */
const BmrCalculator = () => {
  const [gender, setGender] = useState('female');
  
  // 🟢 Change: 改用生日 State，並保留 Age 作為計算中間值
  const [birthDate, setBirthDate] = useState(localStorage.getItem('JU_PLAN_BIRTHDATE') || '');
  const [age, setAge] = useState(30);

  const [height, setHeight] = useState(165); // cm
  const [weight, setWeight] = useState(60);  // kg
  const [activityLevel, setActivityLevel] = useState('light'); // sedentary/light...

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
    
    // 補讀取年齡 (若沒有生日時使用)
    const savedAge = localStorage.getItem('JU_PLAN_AGE');
    if (savedAge) setAge(Number(savedAge));

    // 補讀取身高體重
    const h = localStorage.getItem('JU_PLAN_HEIGHT');
    if (h) setHeight(Number(h));
    const w = localStorage.getItem('JU_PLAN_WEIGHT');
    if (w) setWeight(Number(w));
    const gen = localStorage.getItem('JU_PLAN_GENDER');
    if (gen) setGender(gen);
  }, []);

  // 🟢 Change: 生日改變時，自動計算年齡並存檔
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
      localStorage.setItem('JU_PLAN_BIRTHDATE', birthDate);
      localStorage.setItem('JU_PLAN_AGE', String(calculatedAge));
    }
  }, [birthDate]);

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

  // 寫入 localStorage
  useEffect(() => {
    if (bmr > 0) localStorage.setItem('JU_PLAN_BMR', String(bmr));
    if (tdee > 0) localStorage.setItem('JU_PLAN_TDEE', String(tdee));
    if (selectedGoal != null) localStorage.setItem('JU_PLAN_GOAL_KCAL', String(selectedGoal));
    
    // 存身高體重與性別
    localStorage.setItem('JU_PLAN_HEIGHT', String(height));
    localStorage.setItem('JU_PLAN_WEIGHT', String(weight));
    localStorage.setItem('JU_PLAN_GENDER', gender);
  }, [bmr, tdee, selectedGoal, height, weight, gender]);

  return (
    <div className="wrap" style={{ padding: '20px 16px 80px 16px', maxWidth: 600, margin: '0 auto' }}>
      
      {/* 標題優化 */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 'var(--font-xl)', marginBottom: 8, color: 'var(--text-main)' }}>
          個人計畫 Plan
        </h2>
        <p style={{ color: 'var(--text-sub)', fontSize: 'var(--font-sm)', margin: 0 }}>
          設定身體數值，計算您的每日熱量需求
        </p>
      </div>

      <section className="card" style={{ padding: 20, marginBottom: 24 }}>
        <h3 style={{ fontSize: 'var(--font-lg)', margin: '0 0 16px 0', borderBottom: '1px solid #eee', paddingBottom: 12 }}>
          ⚙️ 基本設定
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          <div className="form-group">
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>生理性別</label>
            <select 
              value={gender} 
              onChange={(e) => setGender(e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd', background: '#fff', fontSize: 16 }}
            >
              <option value="female">女性</option>
              <option value="male">男性</option>
            </select>
          </div>

          {/* 🟢 Change: 改為生日輸入 */}
          <div className="form-group">
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              出生年月日 <span style={{fontSize: 13, color: '#888'}}>(自動算: {age} 歲)</span>
            </label>
            <input 
              type="date" 
              value={birthDate} 
              onChange={(e) => setBirthDate(e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd', fontSize: 16 }}
            />
          </div>

          {/* 🟢 Change: 身高體重並排顯示，並加入 inputMode */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>身高 (cm)</label>
              <input 
                type="number" 
                inputMode="decimal" // 手機喚起數字鍵盤
                value={height} 
                onChange={(e) => setHeight(Number(e.target.value))}
                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd', fontSize: 16 }}
              />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>體重 (kg)</label>
              <input 
                type="number" 
                inputMode="decimal" // 手機喚起數字鍵盤
                value={weight} 
                onChange={(e) => setWeight(Number(e.target.value))}
                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd', fontSize: 16 }}
              />
            </div>
          </div>

          <div className="form-group">
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>日常活動量</label>
            <select 
              value={activityLevel} 
              onChange={(e) => setActivityLevel(e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd', background: '#fff', fontSize: 16 }}
            >
              <option value="sedentary">久坐 (辦公室/沒運動) x1.2</option>
              <option value="light">輕量 (每週運動 1-3 天) x1.375</option>
              <option value="moderate">中等 (每週運動 3-5 天) x1.55</option>
              <option value="active">活躍 (每週運動 6-7 天) x1.725</option>
              <option value="very">非常活躍 (勞力/運動員) x1.9</option>
            </select>
          </div>
        </div>
      </section>

      {/* 🟢 Change: 結果顯示區塊視覺優化 */}
      <section className="card" style={{ padding: 24, marginBottom: 24, textAlign: 'center' }}>
        <div style={{ display: 'inline-block', background: '#e0f2fe', padding: '6px 16px', borderRadius: 20, color: '#0369a1', fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
          您的 TDEE 每日總消耗
        </div>
        <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--mint-dark)', lineHeight: 1.2 }}>
          {tdee} <span style={{ fontSize: 20, fontWeight: 500, color: '#666' }}>kcal</span>
        </div>
        <div style={{ color: '#888', fontSize: 14, marginTop: 8 }}>
          基礎代謝 BMR: {bmr} kcal
        </div>
      </section>

      <section className="card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 'var(--font-lg)', margin: '0 0 16px 0' }}>🎯 選擇您的目標</h3>
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
          style={{ marginTop: 12, width: '100%', background: 'transparent', border: 'none', color: '#666', cursor: 'pointer' }}
        >
          {showDetails ? (
            <>收合更多選項 <IconChevronUp /></>
          ) : (
            <>查看更多強度選項 <IconChevronDown /></>
          )}
        </button>

        <div className="hint" style={{ textAlign: 'center', marginTop: 16, fontSize: 14, color: '#666' }}>
          目前選擇的目標攝取：<span style={{color: 'var(--mint-dark)', fontWeight: 'bold'}}>{selectedGoal ?? '未選擇'}</span> kcal
        </div>

        {/* 加入目標熱量按鈕 */}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            className="btn primary"
            disabled={selectedGoal == null}
            onClick={() => {
              if (selectedGoal == null) return;
              try {
                localStorage.setItem('JU_PLAN_GOAL_KCAL', String(selectedGoal));
                document.dispatchEvent(new CustomEvent('ju:set-goal-kcal', { detail: selectedGoal }));
                alert(`已加入目標熱量：${selectedGoal} kcal`);
              } catch {}
            }}
            style={{ 
              width: '100%',
              padding: '14px', 
              borderRadius: 12, 
              border: 'none', 
              background: selectedGoal ? '#5c9c84' : '#ccc', 
              color: '#fff', 
              fontSize: 18,
              fontWeight: 600
            }}
          >
            確認並套用目標
          </button>
        </div>
      </section>
    </div>
  );
};

export default BmrCalculator;