import React, { useState, useMemo } from 'react';
// --- 新增：導入圖片 (確保路徑對應到 src/assets/) ---
import proteinImg from './assets/protein.png';
import veggieImg from './assets/veggie.png';
import grainsImg from './assets/grains.png';
import fruitImg from './assets/fruit.png';
import fatImg from './assets/fat.png';
import dairyImg from './assets/dairy.png';

// --- 修改 Icon 組件：使用導入的圖片變數 ---

const ProteinIcon = () => (
  <img 
    src={proteinImg} 
    alt="豆魚肉蛋類" 
    style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
  />
);

const VeggieIcon = () => (
  <img 
    src={veggieImg} 
    alt="蔬菜類" 
    style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
  />
);

const GrainsIcon = () => (
  <img 
    src={grainsImg} 
    alt="全穀雜糧類" 
    style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
  />
);

const FruitIcon = () => (
  <img 
    src={fruitImg} 
    alt="水果類" 
    style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
  />
);

const FatIcon = () => (
  <img 
    src={fatImg} 
    alt="油脂類" 
    style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
  />
);

const DairyIcon = () => (
  <img 
    src={dairyImg} 
    alt="乳品類" 
    style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
  />
);

// 手掌法類別定義（對應台灣六大類食物）
type PortionType = {
  id: string;
  icon: React.FC;
  name: string;
  desc: string;
  unit: string;
  handEmoji: string;
  kcal: number;      // 每 1 份的熱量
  protein: number;   // 每 1 份的蛋白質
  carbs: number;     // 每 1 份的碳水
  fat: number;       // 每 1 份的脂肪
};

