// src/services/foodApi.ts

export interface ScannedFood {
  name: string;
  brand?: string;
  kcal: number;      // per 100g
  protein: number;   // per 100g
  carb: number;      // per 100g
  fat: number;       // per 100g
  found: boolean;
}

// 台灣條碼通常是 EAN-13
export const fetchProductByBarcode = async (barcode: string): Promise<ScannedFood | null> => {
  try {
    // 使用 Open Food Facts 世界版 API (包含台灣資料)
    const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    const data = await response.json();

    if (data.status === 1 && data.product) {
      const p = data.product;
      const n = p.nutriments;

      // 優先抓取中文名稱，若無則抓英文
      const productName = p.product_name_zh || p.product_name_tw || p.product_name || "未知商品";

      return {
        name: productName,
        brand: p.brands,
        // 預設抓取 100g 的營養標示，比較好換算
        kcal: n['energy-kcal_100g'] || 0,
        protein: n['proteins_100g'] || 0,
        carb: n['carbohydrates_100g'] || 0,
        fat: n['fat_100g'] || 0,
        found: true
      };
    }
    return null;
  } catch (error) {
    console.error("API Error:", error);
    return null;
  }
};