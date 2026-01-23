import React, { useState, useMemo, useEffect } from 'react';
// 確保圖片路徑正確，這裡沿用原本的 assets 圖片作為「類別圖示」
import proteinImg from './assets/protein.png';
import veggieImg from './assets/veggie.png';
import grainsImg from './assets/grains.png';
import fruitImg from './assets/fruit.png';
import fatImg from './assets/fat.png';
import dairyImg from './assets/dairy.png';

import palmImg from './assets/palm.png';
import fistImg from './assets/fist.png';
import thumbImg from './assets/thumb.png';
import milkImg from './assets/milk.png';

// 定義變數對應匯入的圖檔
const HAND_ICON_PALM = palmImg;
const HAND_ICON_FIST = fistImg;
const HAND_ICON_THUMB = thumbImg;

const ProteinIcon = () => <img src={proteinImg} alt="豆魚肉蛋類" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
const VeggieIcon = () => <img src={veggieImg} alt="蔬菜類" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
const GrainsIcon = () => <img src={grainsImg} alt="全穀雜糧類" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
const FruitIcon = () => <img src={fruitImg} alt="水果類" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
const FatIcon = () => <img src={fatImg} alt="油脂類" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
const DairyIcon = () => <img src={dairyImg} alt="乳品類" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;

type PortionType = {
  id: string;
  icon: React.FC;
  name: string;
  desc: string;
  unit: string;
  handIcon?: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

const PORTION_TYPES: PortionType[] = [
  {
    id: 'protein',
    icon: ProteinIcon,
    name: '豆魚肉蛋類',
    desc: '參考：肉類 1手掌 ≈ 3份 | 1顆蛋 ≈ 1份',
    unit: '份',
    handIcon: HAND_ICON_PALM,
    kcal: 75,
    protein: 7,
    carbs: 0,
    fat: 3
  },
  {
    id: 'veggie',
    icon: VeggieIcon,
    name: '蔬菜類',
    desc: '參考：1拳頭 ≈ 1份 (煮熟約100g)',
    unit: '份',
    handIcon: HAND_ICON_FIST,
    kcal: 25,
    protein: 1,
    carbs: 5,
    fat: 0
  },
  {
    id: 'grains',
    icon: GrainsIcon,
    name: '全穀雜糧類',
    desc: '參考：飯 1拳頭 ≈ 4份 | 麵 1拳頭 ≈ 2份',
    unit: '份',
    handIcon: HAND_ICON_FIST,
    kcal: 70,
    protein: 2,
    carbs: 15,
    fat: 0
  },
  {
    id: 'fruit',
    icon: FruitIcon,
    name: '水果類',
    desc: '參考：1拳頭 ≈ 1份 | 1顆蘋果 ≈ 1份',
    unit: '份',
    handIcon: HAND_ICON_FIST,
    kcal: 60,
    protein: 0,
    carbs: 15,
    fat: 0
  },
  {
    id: 'fat',
    icon: FatIcon,
    name: '油脂類',
    desc: '參考：1大拇指指節 ≈ 1份 | 1茶匙油 ≈ 1份',
    unit: '份',
    handIcon: HAND_ICON_THUMB,
    kcal: 45,
    protein: 0,
    carbs: 0,
    fat: 5
  },
  {
    id: 'dairy',
    icon: DairyIcon,
    name: '乳品類',
    desc: '參考：牛奶 1杯 ≈ 1份 (240ml)',
    unit: '份',
    handIcon: milkImg, 
    kcal: 150,
    protein: 8,
    carbs: 12,
    fat: 8
  }
];

type PortionCounts = {
  [key: string]: number;
};

type VisualPortionPickerProps = {
  onConfirm: (data: {
    foodName: string;
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
    amountText: string;
    counts: PortionCounts;
  }) => void;
  onCancel: () => void;
  mealType: '早餐' | '午餐' | '晚餐' | '點心';
};

// 🟢 新增：簡單的數字鍵盤元件 (解決原生鍵盤難用的問題)
const SimpleNumPad: React.FC<{
  visible: boolean;
  title: string;
  value: number;
  onClose: () => void;
  onConfirm: (val: number) => void;
}> = ({ visible, title, value, onClose, onConfirm }) => {
  const [tempVal, setTempVal] = useState(String(value));

  // 當開啟時，重置數值
  useEffect(() => {
    if (visible) setTempVal(String(value));
  }, [visible, value]);

  if (!visible) return null;

  const handleNum = (num: string) => {
    if (num === '.') {
      if (!tempVal.includes('.')) setTempVal(tempVal + '.');
    } else {
      setTempVal(tempVal === '0' ? num : tempVal + num);
    }
  };

  const handleBackspace = () => {
    setTempVal(prev => prev.slice(0, -1) || '0');
  };

  return (
    <div 
      style={{
        position: 'fixed', inset: 0, zIndex: 3000, // 確保蓋過其他層級
        background: 'rgba(0,0,0,0.4)', pointerEvents: 'auto',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end'
      }} 
      onClick={onClose}
    >
      <div 
        style={{
          background: '#f0f2f5', 
          borderTopLeftRadius: 24, 
          borderTopRightRadius: 24,
          padding: '24px 20px calc(40px + env(safe-area-inset-bottom)) 20px',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
          animation: 'slideInUp 0.2s ease-out'
        }} 
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#666' }}>{title}</span>
          <span style={{ fontSize: 32, fontWeight: 700, color: '#1f2937' }}>{tempVal}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0].map(n => (
            <button key={n} onClick={() => handleNum(String(n))} style={{
              padding: '16px 0', borderRadius: 12, border: 'none', background: '#fff',
              fontSize: 24, fontWeight: 600, color: '#333', boxShadow: '0 2px 0 #e5e7eb', cursor: 'pointer'
            }}>{n}</button>
          ))}
          <button onClick={handleBackspace} style={{
            padding: '16px 0', borderRadius: 12, border: 'none', background: '#e5e7eb',
            fontSize: 22, color: '#333', boxShadow: '0 2px 0 #d1d5db', cursor: 'pointer'
          }}>⌫</button>
        </div>
        
        <button onClick={() => {
          onConfirm(Number(tempVal) || 0);
          onClose();
        }} style={{
          width: '100%', marginTop: 20, padding: '16px', borderRadius: 12, border: 'none',
          background: '#5c9c84', color: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(92, 156, 132, 0.3)'
        }}>完成</button>
      </div>
    </div>
  );
};

