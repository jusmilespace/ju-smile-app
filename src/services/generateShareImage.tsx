import html2canvas from 'html2canvas';
import dayjs from 'dayjs';
// 🆕 引入 logo 圖片
import logoImage from '../assets/Ju Smile App.png';

interface ChartDataPoint {
  date: string;
  fullDate: string;
  weight?: number | null;
  bodyFat?: number | null;
  skeletalMuscle?: number | null;
  calories?: number | null;
  protein?: number | null;
  carb?: number | null;
  fat?: number | null;
}

interface ShareImageOptions {
  period: '7d' | '30d' | '90d' | '180d' | '365d';
  metric: 'bodyComposition' | 'weight' | 'bodyFat' | 'skeletalMuscle' | 'calories' | 'protein' | 'nutrition';
  chartData: ChartDataPoint[];
  userName?: string;
}

/**
 * 生成精美的分享圖
 */
export async function generateShareImage(options: ShareImageOptions): Promise<string> {
  const { period, metric, chartData, userName = '用戶' } = options;

  // 計算統計數據
  const stats = calculateStats(chartData, metric);
  const periodLabel = getPeriodLabel(period);
  const metricLabel = getMetricLabel(metric);

  // 生成統計卡片 HTML
  const statsCardsHTML = generateStatsCards(stats);

  // 創建隱藏的分享視圖
  const container = document.createElement('div');
  container.id = 'share-image-container';
  container.style.cssText = `
    position: fixed;
    top: -99999px;
    left: -99999px;
    width: 1080px;
    background: linear-gradient(135deg, #f6f9fc 0%, #fff 100%);
    padding: 60px 40px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang TC", "Microsoft JhengHei", sans-serif;
  `;

  container.innerHTML = `
    <!-- Logo 與標題 -->
    <div style="text-align: center; margin-bottom: 40px;">
      <img 
        src="${logoImage}" 
        alt="Ju Smile Logo" 
        style="
          width: 80px; 
          height: 80px; 
          object-fit: contain;
          margin: 0 auto 20px;
          display: block;
          border-radius: 18px;
          filter: drop-shadow(0 8px 20px rgba(92, 156, 132, 0.3));
        "
        crossorigin="anonymous"
      />
      <h1 style="
        font-size: 36px;
        font-weight: 800;
        margin: 0 0 8px 0;
        color: #1f2937;
        letter-spacing: -0.5px;
      ">Ju Smile</h1>
      <p style="
        font-size: 18px;
        color: #6b7280;
        margin: 0;
        font-weight: 500;
      ">${periodLabel}${metricLabel}趨勢分析</p>
    </div>

    ${statsCardsHTML}

    <!-- 趨勢變化 -->
    <div style="
      background: white;
      padding: 24px 28px;
      border-radius: 16px;
      margin-bottom: 40px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      border: 1px solid #e9ecef;
    ">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
        <div style="
          width: 48px;
          height: 48px;
          background: ${stats.isMultiMetric ? '#f0f9ff' : '#f0f9ff'};
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        ">${stats.emoji}</div>
        <div style="flex: 1;">
          <div style="font-size: 18px; font-weight: 700; color: #1f2937; margin-bottom: 4px;">
            ${stats.trend}
          </div>
          ${stats.isMultiMetric ? `
            <div style="font-size: 13px; color: #6b7280; display: flex; gap: 12px; flex-wrap: wrap;">
              ${stats.metricsStats ? stats.metricsStats.map((m: any) => `
                <span style="
                  background: ${parseFloat(m.change) > 0 ? '#fee2e2' : parseFloat(m.change) < 0 ? '#d1fae5' : '#f3f4f6'};
                  padding: 2px 8px;
                  border-radius: 6px;
                  font-weight: 500;
                ">
                  ${m.label}: ${parseFloat(m.change) > 0 ? '▲' : parseFloat(m.change) < 0 ? '▼' : '—'}${Math.abs(parseFloat(m.change))}${m.unit}
                </span>
              `).join('') : ''}
            </div>
          ` : `
            <div style="font-size: 14px; color: #6b7280;">
              ${stats.firstValue} → ${stats.lastValue} ${stats.unit}
            </div>
          `}
        </div>
      </div>
      <div style="
        background: linear-gradient(135deg, #f6f9fc 0%, #fff 100%);
        padding: 16px 20px;
        border-radius: 12px;
        border-left: 3px solid #5c9c84;
      ">
        <div style="font-size: 15px; color: #374151; font-weight: 600; margin-bottom: 6px;">
          💡 數據洞察
        </div>
        <div style="font-size: 14px; color: #6b7280; line-height: 1.6;">
          ${stats.suggestion}
        </div>
      </div>
    </div>

    <!-- 簡化版趨勢圖（SVG） -->
    <div style="
      background: white;
      padding: 28px;
      border-radius: 16px;
      margin-bottom: 40px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      border: 1px solid #e9ecef;
    ">
      <div style="font-size: 16px; font-weight: 700; color: #1f2937; margin-bottom: 20px;">
        趨勢走向
      </div>
      ${generateSimpleTrendSVG(chartData, metric, stats)}
    </div>

    <!-- 底部資訊 -->
    <div style="text-align: center; color: #9ca3af; font-size: 13px; padding-top: 20px; border-top: 1px solid #e9ecef;">
      <p style="margin: 0 0 8px 0; font-weight: 500;">
        資料期間：${dayjs(chartData[0]?.fullDate).format('YYYY/MM/DD')} - ${dayjs(chartData[chartData.length-1]?.fullDate).format('YYYY/MM/DD')}
      </p>
      <p style="margin: 0; font-weight: 600; color: #5c9c84;">
        使用 Ju Smile 記錄健康數據
      </p>
    </div>
  `;

  // 加到 DOM
  document.body.appendChild(container);

  // 🆕 等待圖片載入完成
  const imgElement = container.querySelector('img');
  if (imgElement) {
    await new Promise((resolve) => {
      if (imgElement.complete) {
        resolve(null);
      } else {
        imgElement.onload = () => resolve(null);
        imgElement.onerror = () => resolve(null); // 即使失敗也繼續
      }
    });
  }
  
  // 額外等待渲染完成
  await new Promise(resolve => setTimeout(resolve, 100));

  // 轉換成圖片
  const canvas = await html2canvas(container, {
    scale: 2,
    backgroundColor: '#ffffff',
    logging: false,
    useCORS: true,
  });

  // 清理
  document.body.removeChild(container);

  // 回傳 base64
  return canvas.toDataURL('image/png', 0.95);
}

