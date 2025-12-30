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
// 🆕 新增「每份」資料結構
export interface ServingBasedFood {
  name: string;
  brand?: string;
  servingSize: number;  // 每份重量(g)
  kcal: number;         // 每份熱量
  protein: number;      // 每份蛋白質
  carb: number;         // 每份碳水
  fat: number;          // 每份脂肪
  found: boolean;
  dataType: 'serving' | 'per100g';  // 🆕 標記資料類型
}

export const fetchProductByBarcode = async (barcode: string): Promise<ServingBasedFood | null> => {
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    const data = await response.json();

    if (data.status === 1 && data.product) {
      const p = data.product;
      const n = p.nutriments;

      const productName = p.product_name_zh || p.product_name_tw || p.product_name || "未知商品";

      // 🆕 優先嘗試取得「每份」資料
      const servingSize = parseFloat(p.serving_size) || null;
      const hasServingData = servingSize && 
        (n['energy-kcal_serving'] || n['proteins_serving'] || n['carbohydrates_serving'] || n['fat_serving']);

      if (hasServingData) {
        // ✅ 有「每份」資料,優先使用
        return {
          name: productName,
          brand: p.brands,
          servingSize: servingSize,
          kcal: n['energy-kcal_serving'] || 0,
          protein: n['proteins_serving'] || 0,
          carb: n['carbohydrates_serving'] || 0,
          fat: n['fat_serving'] || 0,
          found: true,
          dataType: 'serving'
        };
      } else {
        // ⚠️ 沒有「每份」資料,使用「每 100g」
        return {
          name: productName,
          brand: p.brands,
          servingSize: 100,  // 預設 100g
          kcal: n['energy-kcal_100g'] || 0,
          protein: n['proteins_100g'] || 0,
          carb: n['carbohydrates_100g'] || 0,
          fat: n['fat_100g'] || 0,
          found: true,
          dataType: 'per100g'
        };
      }
    }
    return null;
  } catch (error) {
    console.error("API Error:", error);
    return null;
  }
};