export const VisualPortionPicker: React.FC<VisualPortionPickerProps> = ({
  onConfirm,
  onCancel,
  mealType,
}) => {
  const [foodName, setFoodName] = useState(mealType);
  const [counts, setCounts] = useState<PortionCounts>({
    protein: 0,
    veggie: 0,
    grains: 0,
    fruit: 0,
    fat: 0,
    dairy: 0,
  });
  
  // 🟢 新增：控制目前正在編輯哪一個項目
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    setFoodName(mealType);
  }, [mealType]);

  const summary = useMemo(() => {
    let totalKcal = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;

    PORTION_TYPES.forEach((p) => {
      const servings = counts[p.id] || 0;
      totalKcal += p.kcal * servings;
      totalProtein += p.protein * servings;
      totalCarbs += p.carbs * servings;
      totalFat += p.fat * servings;
    });

    return {
      kcal: Math.round(totalKcal),
      protein: Math.round(totalProtein * 10) / 10,
      carbs: Math.round(totalCarbs * 10) / 10,
      fat: Math.round(totalFat * 10) / 10,
    };
  }, [counts]);

  const amountText = useMemo(() => {
    const parts: string[] = [];
    PORTION_TYPES.forEach((p) => {
      const count = counts[p.id];
      if (count > 0) {
        // Emoji 作為資料識別，App.tsx 會轉成圖片
        const emoji = p.id === 'protein' ? '✋' :
                      p.id === 'fat' ? '👍' :
                      p.id === 'dairy' ? '🥛' : '👊'; 
        parts.push(`${emoji}×${count}`);
      }
    });
    return parts.join(' + ') || '';
  }, [counts]);

  const feedback = useMemo(() => {
    const { kcal, protein } = summary;
    const veggieCount = counts.veggie || 0;
    const grainCount = counts.grains || 0;

    if (kcal === 0) return null;

    let message = '';
    let type: 'success' | 'warning' = 'warning';

    if (veggieCount < 1) {
      message = '💡 建議：蔬菜有點少喔！每餐至少 1 個拳頭的蔬菜 👊';
    } else if (protein < 15) {
      message = '💪 建議：蛋白質可以再多一點，試試加 1 個手掌大小的肉類 ✋';
    } else if (grainCount > 1.5) {
      message = '🌟 澱粉吃得有點多喔！如果想控制熱量，可以減少到 1 拳頭 👊';
    } else if (protein >= 15 && veggieCount >= 1 && kcal <= 700) {
      message = '✨ 太棒了！這是一餐非常均衡的組合！繼續保持 💪';
      type = 'success';
    } else if (kcal > 800) {
      message = '🌟 今天這餐比較豐盛，記得下一餐清淡一點喔！';
    } else {
      message = '👍 不錯的選擇！營養均衡，繼續保持！';
      type = 'success';
    }

    return { message, type };
  }, [summary, counts]);

  // 🟢 修改：增加單位改成 0.5
  const increase = (id: string) => {
    setCounts((prev) => ({ ...prev, [id]: (prev[id] || 0) + 0.5 }));
  };

  // 🟢 修改：減少單位改成 0.5
  const decrease = (id: string) => {
    setCounts((prev) => {
      const current = prev[id] || 0;
      return { ...prev, [id]: current >= 0.5 ? current - 0.5 : 0 };
    });
  };

  // 此函式保留給鍵盤元件呼叫用
  const updateCountDirectly = (id: string, val: number) => {
    setCounts((prev) => ({ ...prev, [id]: val }));
  };

  const handleConfirm = () => {
    if (!foodName.trim()) {
      alert('請輸入食物名稱');
      return;
    }
    if (summary.kcal === 0) {
      alert('請選擇至少一項食物份量');
      return;
    }

    onConfirm({
      foodName: foodName.trim(),
      kcal: summary.kcal,
      protein: summary.protein,
      carbs: summary.carbs,
      fat: summary.fat,
      amountText,
      counts,
    });
  };

  return (
    <div style={{ padding: '4px 0 20px 0' }}>
      <div style={{ marginBottom: 20, position: 'relative' }}>
        <input
          type="text"
          value={foodName}
          onChange={(e) => setFoodName(e.target.value)}
          placeholder="例如：午餐便當、雞胸肉沙拉..."
          style={{ 
            width: '100%', 
            padding: '12px 44px 12px 16px', 
            border: '2px solid #e9ecef', 
            borderRadius: 10, 
            fontSize: 16,
            transition: 'border-color 0.2s',
            boxSizing: 'border-box'
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = '#97d0ba'}
          onBlur={(e) => e.currentTarget.style.borderColor = '#e9ecef'}
        />
        
        {foodName && (
          <button
            type="button"
            onClick={() => setFoodName('')}
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: 'none',
              background: '#e5e7eb',
              color: '#6b7280',
              fontSize: 16,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              fontWeight: 600
            }}
          >
            ✕
          </button>
        )}
      </div>

      <div style={{ marginBottom: 20 }}>
        {PORTION_TYPES.map((portion) => {
          const count = counts[portion.id] || 0;
          const isActive = count > 0;
          const IconComponent = portion.icon;

          return (
            <div
              key={portion.id}
              style={{
                background: isActive ? '#f7faf9' : '#fff',
                border: `1.5px solid ${isActive ? '#97d0ba' : '#e9ecef'}`,
                borderRadius: 10,
                padding: '14px 16px',
                marginBottom: 12,
                transition: 'all 0.2s ease',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                    <div style={{ width: 50, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: isActive ? '#f0f9f6' : '#f9fafb', borderRadius: 10, padding: 2 }}>
                      <IconComponent />
                    </div>
                    
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: '#1f2937', fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>{portion.name}</span>
                        {portion.handIcon && (
                          <img 
                            src={portion.handIcon} 
                            alt="unit" 
                            style={{ width: 32, height: 32, objectFit: 'contain', opacity: 0.9 }} 
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button onClick={() => decrease(portion.id)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: isActive ? '#97d0ba' : '#e5e7eb', color: '#fff', fontSize: 18, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>−</button>
                    
                    {/* 🟢 修改：點擊數字時開啟鍵盤，而非使用 input */}
                    <div 
                      onClick={() => setEditingId(portion.id)}
                      style={{ 
                        minWidth: 48, 
                        textAlign: 'center', 
                        position: 'relative',
                        cursor: 'pointer' 
                      }}
                    >
                      <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500, position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>份數</div>
                      <div style={{ 
                        fontSize: 20, 
                        fontWeight: 700, 
                        color: isActive ? '#97d0ba' : '#9ca3af',
                        background: isActive ? '#f0f9f6' : '#f3f4f6',
                        borderRadius: 6,
                        padding: '2px 0',
                        borderBottom: '1px dashed #ccc' // 增加一點視覺提示表示可點擊
                      }}>
                        {count}
                      </div>
                    </div>

                    <button onClick={() => increase(portion.id)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#97d0ba', color: '#fff', fontSize: 18, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>+</button>
                  </div>
                </div>

                <div className="portion-desc">
                  <span className="portion-desc-main" style={{ fontSize: 13, color: '#6b7280', display: 'block', marginBottom: 4 }}>{portion.desc}</span>
                  {count > 0 && (
                    <span className="portion-desc-tag" style={{ fontSize: 13, fontWeight: 600, color: '#059669', marginTop: 2, display: 'inline-block' }}>
                      {Math.round(portion.kcal * count)} kcal · P {Math.round(portion.protein * count * 10) / 10}g · C {Math.round(portion.carbs * count * 10) / 10}g · F {Math.round(portion.fat * count * 10) / 10}g
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ background: 'linear-gradient(135deg, #97d0ba 0%, #7ec0a8 100%)', borderRadius: 12, padding: 20, color: '#fff', marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 15, textAlign: 'center' }}>營養摘要</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{summary.kcal}</div>
            <div style={{ fontSize: 14, opacity: 0.9, marginTop: 5 }}>大卡</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{summary.protein}g</div>
            <div style={{ fontSize: 14, opacity: 0.9, marginTop: 5 }}>蛋白質</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{summary.carbs}g</div>
            <div style={{ fontSize: 14, opacity: 0.9, marginTop: 5 }}>碳水化合物</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{summary.fat}g</div>
            <div style={{ fontSize: 14, opacity: 0.9, marginTop: 5 }}>脂肪</div>
          </div>
        </div>
      </div>

      {feedback && (
        <div style={{ background: feedback.type === 'success' ? '#d4edda' : '#fff3cd', borderLeft: `4px solid ${feedback.type === 'success' ? '#28a745' : '#ffc107'}`, borderRadius: 8, padding: 15, marginBottom: 20, fontSize: 14, color: feedback.type === 'success' ? '#155724' : '#856404' }}>
          {feedback.message}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: 12, background: '#fff', color: '#97d0ba', border: '2px solid #97d0ba', borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>取消</button>
        <button onClick={handleConfirm} style={{ flex: 1, padding: 12, background: '#97d0ba', color: '#fff', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>加入記錄</button>
      </div>

      {/* 🟢 新增：數字鍵盤 Modal */}
      {editingId && (
        <SimpleNumPad
          visible={true}
          title={`輸入${PORTION_TYPES.find(p => p.id === editingId)?.name || '份數'}`}
          value={counts[editingId] || 0}
          onClose={() => setEditingId(null)}
          onConfirm={(val) => updateCountDirectly(editingId, val)}
        />
      )}
    </div>
  );
};