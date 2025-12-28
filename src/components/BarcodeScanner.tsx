// src/components/BarcodeScanner.tsx
import React, { useState } from 'react';
import { useZxing } from 'react-zxing';
import { BarcodeFormat } from '@zxing/library'; // 確保有安裝 @zxing/library (react-zxing 的依賴)
import { fetchProductByBarcode, ScannedFood } from '../services/foodApi';

interface Props {
  onResult: (food: ScannedFood) => void;
  onClose: () => void;
}

const BarcodeScanner: React.FC<Props> = ({ onResult, onClose }) => {
  const [status, setStatus] = useState<string>("請將條碼置於框線內，保持穩定...");
  const [isScanning, setIsScanning] = useState(true);

  const { ref } = useZxing({
    // 關鍵修正 1：鎖定只掃描常見的食品條碼格式 (EAN-13, UPC)，大幅提升準確度
    hints: new Map([
      ['POSSIBLE_FORMATS', [BarcodeFormat.EAN_13, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]]
    ]),
    // 關鍵修正 2：強制使用高解析度與後鏡頭
    constraints: {
      video: {
        facingMode: 'environment', // 強制後鏡頭
        width: { min: 640, ideal: 1280, max: 1920 }, // 提高解析度
        height: { min: 480, ideal: 720, max: 1080 },
        // @ts-ignore: focusMode 某些瀏覽器支援但 TS 可能沒定義
        focusMode: 'continuous' 
      }
    },
    timeBetweenDecodingAttempts: 300, // 每 0.3 秒解碼一次，避免手機過熱
    onDecodeResult: async (result) => {
      if (!isScanning) return;
      
      const code = result.getText();
      setIsScanning(false); // 暫停掃描
      setStatus(`✨ 掃描成功！條碼：${code}`);

      try {
        const food = await fetchProductByBarcode(code);
        if (food) {
          setStatus(`✅ 找到商品：${food.name}`);
          setTimeout(() => onResult(food), 500); // 延遲一下讓用戶看到成功訊息
        } else {
          setStatus(`❌ 資料庫無此商品 (${code})`);
          // 2秒後重啟掃描
          setTimeout(() => {
            setIsScanning(true);
            setStatus("請將條碼置於框線內...");
          }, 2000);
        }
      } catch (err) {
        setStatus("網路查詢失敗，請稍後再試");
        setTimeout(() => setIsScanning(true), 2000);
      }
    },
    onError: (err) => {
        // 忽略雜訊錯誤
    }
  });

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
            <span style={styles.title}>掃描食物條碼</span>
            <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>
        
        <div style={styles.cameraContainer}>
            <video ref={ref} style={styles.video} />
            {/* 掃描紅線：改成掃描框，視覺上比較好對準 */}
            <div style={styles.scanBox}>
               <div style={styles.scanLine} />
            </div>
        </div>

        <p style={styles.status}>{status}</p>
        <p style={{fontSize: '12px', color: '#999', marginTop: '4px'}}>
          💡 若掃描不到，請前後移動手機調整距離
        </p>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999,
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  modal: {
    backgroundColor: '#fff', width: '90%', maxWidth: '400px',
    borderRadius: '16px', padding: '20px', textAlign: 'center'
  },
  header: {
    display: 'flex', justifyContent: 'space-between', marginBottom: '15px'
  },
  title: {
    fontSize: '1.2rem', fontWeight: 'bold', color: '#333'
  },
  closeBtn: {
    background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#999'
  },
  cameraContainer: {
    position: 'relative', width: '100%', height: '300px', // 加高一點
    backgroundColor: '#000', borderRadius: '12px', overflow: 'hidden'
  },
  video: {
    width: '100%', height: '100%', objectFit: 'cover'
  },
  scanBox: {
    position: 'absolute', top: '50%', left: '50%', 
    transform: 'translate(-50%, -50%)',
    width: '70%', height: '50%', 
    border: '2px solid rgba(255,255,255,0.7)', 
    borderRadius: '8px',
    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)' // 這會讓框框外變暗，凸顯掃描區
  },
  scanLine: {
    width: '100%', height: '2px', backgroundColor: 'red',
    position: 'absolute', top: '50%',
    boxShadow: '0 0 4px red'
  },
  status: {
    marginTop: '15px', color: '#333', fontWeight: 'bold'
  }
};

export default BarcodeScanner;