/**
 * 生成統計卡片 HTML
 */
function generateStatsCards(stats: any): string {
  if (stats.isMultiMetric) {
    // 多指標卡片（bodyComposition 或 nutrition）
    return `
      <div style="
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 20px;
        margin-bottom: 40px;
      ">
        ${stats.metricsStats.map((metricStat: any, index: number) => {
          const colors = [
            { bg: 'linear-gradient(135deg, #e8f5e9 0%, #f1f8f4 100%)', text: '#5c9c84', border: 'rgba(92, 156, 132, 0.1)' },
            { bg: 'linear-gradient(135deg, #fff3e0 0%, #fff8f1 100%)', text: '#f59e0b', border: 'rgba(255, 152, 0, 0.1)' },
            { bg: 'linear-gradient(135deg, #e3f2fd 0%, #f1f8fd 100%)', text: '#2196f3', border: 'rgba(33, 150, 243, 0.1)' }
          ];
          const color = colors[index % 3];
          
          return `
            <div style="
              background: ${color.bg};
              padding: 24px 20px;
              border-radius: 16px;
              text-align: center;
              box-shadow: 0 2px 8px rgba(0,0,0,0.05);
              border: 1px solid ${color.border};
            ">
              <div style="font-size: 13px; color: ${color.text}; font-weight: 600; margin-bottom: 8px;">${metricStat.label}</div>
              <div style="font-size: 28px; font-weight: 800; color: #1f2937; margin-bottom: 4px;">
                ${metricStat.avg}
              </div>
              <div style="font-size: 12px; color: #6b7280; font-weight: 500; margin-bottom: 8px;">${metricStat.unit}</div>
              <div style="
                font-size: 12px; 
                color: ${parseFloat(metricStat.change) > 0 ? '#ef4444' : parseFloat(metricStat.change) < 0 ? '#10b981' : '#6b7280'}; 
                font-weight: 600;
                background: ${parseFloat(metricStat.change) > 0 ? '#fee2e2' : parseFloat(metricStat.change) < 0 ? '#d1fae5' : '#f3f4f6'};
                padding: 4px 8px;
                border-radius: 6px;
                display: inline-block;
              ">
                ${parseFloat(metricStat.change) > 0 ? '▲' : parseFloat(metricStat.change) < 0 ? '▼' : '—'} ${Math.abs(parseFloat(metricStat.change))} ${metricStat.unit}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } else {
    // 單一指標統計卡片
    return `
      <div style="
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 20px;
        margin-bottom: 40px;
      ">
        <!-- 平均值 -->
        <div style="
          background: linear-gradient(135deg, #e8f5e9 0%, #f1f8f4 100%);
          padding: 24px;
          border-radius: 16px;
          text-align: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          border: 1px solid rgba(92, 156, 132, 0.1);
        ">
          <div style="font-size: 14px; color: #5c9c84; font-weight: 600; margin-bottom: 8px;">平均值</div>
          <div style="font-size: 32px; font-weight: 800; color: #1f2937; margin-bottom: 4px;">
            ${stats.avg}
          </div>
          <div style="font-size: 13px; color: #6b7280; font-weight: 500;">${stats.unit}</div>
        </div>

        <!-- 最高值 -->
        <div style="
          background: linear-gradient(135deg, #fff3e0 0%, #fff8f1 100%);
          padding: 24px;
          border-radius: 16px;
          text-align: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          border: 1px solid rgba(255, 152, 0, 0.1);
        ">
          <div style="font-size: 14px; color: #f59e0b; font-weight: 600; margin-bottom: 8px;">最高值</div>
          <div style="font-size: 32px; font-weight: 800; color: #1f2937; margin-bottom: 4px;">
            ${stats.max}
          </div>
          <div style="font-size: 13px; color: #6b7280; font-weight: 500;">${stats.unit}</div>
        </div>

        <!-- 最低值 -->
        <div style="
          background: linear-gradient(135deg, #e3f2fd 0%, #f1f8fd 100%);
          padding: 24px;
          border-radius: 16px;
          text-align: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          border: 1px solid rgba(33, 150, 243, 0.1);
        ">
          <div style="font-size: 14px; color: #2196f3; font-weight: 600; margin-bottom: 8px;">最低值</div>
          <div style="font-size: 32px; font-weight: 800; color: #1f2937; margin-bottom: 4px;">
            ${stats.min}
          </div>
          <div style="font-size: 13px; color: #6b7280; font-weight: 500;">${stats.unit}</div>
        </div>
      </div>
    `;
  }
}