const PORTION_TYPES: PortionType[] = [
  {
    id: 'protein',
    icon: ProteinIcon,
    name: '豆魚肉蛋類',
    desc: '參考：肉類 1手掌 ≈ 3份 | 1顆蛋 ≈ 1份 | 1盒豆腐 ≈ 2份',
    unit: '份',
    handEmoji: '✋',
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
    handEmoji: '👊',
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
    handEmoji: '👊',
    kcal: 70,
    protein: 2,
    carbs: 15,
    fat: 0
  },
  {
    id: 'fruit',
    icon: FruitIcon,
    name: '水果類',
    desc: '參考：1拳頭 ≈ 1份 | 1顆蘋果 ≈ 1份 | 1根香蕉 ≈ 2份',
    unit: '份',
    handEmoji: '👊',
    kcal: 60,
    protein: 0,
    carbs: 15,
    fat: 0
  },
  {
    id: 'fat',
    icon: FatIcon,
    name: '油脂類',
    desc: '參考：1大拇指指節 ≈ 1份 | 5粒堅果 ≈ 1份 | 1茶匙油 ≈ 1份',
    unit: '份',
    handEmoji: '👍',
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
    handEmoji: '🥛',
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

export const VisualPortionPicker: React.FC<VisualPortionPickerProps> = ({
  onConfirm,
  onCancel,
  mealType,
}) => {
  const [foodName, setFoodName] = useState('');
  const [counts, setCounts] = useState<PortionCounts>({
    protein: 0,
    veggie: 0,
    grains: 0,
    fruit: 0,
    fat: 0,
    dairy: 0,
  });

  // 計算總營養素
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

  // 生成 amountText
  const amountText = useMemo(() => {
    const parts: string[] = [];
    PORTION_TYPES.forEach((p) => {
      const count = counts[p.id];
      if (count > 0) {
        parts.push(`${p.handEmoji}×${count}`);
      }
    });
    return parts.join(' + ') || '';
  }, [counts]);

  // 回饋訊息
  const feedback = useMemo(() => {
    const { kcal, protein } = summary;
    const veggieCount = counts.veggie || 0;
    const grainCount = counts.grains || 0;

    if (kcal === 0) return null;

    let message = '';
    let type: 'success' | 'warning' = 'warning';

    if (veggieCount < 1) {
      message = '💡 建議：蔬菜有點少喔！每餐至少 1 個拳頭的蔬菜，增加纖維質和飽足感 👊';
    } else if (protein < 15) {
      message = '💪 建議：蛋白質可以再多一點，試試加 1 個手掌大小的肉類或魚類（✋），幫助肌肉生長！';
    } else if (grainCount > 1.5) {
      message = '🌟 澱粉吃得有點多喔！如果想控制熱量，可以減少到 1 拳頭（👊）就好，多吃點蔬菜和蛋白質！';
    } else if (protein >= 15 && veggieCount >= 1 && kcal <= 700) {
      message = '✨ 太棒了！這是一餐非常均衡的組合，蛋白質充足、蔬菜足夠，而且熱量適中！繼續保持 💪';
      type = 'success';
    } else if (kcal > 800) {
      message = '🌟 今天這餐比較豐盛，記得下一餐清淡一點，或是多運動消耗一下喔！';
    } else {
      message = '👍 不錯的選擇！營養均衡，繼續保持這個節奏！';
      type = 'success';
    }

    return { message, type };
  }, [summary, counts]);

  const increase = (id: string) => {
    setCounts((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  };

  const decrease = (id: string) => {
    setCounts((prev) => {
      const current = prev[id] || 0;
      return { ...prev, [id]: current >= 1 ? current - 1 : 0 };
    });
  };

  const updateCount = (id: string, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0) {
      setCounts((prev) => ({ ...prev, [id]: num }));
    }
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
      <h3 style={{ marginBottom: 16, color: '#1f2937' }}>
        🖐️ 手掌法快速輸入 - {mealType}
      </h3>

      {/* 食物名稱 */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#1f2937' }}>
          食物名稱
        </label>
        <input
          type="text"
          value={foodName}
          onChange={(e) => setFoodName(e.target.value)}
          placeholder="例如：午餐便當、雞胸肉沙拉..."
          style={{
            width: '100%',
            padding: '12px 16px',
            border: '2px solid #e9ecef',
            borderRadius: 8,
            fontSize: 16,
          }}
        />
      </div>

      {/* 份量選擇器 */}
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
              {/* 精簡兩列式排版 */}
              <div>
                {/* 第一列：圖案 + 類別名稱 + 份數控制（緊湊橫向排列） */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  {/* 左側：圖案 + 名稱 + 手勢 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                    {/* 代表圖案 */}
                    <div style={{ 
                      width: 42,
                      height: 42,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      background: isActive ? '#f0f9f6' : '#f9fafb',
                      borderRadius: 10,
                      padding: 5,
                      transition: 'background 0.2s',
                    }}>
                      <IconComponent />
                    </div>
                    
                    {/* 類別名稱 + 手勢 */}
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontWeight: 600, 
                        color: '#1f2937',
                        fontSize: 15,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}>
                        <span>{portion.name}</span>
                        <span style={{ fontSize: 16, opacity: 0.6 }}>{portion.handEmoji}</span>
                      </div>
                    </div>
                  </div>

                  {/* 右側：份數控制（緊湊型） */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      onClick={() => decrease(portion.id)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        border: 'none',
                        background: isActive ? '#97d0ba' : '#e5e7eb',
                        color: '#fff',
                        fontSize: 16,
                        cursor: 'pointer',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        transition: 'all 0.2s',
                      }}
                    >
                      −
                    </button>
                    
                    <div style={{ 
                      minWidth: 42,
                      textAlign: 'center',
                      position: 'relative',
                    }}>
                      <div style={{ 
                        fontSize: 9, 
                        color: '#9ca3af', 
                        fontWeight: 500,
                        position: 'absolute',
                        top: -12,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        whiteSpace: 'nowrap',
                      }}>
                        份數
                      </div>
                      <input
                        type="number"
                        value={count}
                        min="0"
                        step="0.5"
                        onChange={(e) => updateCount(portion.id, e.target.value)}
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                        style={{
                          width: 42,
                          height: 28,
                          textAlign: 'center',
                          fontSize: 16,
                          fontWeight: 700,
                          color: isActive ? '#97d0ba' : '#9ca3af',
                          border: 'none',
                          borderRadius: 6,
                          background: isActive ? '#f0f9f6' : '#f3f4f6',
                          cursor: 'pointer',
                          padding: 0,
                          transition: 'all 0.2s',
                        }}
                      />
                    </div>
                    
                    <button
                      onClick={() => increase(portion.id)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        border: 'none',
                        background: '#97d0ba',
                        color: '#fff',
                        fontSize: 16,
                        cursor: 'pointer',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        transition: 'all 0.2s',
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* 第二列：說明文字 + 營養成分（精簡顯示） */}
<div className="portion-desc">
  <span className="portion-desc-main">{portion.desc}</span>
  {count > 0 && (
    <span className="portion-desc-tag">
      {Math.round(portion.kcal * count)} kcal · P {Math.round(portion.protein * count * 10) / 10}g · C {Math.round(portion.carbs * count * 10) / 10}g · F {Math.round(portion.fat * count * 10) / 10}g
    </span>
  )}
</div>


              </div>
            </div>
          );
        })}
      </div>

      {/* 營養摘要 */}
      <div
        style={{
          background: 'linear-gradient(135deg, #97d0ba 0%, #7ec0a8 100%)',
          borderRadius: 12,
          padding: 20,
          color: '#fff',
          marginBottom: 20,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 15, textAlign: 'center' }}>
          📊 營養摘要
        </div>
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

      {/* 回饋訊息 */}
      {feedback && (
        <div
          style={{
            background: feedback.type === 'success' ? '#d4edda' : '#fff3cd',
            borderLeft: `4px solid ${feedback.type === 'success' ? '#28a745' : '#ffc107'}`,
            borderRadius: 8,
            padding: 15,
            marginBottom: 20,
            fontSize: 14,
            color: feedback.type === 'success' ? '#155724' : '#856404',
          }}
        >
          {feedback.message}
        </div>
      )}

      {/* 按鈕 */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1,
            padding: 12,
            background: '#fff',
            color: '#97d0ba',
            border: '2px solid #97d0ba',
            borderRadius: 8,
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          取消
        </button>
        <button
          onClick={handleConfirm}
          style={{
            flex: 1,
            padding: 12,
            background: '#97d0ba',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          加入記錄
        </button>
      </div>
    </div>
  );
};
