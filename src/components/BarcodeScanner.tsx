import React, { useState } from 'react';
import { useZxing } from 'react-zxing';
import { fetchProductByBarcode, ScannedFood } from '../services/foodApi';

interface Props {
  onResult: (food: ScannedFood) => void;
  onClose: () => void;
}

const BarcodeScanner: React.FC<Props> = ({ onResult, onClose }) => {
  // 顯示在畫面上的狀態文字
  const [status, setStatus] = useState<string>("請將條碼對準鏡頭...");
  const [isScanning, setIsScanning] = useState(true);

  const { ref } = useZxing({
    // 移除 hints 限制，讓它能掃描所有類型條碼，提高成功率
    onDecodeResult: async (result) => {
      if (!isScanning) return;
      
      const code = result.getText();
      console.log("📸 掃描成功！條碼內容：", code); // <--- 在 Console 顯示
      
      setIsScanning(false); // 暫停掃描
      setStatus(`讀取到條碼：${code}，查詢資料庫中...`);

      try {
        // 呼叫 API
        const food = await fetchProductByBarcode(code);
        console.log("📦 API 回傳結果：", food); // <--- 在 Console 顯示

        if (food) {
          setStatus(`成功！找到：${food.name}`);
          // 延遲一下讓使用者看到成功訊息，再關閉
          setTimeout(() => {
             onResult(food);
          }, 500);
        } else {
          setStatus(`❌ 資料庫找不到條碼 ${code}`);
          console.warn("找不到商品");
          
          // 3秒後重新允許掃描
          setTimeout(() => {
            setIsScanning(true); 
            setStatus("請將條碼對準鏡頭...");
          }, 3000);
        }
      } catch (err) {
        console.error("API 發生錯誤", err);
        setStatus("查詢發生錯誤，請重試");
        setTimeout(() => setIsScanning(true), 3000);
      }
    },
    onError: (err) => {
      // 忽略單純的「未發現條碼」錯誤，避免 console 被洗版
      if (err.name !== 'NotFoundException') {
         console.log("Scanner error:", err);
      }
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
            {/* 掃描紅線視覺效果 */}
            <div style={styles.scanLine} />
        </div>

        <p style={{
            marginTop: '15px', 
            color: status.includes('❌') ? 'red' : '#1f2937', 
            fontSize: '1rem',
            fontWeight: 'bold',
            padding: '0 10px'
        }}>
            {status}
        </p>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999, // 確保最上層
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
    backgroundColor: 'red', boxShadow: '0 0 4px red',
    transform: 'translateY(-50%)'
  }
};

export default BarcodeScanner;