import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { fetchProductByBarcode } from '../services/foodApi';
import type { ScannedFood } from '../services/foodApi';

interface Props {
    onResult: (food: ScannedFood) => void;
    onClose: () => void;
}

const BarcodeScanner: React.FC<Props> = ({ onResult, onClose }) => {
    const [status, setStatus] = useState("相機啟動中...");
    // 1. 使用時間戳記產生絕對唯一的 ID，避免 React 快速重刷時 ID 重複
    const scannerId = useRef(`scanner-${Date.now()}`).current;

    // 2. 用來追蹤「元件是否還掛載在畫面上」
    const isMounted = useRef(true);

    // 3. 用來存放掃描器實體
    const scannerRef = useRef<Html5Qrcode | null>(null);

    useEffect(() => {
        isMounted.current = true;
        let startPromise: Promise<void> | null = null;

        // 定義核心啟動邏輯
        const initScanner = async () => {
            // 雙重確認 DOM 元素存在
            if (!document.getElementById(scannerId)) {
                if (isMounted.current) setStatus("等待相機介面...");
                return;
            }

            // 建立實體
            const html5QrCode = new Html5Qrcode(scannerId);
            scannerRef.current = html5QrCode;

            try {
                // 儲存這個 Promise，讓 cleanup function 可以等待它完成
                startPromise = html5QrCode.start(
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
                    (decodedText) => {
                        // --- 掃描成功 ---
                        if (!isMounted.current) return;
                        handleScan(decodedText, html5QrCode);
                    },
                    (errorMessage) => {
                        // 忽略掃描雜訊
                    }
                );

                // 等待啟動完成
                await startPromise;

                // 啟動完成後，如果發現元件已經被卸載了 (React Strict Mode 常見情況)
                // 就立刻關閉它
                if (!isMounted.current) {
                    await html5QrCode.stop();
                    html5QrCode.clear();
                } else {
                    setStatus("請對準條碼");
                }

            } catch (err) {
                console.warn("相機啟動異常:", err);
                if (isMounted.current) setStatus("無法啟動 (請確認權限)");
            }
        };

        // 稍微延遲 50ms 確保 DOM 已經 render 完畢
        const timer = setTimeout(initScanner, 50);

        // --- Cleanup Function (最關鍵的修正) ---
        return () => {
            isMounted.current = false;
            clearTimeout(timer);

            const scanner = scannerRef.current;
            if (scanner) {
                // 如果 start 正在進行中，我們要等它跑完再 stop
                // 如果已經跑完，就直接 stop
                // 如果還沒開始，就不做任何事
                Promise.resolve(startPromise).then(() => {
                    if (scanner.isScanning) {
                        return scanner.stop();
                    }
                }).catch((err) => {
                    // 吃掉所有錯誤，這是防止 "Uncaught" 的最後防線
                    console.log("Cleanup error ignored:", err);
                }).finally(() => {
                    try { scanner.clear(); } catch (e) { }
                });
            }
        };
    }, []);

    const handleScan = async (code: string, scanner: Html5Qrcode) => {
        console.log("🔥 掃描到:", code);
        setStatus("處理中...");

        // 嘗試暫停，失敗則忽略
        try { scanner.pause(); } catch (e) { }

        try {
            const food = await fetchProductByBarcode(code);
            if (!isMounted.current) return;

            if (food) {
                setStatus(`✅ 找到：${food.name}`);
                // 找到後，延遲一下再回傳，讓使用者看清楚結果
                setTimeout(() => {
                    onResult(food);
                }, 500);
            } else {
                setStatus(`❌ 無此商品 (${code})`);
                setTimeout(() => {
                    if (isMounted.current) {
                        setStatus("請對準下一個...");
                        try { scanner.resume(); } catch (e) { }
                    }
                }, 2000);
            }
        } catch (err) {
            if (isMounted.current) {
                setStatus("網路錯誤，重試中");
                setTimeout(() => { try { scanner.resume(); } catch (e) { } }, 2000);
            }
        }
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <div style={styles.header}>
                    <span style={styles.title}>掃描食物條碼</span>
                    <button onClick={onClose} style={styles.closeBtn}>✕</button>
                </div>

                {/* 動態 ID */}
                <div id={scannerId} style={styles.cameraContainer}></div>

                <p style={styles.status}>{status}</p>
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
        backgroundColor: '#000', borderRadius: '8px', overflow: 'hidden',
        position: 'relative'
    },
    status: {
        marginTop: '15px', color: '#333', fontWeight: 'bold', minHeight: '24px'
    }
};

export default BarcodeScanner;