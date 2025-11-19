import React, { useState, useEffect } from 'react';
import { Calculator, Activity, Info, Flame, Utensils, ArrowDown, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

const BmrCalculator = () => {
  const [gender, setGender] = useState('male');
  const [age, setAge] = useState(30);
  const [height, setHeight] = useState(170);
  const [weight, setWeight] = useState(70);
  const [activityLevel, setActivityLevel] = useState(1.2);
  
  const [bmr, setBmr] = useState(0);
  const [tdee, setTdee] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  // Activity level descriptions
  const activityOptions = [
    { value: 1.2, label: '久坐不動', desc: '辦公室工作，幾乎不運動' },
    { value: 1.375, label: '輕度活動', desc: '每週運動 1-3 天' },
    { value: 1.55, label: '中度活動', desc: '每週運動 3-5 天' },
    { value: 1.725, label: '高度活動', desc: '每週運動 6-7 天' },
    { value: 1.9, label: '超高度活動', desc: '勞力工作或職業運動員' },
  ];

  // Calculation Logic (Mifflin-St Jeor Equation)
  useEffect(() => {
    let calculatedBMR = 0;
    if (gender === 'male') {
      calculatedBMR = (10 * weight) + (6.25 * height) - (5 * age) + 5;
    } else {
      calculatedBMR = (10 * weight) + (6.25 * height) - (5 * age) - 161;
    }

    setBmr(Math.round(calculatedBMR));
    setTdee(Math.round(calculatedBMR * activityLevel));
  }, [gender, age, height, weight, activityLevel]);

  // Helper component for Goal Cards
  const GoalCard = ({ title, calories, diff, warning, recommended }) => (
    <div className={`meal-card ${recommended ? 'recommended-glow' : ''}`} style={{ 
      borderColor: recommended ? 'var(--mint)' : 'var(--border-soft)',
      background: recommended ? '#fafffc' : '#fff'
    }}>
      <div className="meal-header">
        <span className="meal-title" style={{ color: recommended ? 'var(--mint-dark)' : 'var(--text-main)' }}>
          {title}
          {recommended && <span className="tag" style={{marginLeft: '8px'}}>推薦</span>}
        </span>
        <span className="meal-kcal">{calories} kcal</span>
      </div>
      <div className="hint" style={{marginTop: '4px'}}>{diff}</div>
      {warning && (
        <div className="error" style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <AlertCircle size={12} />
          {warning}
        </div>
      )}
    </div>
  );

  return (
    <div className="app">
      {/* Injecting the provided CSS directly */}
      <style>{`
        :root {
          --mint: #97d0ba;
          --mint-dark: #5c9c84;
          --bg: #f5fbf8;
          --card-radius: 16px;
          --shadow-soft: 0 4px 12px rgba(0, 0, 0, 0.04);
          --text-main: #1f2933;
          --text-sub: #6b7785;
          --border-soft: #dde7e2;
        }

        *, *::before, *::after { box-sizing: border-box; }

        html, body {
          margin: 0; padding: 0; height: 100%;
          background: var(--bg);
          color: var(--text-main);
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        button, input, select { font-family: inherit; }

        .app { min-height: 100vh; display: flex; flex-direction: column; }
        .main { flex: 1; padding: 12px 12px 90px; max-width: 480px; margin: 0 auto; width: 100%; }

        /* Cards */
        .card {
          background: #ffffff;
          border-radius: var(--card-radius);
          padding: 16px;
          margin-bottom: 12px;
          box-shadow: var(--shadow-soft);
        }
        .card h2 { margin: 0 0 12px; font-size: 16px; color: var(--text-sub); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }

        /* Top Bar */
        .top-bar {
          padding: 12px 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 8px;
        }
        .app-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--mint-dark);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* Rings */
        .ring-row { display: flex; gap: 12px; margin-bottom: 8px; }
        .ring-card { flex: 1; text-align: center; display: flex; flex-direction: column; align-items: center; }
        
        .ring {
          position: relative;
          width: 100px; height: 100px;
          margin-bottom: 8px;
          border-radius: 50%;
          background: conic-gradient(var(--mint) calc(var(--p, 0) * 1%), #e4efe9 0);
          display: flex; align-items: center; justify-content: center;
          transition: --p 0.5s ease;
        }
        
        .ring-center {
          width: 80px; height: 80px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 0 0 4px #f1f7f4 inset;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
        }
        
        .ring-value { font-weight: 700; font-size: 18px; color: var(--text-main); line-height: 1.2; }
        .ring-label { font-size: 11px; color: var(--text-sub); margin-top: 2px; }
        .ring-sub { font-size: 13px; font-weight: 600; color: var(--mint-dark); margin-top: 4px; }

        /* Subtabs (Gender) */
        .subtabs { display: flex; gap: 8px; margin-bottom: 16px; }
        .subtabs button {
          flex: 1; border-radius: 999px; border: 1px solid var(--border-soft);
          background: #fff; padding: 8px; font-size: 14px; color: var(--text-sub);
          transition: all 0.2s;
        }
        .subtabs button.active {
          background: var(--mint); color: #fff; border-color: var(--mint); font-weight: 600; box-shadow: 0 2px 8px rgba(151, 208, 186, 0.4);
        }

        /* Form Section */
        .form-grid { display: grid; grid-cols-2; gap: 12px; margin-bottom: 12px; }
        .form-group label { display: block; font-size: 12px; color: var(--text-sub); margin-bottom: 6px; }
        .form-group input, .form-group select {
          width: 100%; padding: 10px 12px; border-radius: 12px;
          border: 1px solid var(--border-soft); font-size: 15px; color: var(--text-main);
          background: #fbfdfc; outline: none; transition: border-color 0.2s;
        }
        .form-group input:focus, .form-group select:focus { border-color: var(--mint); background: #fff; }

        /* Meals / Goals */
        .meals-card { display: flex; flex-direction: column; gap: 10px; }
        .meal-card { border-radius: 12px; border: 1px solid #e5efe9; padding: 12px 14px; transition: transform 0.1s; background: #fff; }
        .meal-header { display: flex; align-items: center; justify-content: space-between; }
        .meal-title { font-weight: 600; font-size: 14px; display: flex; align-items: center; }
        .meal-kcal { font-size: 15px; font-weight: 700; color: var(--mint-dark); }
        .tag { font-size: 10px; padding: 2px 8px; border-radius: 999px; background: var(--mint); color: #fff; }
        .hint { font-size: 12px; color: var(--text-sub); }
        .error { font-size: 12px; color: #e57373; }
        
        .recommended-glow { box-shadow: 0 0 0 1px var(--mint) inset; }

        /* Details Toggle */
        .details-toggle {
          display: flex; align-items: center; justify-content: center; gap: 4px;
          width: 100%; padding: 8px; color: var(--text-sub); font-size: 13px;
          background: none; border: none; cursor: pointer; margin-top: 8px;
        }

        /* Range Input Customization */
        input[type=range] {
          width: 100%; -webkit-appearance: none; background: transparent; margin: 10px 0;
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none; height: 20px; width: 20px; border-radius: 50%;
          background: var(--mint); cursor: pointer; margin-top: -8px; box-shadow: 0 2px 6px rgba(0,0,0,0.1);
        }
        input[type=range]::-webkit-slider-runnable-track {
          width: 100%; height: 4px; cursor: pointer; background: #e5efe9; border-radius: 2px;
        }
      `}</style>

      <div className="main">
        {/* Top Bar */}
        <div className="top-bar">
          <div className="app-title">
            <Calculator size={20} />
            <span>BMR & TDEE</span>
          </div>
        </div>

        {/* Results Section (Rings) */}
        <div className="card">
          <h2>您的身體數值</h2>
          <div className="ring-row">
            {/* BMR Ring */}
            <div className="ring-card">
              <div className="ring" style={{ '--p': 100 }}>
                <div className="ring-center">
                  <div className="ring-value">{bmr}</div>
                  <div className="ring-label">BMR</div>
                </div>
              </div>
              <div className="ring-sub">基礎代謝率</div>
              <div className="ring-label" style={{fontSize: '11px', marginTop: '2px'}}>維持生命最低熱量</div>
            </div>

            {/* TDEE Ring */}
            <div className="ring-card">
              <div className="ring" style={{ '--p': Math.min((tdee / 3500) * 100, 100) }}>
                <div className="ring-center">
                  <div className="ring-value">{tdee}</div>
                  <div className="ring-label">TDEE</div>
                </div>
              </div>
              <div className="ring-sub">每日總消耗</div>
              <div className="ring-label" style={{fontSize: '11px', marginTop: '2px'}}>維持體重熱量</div>
            </div>
          </div>
        </div>

        {/* Inputs Section */}
        <div className="card">
          <h2>個人資料</h2>
          
          <div className="subtabs">
            <button 
              className={gender === 'male' ? 'active' : ''} 
              onClick={() => setGender('male')}
            >
              我是男生
            </button>
            <button 
              className={gender === 'female' ? 'active' : ''} 
              onClick={() => setGender('female')}
            >
              我是女生
            </button>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>年齡</label>
              <input 
                type="number" 
                value={age} 
                onChange={(e) => setAge(Number(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label>身高 (cm)</label>
              <input 
                type="number" 
                value={height} 
                onChange={(e) => setHeight(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="form-group" style={{marginBottom: '12px'}}>
            <label>體重 (kg)</label>
            <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
              <input 
                type="number" 
                value={weight} 
                onChange={(e) => setWeight(Number(e.target.value))}
                style={{flex: 1}}
              />
              <input 
                type="range" 
                min="30" max="150" 
                value={weight} 
                onChange={(e) => setWeight(Number(e.target.value))}
                style={{flex: 2}}
              />
            </div>
          </div>

          <div className="form-group">
            <label>日常活動量</label>
            <select 
              value={activityLevel} 
              onChange={(e) => setActivityLevel(Number(e.target.value))}
            >
              {activityOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} (x{opt.value})
                </option>
              ))}
            </select>
            <div className="hint" style={{marginTop: '8px'}}>
              {activityOptions.find(o => o.value === activityLevel)?.desc}
            </div>
          </div>
        </div>

        {/* Strategy Section */}
        <div className="card">
          <h2>目標攝取建議</h2>
          <div className="meals-card">
            <GoalCard 
              title="維持目前體重" 
              calories={tdee} 
              diff="熱量平衡 (Net 0)"
            />
            
            <GoalCard 
              title="溫和減重" 
              calories={tdee - 300} 
              diff="每日赤字 -300 (月減 1.2kg)"
              recommended={true}
            />

            {showDetails && (
              <>
                <GoalCard 
                  title="標準減重" 
                  calories={tdee - 500} 
                  diff="每日赤字 -500 (月減 2kg)"
                  warning={tdee - 500 < bmr ? "低於基礎代謝，請小心" : null}
                />
                <GoalCard 
                  title="積極減重" 
                  calories={tdee - 1000} 
                  diff="每日赤字 -1000 (月減 4kg)"
                  warning="不建議長期執行，易流失肌肉"
                />
              </>
            )}
          </div>

          <button 
            className="details-toggle" 
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? (
              <>收合更多選項 <ChevronUp size={14} /></>
            ) : (
              <>查看更多強度選項 <ChevronDown size={14} /></>
            )}
          </button>
        </div>
        
        <div style={{textAlign: 'center', marginTop: '24px', color: 'var(--text-sub)', fontSize: '12px'}}>
          <p>減重核心公式：7700 kcal ≈ 1kg 體脂肪</p>
        </div>
      </div>
    </div>
  );
};

export default BmrCalculator;