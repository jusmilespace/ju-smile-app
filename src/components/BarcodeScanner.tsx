// src/components/BarcodeScanner.tsx
import React, { useState } from 'react';
import { useZxing } from 'react-zxing';
import { fetchProductByBarcode, ScannedFood } from '../services/foodApi';

interface Props {
  onResult: (food: ScannedFood) => void;
  onClose: () => void;
}

const BarcodeScanner: React.FC<Props> = ({ onResult, onClose }) => {
  const [status, setStatus] = useState<string>("請將條碼對準鏡頭...");
  const [isScanning, setIsScanning] = useState(true);

  const { ref } = useZxing({
    onDecodeResult: async (result) => {
      if (!isScanning) return;
      
      const code = result.getText();
      setIsScanning(false); // 暫停掃描避免重複觸發
      setStatus(`讀取到條碼：${code}，查詢中...`);

      // 1. 呼叫 API
      const food = await fetchProductByBarcode(code);

      if (food) {
        onResult(food); // 成功回傳
      } else {
        setStatus(`找不到條碼 ${code} 的資料`);
        // 這裡未來可以加入「手動建立」的邏輯
        setTimeout(() => {
            setIsScanning(true); // 3秒後重新允許掃描
            setStatus("請將條碼對準鏡頭...");
        }, 3000);
      }
    },
    // 設定限制，只讀取 EAN-13 (一般商品) 與 UPC (進口商品) 以提升準確度
    hints: new Map([['POSSIBLE_FORMATS', ['EAN_13', 'UPC_A', 'UPC_E']]]) 
  });

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
            <span style={styles.title}>掃描食物條碼</span>
            <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>
        
        <div style={styles.cameraContainer}>
            <video ref={ref} style={styles.video} />
            <div style={styles.scanLine} />
        </div>

        <p style={styles.status}>{status}</p>
      </div>
    </div>
  );
};

// 簡單的 CSS-in-JS 樣式 (符合你的品牌色)
const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  modal: {
    backgroundColor: '#f7faf9', width: '90%', maxWidth: '400px',
    borderRadius: '16px', padding: '20px', textAlign: 'center',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
  },
  header: {
    display: 'flex', justifyContent: 'space-between', marginBottom: '15px'
  },
  title: {
    fontSize: '1.2rem', fontWeight: 'bold', color: '#1f2937'
  },
  closeBtn: {
    background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#97d0ba'
  },
  cameraContainer: {
    position: 'relative', width: '100%', height: '250px', overflow: 'hidden',
    backgroundColor: '#000', borderRadius: '12px'
  },
  video: {
    width: '100%', height: '100%', objectFit: 'cover'
  },
  scanLine: {
    position: 'absolute', top: '50%', left: '10%', right: '10%', height: '2px',
    backgroundColor: '#97d0ba', boxShadow: '0 0 4px #97d0ba',
    transform: 'translateY(-50%)'
  },
  status: {
    marginTop: '15px', color: '#1f2937', fontSize: '0.9rem'
  }
};

export default BarcodeScanner;