/**
 * 計算統計數據
 */
function calculateStats(data: ChartDataPoint[], metric: string) {
  // 🆕 特別處理多指標
  if (metric === 'bodyComposition') {
    return calculateBodyCompositionStats(data);
  }
  if (metric === 'nutrition') {
    return calculateNutritionStats(data);
  }
  
  const validData = data.filter(d => d[metric as keyof ChartDataPoint] != null);
  
  if (validData.length === 0) {
    return {
      avg: 'N/A',
      max: 'N/A',
      min: 'N/A',
      firstValue: 'N/A',
      lastValue: 'N/A',
      change: 'N/A',
      changePercent: 0,
      trend: '無數據',
      emoji: '📊',
      suggestion: '尚無足夠數據進行分析',
      unit: '',
      isMultiMetric: false
    };
  }

  const values = validData.map(d => Number(d[metric as keyof ChartDataPoint]));
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const firstValue = values[0];
  const lastValue = values[values.length - 1];
  const change = lastValue - firstValue;
  const changePercent = (change / firstValue) * 100;

  // 單位
  const unitMap: Record<string, string> = {
    weight: 'kg',
    bodyFat: '%',
    skeletalMuscle: '%',
    calories: 'kcal',
    protein: 'g'
  };
  const unit = unitMap[metric] || '';

  // 趨勢
  let trend = '持平';
  let emoji = '➡️';
  if (Math.abs(changePercent) > 2) {
    if (change > 0) {
      trend = '上升趨勢';
      emoji = '📈';
    } else {
      trend = '下降趨勢';
      emoji = '📉';
    }
  }

  // 建議
  let suggestion = '';
  if (metric === 'weight') {
    if (change < -1) {
      suggestion = '太棒了！體重穩定下降中，繼續保持良好習慣！💪';
    } else if (change > 1) {
      suggestion = '體重略有上升，建議檢視飲食攝取是否過量。';
    } else {
      suggestion = '體重維持穩定，繼續保持目前的生活方式。';
    }
  } else if (metric === 'bodyFat') {
    if (change < -1) {
      suggestion = '體脂率下降中，運動與飲食控制效果顯著！🔥';
    } else if (change > 1) {
      suggestion = '體脂率上升，建議增加運動並控制碳水攝取。';
    } else {
      suggestion = '體脂率穩定，保持目前的訓練計畫。';
    }
  } else if (metric === 'skeletalMuscle') {
    if (change > 0.5) {
      suggestion = '骨骼肌率提升中！肌肉量增加，訓練效果很好！💪';
    } else if (change < -0.5) {
      suggestion = '骨骼肌率下降，建議增加阻力訓練和蛋白質攝取。';
    } else {
      suggestion = '骨骼肌率穩定，維持目前的訓練強度。';
    }
  } else if (metric === 'calories') {
    if (avg < -200) {
      suggestion = '熱量赤字較大，適合減脂期。注意營養均衡！';
    } else if (avg > 200) {
      suggestion = '熱量盈餘中，適合增肌期。配合訓練效果更好！';
    } else {
      suggestion = '熱量平衡良好，適合維持期。';
    }
  } else if (metric === 'protein') {
    if (avg >= 80) {
      suggestion = '蛋白質攝取充足，有助於肌肉生長與修復！💪';
    } else {
      suggestion = '蛋白質攝取略低，建議增加優質蛋白來源。';
    }
  }

  return {
    avg: avg.toFixed(1),
    max: max.toFixed(1),
    min: min.toFixed(1),
    firstValue: firstValue.toFixed(1),
    lastValue: lastValue.toFixed(1),
    change: change.toFixed(1),
    changePercent: changePercent.toFixed(1),
    trend,
    emoji,
    suggestion,
    unit,
    isMultiMetric: false
  };
}

