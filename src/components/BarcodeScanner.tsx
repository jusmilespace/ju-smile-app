// src/components/BarcodeScanner.tsx
import React, { useState } from 'react';
import { useZxing } from 'react-zxing';
import { fetchProductByBarcode, ScannedFood } from '../services/foodApi';

interface Props {
  onResult: (food: ScannedFood) => void;
  onClose: () => void;
}

const BarcodeScanner: React.FC<Props> = ({ onResult, onClose }) => {
  const [status, setStatus] = useState<string>("相機啟動中，請對準條碼...");
  const [isScanning, setIsScanning] = useState(true);

  const { ref } = useZxing({
    // 🟢 修改 1：不設定 hints，讓它掃描所有類型的條碼 (QR Code 也會掃到，用來測試相機有沒有在工作)
    
    // 🟢 修改 2：簡化相機設定，使用預設值，提高相容性
    constraints: {
      video: {
        facingMode: 'environment' // 後鏡頭
      }
    },
    
    // 設定解碼間隔 (毫秒)，太快會耗電，太慢會覺得頓
    timeBetweenDecodingAttempts: 300,

    onDecodeResult: async (result) => {
      if (!isScanning) return;
      
      const code = result.getText();
      // 只要掃到任何東西 (包含 QR Code)，先顯示出來，確認功能正常
      console.log("📸 掃到東西了！內容：", code);
      
      // 過濾：我們只處理數字 (商品條碼通常是純數字)
      // 這樣可以避免掃到發票 QR Code 跳出錯誤
      if (!/^\d+$/.test(code)) {
        setStatus(`⚠️ 掃到非商品條碼 (${code})，請對準食品包裝...`);
        return;
      }

      setIsScanning(false);
      setStatus(`✨ 讀取成功！條碼：${code}`);

      try {
        const food = await fetchProductByBarcode(code);
        if (food) {
          setStatus(`✅ 找到商品：${food.name}`);
          setTimeout(() => onResult(food), 500);
        } else {
          setStatus(`❌ 資料庫無此商品 (${code})`);
          setTimeout(() => {
            setIsScanning(true);
            setStatus("請對準下一個商品...");
          }, 2000);
        }
      } catch (err) {
        setStatus("網路錯誤，請重試");
        setTimeout(() => setIsScanning(true), 2000);
      }
    },
    onError: (err) => {
      // 這裡會一直觸發是正常的 (代表每一幀畫面都沒掃到條碼)
      // 如果完全沒反應，可以打開 F12 看這裡有沒有報錯
    }
  });

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
            <span style={styles.title}>掃描測試模式</span>
            <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>
        
        <div style={styles.cameraContainer}>
            <video ref={ref} style={styles.video} />
            {/* 掃描框框 */}
            <div style={styles.scanBox} />
            <div style={styles.scanLine} />
        </div>

        <p style={styles.status}>{status}</p>
        <p style={{fontSize: '13px', color: '#666', marginTop: '8px'}}>
           💡 測試技巧：請前後移動手機 (距離 15~30 公分)
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
    position: 'relative', width: '100%', height: '300px',
    backgroundColor: '#000', borderRadius: '12px', overflow: 'hidden'
  },
  video: {
    width: '100%', height: '100%', objectFit: 'cover'
  },
  scanBox: {
    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
    width: '70%', height: '40%', border: '2px solid rgba(255,255,255,0.8)', borderRadius: '8px'
  },
  scanLine: {
    position: 'absolute', top: '50%', left: '15%', right: '15%', height: '2px',
    backgroundColor: 'red', boxShadow: '0 0 4px red'
  },
  status: {
    marginTop: '15px', color: '#333', fontWeight: 'bold', fontSize: '1.1rem'
  }
};

export default BarcodeScanner;