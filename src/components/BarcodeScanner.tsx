// src/components/BarcodeScanner.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { fetchProductByBarcode, ScannedFood } from '../services/foodApi';

interface Props {
  onResult: (food: ScannedFood) => void;
  onClose: () => void;
}

const BarcodeScanner: React.FC<Props> = ({ onResult, onClose }) => {
  const [status, setStatus] = useState("正在啟動相機...");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  
  // 🟢 關鍵修正：使用 ref 來追蹤「是否真的啟動完成」
  // isRunning: 意圖啟動
  // isReadyToStop: 真正啟動完成，可以被停止
  const isReadyToStop = useRef(false);

  useEffect(() => {
    // 1. 初始化
    const html5QrCode = new Html5Qrcode("reader");
    scannerRef.current = html5QrCode;
    let isMounted = true; // 確保元件還在才更新狀態

    const startScanner = async () => {
        try {
            console.log("📷 正在請求相機權限...");
            // 注意：這裡不設 isReadyToStop，因為還沒好
            
            await html5QrCode.start(
                { facingMode: "environment" },
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    formatsToSupport: [
                        Html5QrcodeSupportedFormats.EAN_13,
                        Html5QrcodeSupportedFormats.UPC_A,
                        Html5QrcodeSupportedFormats.UPC_E,
                        Html5QrcodeSupportedFormats.QR_CODE
                    ] 
                },
                async (decodedText) => {
                    // --- 成功掃描 ---
                    if (!isMounted) return;
                    console.log("🔥 掃描成功：", decodedText);
                    
                    // 暫停掃描
                    try {
                       html5QrCode.pause(); 
                    } catch (e) { /* 忽略暫停錯誤 */ }

                    setStatus(`✨ 讀取到：${decodedText}，查詢中...`);

                    try {
                        const food = await fetchProductByBarcode(decodedText);
                        if (!isMounted) return;

                        if (food) {
                            setStatus(`✅ 找到：${food.name}`);
                            setTimeout(async () => {
                                // 停止並回傳
                                try {
                                    if (html5QrCode.isScanning) {
                                       await html5QrCode.stop();
                                       html5QrCode.clear();
                                    }
                                } catch (e) { console.warn("停止失敗", e); }
                                onResult(food); 
                            }, 500);
                        } else {
                            setStatus(`❌ 無此商品 (${decodedText})`);
                            setTimeout(() => {
                                if (isMounted) {
                                    setStatus("請對準下一個條碼...");
                                    try { html5QrCode.resume(); } catch(e){}
                                }
                            }, 2000);
                        }
                    } catch (err) {
                        setStatus("網路錯誤");
                        try { html5QrCode.resume(); } catch(e){}
                    }
                },
                (errorMessage) => {
                    // 忽略掃描過程雜訊
                }
            );

            // 🟢 關鍵點：await 結束後，才標記為「可停止」
            if (isMounted) {
                isReadyToStop.current = true;
                setStatus("相機已啟動，請對準條碼");
            } else {
                // 如果啟動完成時元件已經被卸載了，立刻停止
                try {
                    await html5QrCode.stop();
                    html5QrCode.clear();
                } catch (e) { console.warn("卸載清理錯誤", e); }
            }

        } catch (err) {
            console.error("相機啟動失敗", err);
            if (isMounted) setStatus("無法啟動相機，請確認權限或刷新頁面");
        }
    };

    startScanner();

    // Cleanup: 元件關閉時停止相機
    return () => {
        isMounted = false;
        if (scannerRef.current) {
            // 🟢 只有當真正啟動完成後，才呼叫 stop
            if (isReadyToStop.current) {
                scannerRef.current.stop().then(() => {
                    try { scannerRef.current?.clear(); } catch(e){}
                }).catch(err => {
                    // 這裡 catch 住錯誤，就不會讓整個 App 崩潰
                    console.warn("相機停止時發生小錯誤 (可忽略):", err);
                });
            } else {
                // 如果還沒啟動完就關閉，只做 clear，不 call stop 以避免崩潰
                try { scannerRef.current.clear(); } catch(e){}
            }
        }
    };
  }, [onResult]);

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
            <span style={styles.title}>掃描食物條碼</span>
            <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>
        
        <div id="reader" style={styles.cameraContainer}></div>

        <p style={styles.status}>{status}</p>
        <p style={{fontSize: '12px', color: '#666', marginTop: '5px'}}>
           💡 支援：EAN-13, UPC, QR Code
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
    borderRadius: '16px', padding: '20px', textAlign: 'center',
    display: 'flex', flexDirection: 'column'
  },
  header: {
    display: 'flex', justifyContent: 'space-between', marginBottom: '10px'
  },
  title: {
    fontSize: '1.2rem', fontWeight: 'bold', color: '#333'
  },
  closeBtn: {
    background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#999'
  },
  cameraContainer: {
    width: '100%', minHeight: '300px',
    backgroundColor: '#000', borderRadius: '8px', overflow: 'hidden'
  },
  status: {
    marginTop: '15px', color: '#333', fontWeight: 'bold'
  }
};

export default BarcodeScanner;