/**
 * 🆕 計算身體組成的多指標統計
 */
function calculateBodyCompositionStats(data: ChartDataPoint[]) {
  const metrics = ['weight', 'bodyFat', 'skeletalMuscle'] as const;
  const labels = ['體重', '體脂率', '骨骼肌率'];
  const units = ['kg', '%', '%'];
  
  // 計算每個指標的統計
  const metricsStats = metrics.map((metric, index) => {
    const validData = data.filter(d => d[metric] != null);
    
    if (validData.length === 0) {
      return {
        label: labels[index],
        unit: units[index],
        avg: 'N/A',
        change: 'N/A',
        trend: '無數據'
      };
    }
    
    const values = validData.map(d => Number(d[metric]));
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    const firstValue = values[0];
    const lastValue = values[values.length - 1];
    const change = lastValue - firstValue;
    
    let trend = '持平';
    if (Math.abs(change) > (metric === 'weight' ? 1 : 0.5)) {
      trend = change > 0 ? '上升' : '下降';
    }
    
    return {
      label: labels[index],
      unit: units[index],
      avg: avg.toFixed(1),
      change: change.toFixed(1),
      trend,
      firstValue: firstValue.toFixed(1),
      lastValue: lastValue.toFixed(1)
    };
  });
  
  // 生成綜合建議
  const weightChange = parseFloat(metricsStats[0].change) || 0;
  const bodyFatChange = parseFloat(metricsStats[1].change) || 0;
  const muscleChange = parseFloat(metricsStats[2].change) || 0;
  
  let suggestion = '';
  let emoji = '📊';
  
  if (weightChange < -1 && bodyFatChange < -0.5 && muscleChange >= 0) {
    suggestion = '完美！體重下降同時體脂降低、肌肉量保持，這是理想的身體組成改善！💪';
    emoji = '🏆';
  } else if (bodyFatChange < -1) {
    suggestion = '體脂率下降中，運動與飲食控制效果顯著！持續保持！🔥';
    emoji = '📉';
  } else if (muscleChange > 1) {
    suggestion = '骨骼肌率提升，肌肉量增加中！訓練效果很好！💪';
    emoji = '📈';
  } else if (weightChange > 2 && bodyFatChange > 1) {
    suggestion = '體重和體脂率都有上升，建議檢視飲食並增加運動量。';
    emoji = '⚠️';
  } else {
    suggestion = '身體組成維持穩定，繼續保持目前的生活方式。';
    emoji = '➡️';
  }
  
  return {
    isMultiMetric: true,
    metricsStats,
    emoji,
    suggestion,
    trend: '多指標分析',
    unit: ''
  };
}

