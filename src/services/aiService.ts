// src/services/aiService.ts

const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export const analyzeImage = async (base64Image: string, apiKey: string): Promise<any> => {
  if (!apiKey) throw new Error("請先在設定頁輸入 API Key");

  const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

  const payload = {
    contents: [{
      parts: [
        { 
          text: `請仔細分析這張食物圖片,估計份量並計算營養素。

請以繁體中文回答,回傳一個 JSON 物件,包含以下欄位:
- name: 食物名稱(簡短明確,例如:「煎雞胸肉」、「白飯」、「番茄炒蛋」)
- estimatedWeight: 估計總重量(公克,數字,請依照圖片中的份量合理估計)
- kcal: 預估總熱量(數字,根據估計重量計算)
- protein: 預估蛋白質總克數(數字)
- carbs: 預估碳水化合物總克數(數字)
- fat: 預估脂肪總克數(數字)
- type: 食物分類(從以下選擇其一: '全穀雜糧類','豆魚蛋肉類','乳品類','蔬菜類','水果類','油脂與堅果種子類','其他')

重要提醒:
1. 請合理分配蛋白質、碳水、脂肪的比例,三者的熱量加總應該接近總熱量 (蛋白質和碳水每克4kcal,脂肪每克9kcal)
2. 如果是外食或看起來有調味/油炸,請將額外的油脂熱量計入脂肪欄位
3. 提供保守但合理的估計值
4. 不要回傳 markdown 格式,只要純 JSON
5. 數值必須是數字,不要包含單位文字

範例格式: {"name":"煎雞胸肉","estimatedWeight":150,"kcal":220,"protein":33,"carbs":0,"fat":8,"type":"豆魚蛋肉類"}` 
        },
        { inline_data: { mime_type: "image/jpeg", data: cleanBase64 } }
      ]
    }]
  };

  try {
    const response = await fetch(`${API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("🔥 Google API 錯誤詳情:", JSON.stringify(data, null, 2));
      
      if (response.status === 429) {
        throw new Error("⏰ API 配額已用完,請稍後再試");
      }
      
      const errorMessage = data.error?.message || `API Error: ${response.status}`;
      throw new Error(errorMessage);
    }
    
    const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResult) throw new Error("AI 回傳了空內容");

    const jsonString = textResult.replace(/```json|```/g, '').trim();
    
    try {
      const result = JSON.parse(jsonString);
      return {
        name: result.name || "未知食物",
        estimatedWeight: Number(result.estimatedWeight) || 0,
        kcal: Number(result.kcal) || 0,
        protein: Number(result.protein) || 0,
        carbs: Number(result.carbs) || 0,
        fat: Number(result.fat) || 0,
        type: result.type || "其他"
      };
    } catch (e) {
      console.error("JSON Parse Error:", jsonString);
      throw new Error("AI 回傳格式錯誤,請重試");
    }

  } catch (error) {
    console.error("AI Scan Error:", error);
    if (error instanceof Error) {
        throw error;
    } else {
        throw new Error("連線發生未預期錯誤");
    }
  }
};