/**
 * 🆕 計算三大營養素的多指標統計
 */
function calculateNutritionStats(data: ChartDataPoint[]) {
  const metrics = ['protein', 'carb', 'fat'] as const;
  const labels = ['蛋白質', '碳水化合物', '脂肪'];
  const units = ['g', 'g', 'g'];
  
  // 計算每個指標的統計
  const metricsStats = metrics.map((metric, index) => {
    const validData = data.filter(d => d[metric] != null);
    
    if (validData.length === 0) {
      return {
        label: labels[index],
        unit: units[index],
        avg: 'N/A',
        change: 'N/A',
        trend: '無數據'
      };
    }
    
    const values = validData.map(d => Number(d[metric]));
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    const firstValue = values[0];
    const lastValue = values[values.length - 1];
    const change = lastValue - firstValue;
    
    let trend = '持平';
    if (Math.abs(change) > 5) {
      trend = change > 0 ? '上升' : '下降';
    }
    
    return {
      label: labels[index],
      unit: units[index],
      avg: avg.toFixed(1),
      change: change.toFixed(1),
      trend,
      firstValue: firstValue.toFixed(1),
      lastValue: lastValue.toFixed(1)
    };
  });
  
  // 生成綜合建議
  const proteinAvg = parseFloat(metricsStats[0].avg) || 0;
  const carbAvg = parseFloat(metricsStats[1].avg) || 0;
  const fatAvg = parseFloat(metricsStats[2].avg) || 0;
  
  let suggestion = '';
  let emoji = '📊';
  
  if (proteinAvg >= 80) {
    suggestion = '蛋白質攝取充足！碳水和脂肪比例適中，營養均衡良好。💪';
    emoji = '✅';
  } else if (proteinAvg < 60) {
    suggestion = '蛋白質攝取偏低，建議增加豆製品、肉類、雞蛋等優質蛋白來源。';
    emoji = '⚠️';
  } else {
    suggestion = '三大營養素攝取平衡，繼續保持良好的飲食習慣！';
    emoji = '👍';
  }
  
  return {
    isMultiMetric: true,
    metricsStats,
    emoji,
    suggestion,
    trend: '營養素分析',
    unit: ''
  };
}

/**
 * 生成簡化版 SVG 趨勢圖
 */
function generateSimpleTrendSVG(
  data: ChartDataPoint[],
  metric: string,
  stats: any
): string {
  const width = 1000;
  const height = 200;
  const padding = 40;
  
  // 🆕 特別處理多指標 - 繪製多條趨勢線
  if (metric === 'bodyComposition') {
    return generateMultiMetricSVG(data, ['weight', 'bodyFat', 'skeletalMuscle'], 
      ['體重', '體脂率', '骨骼肌率'], ['#5c9c84', '#f59e0b', '#2196f3'], width, height, padding);
  }
  if (metric === 'nutrition') {
    return generateMultiMetricSVG(data, ['protein', 'carb', 'fat'], 
      ['蛋白質', '碳水', '脂肪'], ['#5c9c84', '#ffbe76', '#ff7979'], width, height, padding);
  }
  
  // 單一指標的趨勢圖
  const validData = data.filter(d => d[metric as keyof ChartDataPoint] != null);
  
  if (validData.length < 2) {
    return `<div style="text-align: center; color: #9ca3af; padding: 40px;">資料點不足</div>`;
  }

  // 取值
  const values = validData.map(d => Number(d[metric as keyof ChartDataPoint]));
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const range = maxValue - minValue || 1;

  // 計算座標
  const points = values.map((value, index) => {
    const x = padding + (index / (values.length - 1)) * (width - padding * 2);
    const y = height - padding - ((value - minValue) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  // 填充區域
  const fillPoints = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`;

  return `
    <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- 背景網格 -->
      ${[0, 1, 2, 3, 4].map(i => `
        <line 
          x1="${padding}" 
          y1="${padding + i * (height - padding * 2) / 4}" 
          x2="${width - padding}" 
          y2="${padding + i * (height - padding * 2) / 4}" 
          stroke="#f0f0f0" 
          stroke-width="1"
        />
      `).join('')}
      
      <!-- 填充區域 -->
      <polygon 
        points="${fillPoints}" 
        fill="url(#gradient)" 
        opacity="0.2"
      />
      
      <!-- 趨勢線 -->
      <polyline 
        points="${points}" 
        fill="none" 
        stroke="#5c9c84" 
        stroke-width="3" 
        stroke-linecap="round" 
        stroke-linejoin="round"
      />
      
      <!-- 資料點 -->
      ${values.map((value, index) => {
        const x = padding + (index / (values.length - 1)) * (width - padding * 2);
        const y = height - padding - ((value - minValue) / range) * (height - padding * 2);
        return `
          <circle cx="${x}" cy="${y}" r="5" fill="#fff" stroke="#5c9c84" stroke-width="2.5"/>
        `;
      }).join('')}
      
      <!-- 漸層定義 -->
      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#5c9c84;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#97d0ba;stop-opacity:0.3" />
        </linearGradient>
      </defs>
      
      <!-- Y 軸刻度 -->
      <text x="${padding - 10}" y="${padding}" text-anchor="end" font-size="11" fill="#9ca3af">
        ${maxValue.toFixed(0)}${stats.unit}
      </text>
      <text x="${padding - 10}" y="${height - padding}" text-anchor="end" font-size="11" fill="#9ca3af">
        ${minValue.toFixed(0)}${stats.unit}
      </text>
    </svg>
  `;
}

/**
 * 🆕 生成多指標 SVG 趨勢圖
 */
function generateMultiMetricSVG(
  data: ChartDataPoint[],
  metrics: readonly string[],
  labels: string[],
  colors: string[],
  width: number,
  height: number,
  padding: number
): string {
  // 收集所有指標的有效數據
  const allValidData = metrics.map(metric => 
    data.filter(d => d[metric as keyof ChartDataPoint] != null)
  );
  
  // 檢查是否有足夠數據
  const hasEnoughData = allValidData.some(vd => vd.length >= 2);
  if (!hasEnoughData) {
    return `<div style="text-align: center; color: #9ca3af; padding: 40px;">資料點不足</div>`;
  }
  
  // 找出所有數據的最大最小值用於統一 Y 軸刻度
  let globalMin = Infinity;
  let globalMax = -Infinity;
  
  allValidData.forEach((validData, index) => {
    if (validData.length > 0) {
      const values = validData.map(d => Number(d[metrics[index] as keyof ChartDataPoint]));
      globalMin = Math.min(globalMin, ...values);
      globalMax = Math.max(globalMax, ...values);
    }
  });
  
  const range = globalMax - globalMin || 1;
  
  // 為每個指標生成趨勢線
  const lines = metrics.map((metric, metricIndex) => {
    const validData = allValidData[metricIndex];
    if (validData.length < 2) return '';
    
    const values = validData.map(d => Number(d[metric as keyof ChartDataPoint]));
    
    const points = values.map((value, index) => {
      const x = padding + (index / (values.length - 1)) * (width - padding * 2);
      const y = height - padding - ((value - globalMin) / range) * (height - padding * 2);
      return `${x},${y}`;
    }).join(' ');
    
    const circles = values.map((value, index) => {
      const x = padding + (index / (values.length - 1)) * (width - padding * 2);
      const y = height - padding - ((value - globalMin) / range) * (height - padding * 2);
      return `<circle cx="${x}" cy="${y}" r="4" fill="#fff" stroke="${colors[metricIndex]}" stroke-width="2"/>`;
    }).join('');
    
    return `
      <!-- ${labels[metricIndex]} -->
      <polyline 
        points="${points}" 
        fill="none" 
        stroke="${colors[metricIndex]}" 
        stroke-width="${metricIndex === 0 ? 3 : 2}" 
        stroke-linecap="round" 
        stroke-linejoin="round"
        ${metricIndex > 0 ? 'stroke-dasharray="5 5"' : ''}
      />
      ${circles}
    `;
  }).join('');
  
  // 圖例
  const legend = metrics.map((metric, index) => {
    return `
      <g transform="translate(${padding + index * 140}, ${height - 10})">
        <line x1="0" y1="0" x2="20" y2="0" stroke="${colors[index]}" stroke-width="2" ${index > 0 ? 'stroke-dasharray="5 5"' : ''}/>
        <text x="25" y="4" font-size="11" fill="#6b7280">${labels[index]}</text>
      </g>
    `;
  }).join('');
  
  return `
    <svg width="100%" height="${height + 20}" viewBox="0 0 ${width} ${height + 20}" xmlns="http://www.w3.org/2000/svg">
      <!-- 背景網格 -->
      ${[0, 1, 2, 3, 4].map(i => `
        <line 
          x1="${padding}" 
          y1="${padding + i * (height - padding * 2) / 4}" 
          x2="${width - padding}" 
          y2="${padding + i * (height - padding * 2) / 4}" 
          stroke="#f0f0f0" 
          stroke-width="1"
        />
      `).join('')}
      
      ${lines}
      
      <!-- Y 軸刻度 -->
      <text x="${padding - 10}" y="${padding}" text-anchor="end" font-size="11" fill="#9ca3af">
        ${globalMax.toFixed(0)}
      </text>
      <text x="${padding - 10}" y="${height - padding}" text-anchor="end" font-size="11" fill="#9ca3af">
        ${globalMin.toFixed(0)}
      </text>
      
      <!-- 圖例 -->
      ${legend}
    </svg>
  `;
}

/**
 * 工具函數
 */
function getPeriodLabel(period: string): string {
  const map: Record<string, string> = {
    '7d': '近 7 天',
    '30d': '近 30 天',
    '90d': '近 90 天',
    '180d': '近半年',
    '365d': '近一年'
  };
  return map[period] || '';
}

function getMetricLabel(metric: string): string {
  const map: Record<string, string> = {
    bodyComposition: '身體組成',
    weight: '體重',
    bodyFat: '體脂率',
    skeletalMuscle: '骨骼肌率',
    calories: '熱量',
    protein: '蛋白質',
    nutrition: '三大營養素'
  };
  return map[metric] || '';
}
