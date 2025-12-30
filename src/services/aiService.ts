// src/services/aiService.ts

const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

/**
 * 分析圖片
 * @param base64Image 圖片字串 (包含 data:image/... 前綴)
 * @param apiKey Google API Key
 * @param mode 'food' = 辨識食物(預設), 'label' = 營養標示 OCR
 */
export const analyzeImage = async (
  base64Image: string, 
  apiKey: string, 
  mode: 'food' | 'label' = 'food'
): Promise<any> => {
  
  if (!apiKey) throw new Error("請先在設定頁輸入 API Key");

  // 🟢 修改 2: 自動偵測圖片格式 (MIME Type)
  // 原始字串通常是 "data:image/png;base64,......"
  const mimeTypeMatch = base64Image.match(/^data:(image\/\w+);base64,/);
  const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg"; // 預設 jpeg

  // 去除前綴，只留 base64 編碼本體
  const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

  // 1. 定義「辨識食物」的 Prompt
  const foodPrompt = `請仔細分析這張食物圖片,估計份量並計算營養素。

請以繁體中文回答,回傳一個 JSON 物件,包含以下欄位:
- name: 食物名稱(簡短明確,例如:「煎雞胸肉」、「白飯」、「番茄炒蛋」)
- estimatedWeight: 估計總重量(公克,數字,請依照圖片中的份量合理估計)
- kcal: 預估總熱量(數字,根據估計重量計算)
- protein: 預估蛋白質總克數(數字)
- carbs: 預估碳水化合物總克數(數字)
- fat: 預估脂肪總克數(數字)
- type: 食物分類(從以下選擇其一: '全穀雜糧類','豆魚蛋肉類','乳品類','蔬菜類','水果類','油脂與堅果種子類','其他')

重要提醒:
1. 請合理分配蛋白質、碳水、脂肪的比例,三者的熱量加總應該接近總熱量
2. 如果是外食或看起來有調味/油炸,請將額外的油脂熱量計入脂肪欄位
3. 提供保守但合理的估計值
4. 不要回傳 markdown 格式,只要純 JSON
5. 數值必須是數字,不要包含單位文字`;

  // 2. 定義「營養標示 OCR」的 Prompt
  const labelPrompt = `你是一個營養標示讀取助手。請分析這張圖片中的「營養標示(Nutrition Facts)」表格及包裝上的產品資訊。

請提取數據並回傳一個 JSON 物件 (繁體中文):
- name: 產品名稱 (請仔細查看包裝上的品名,例如:「巧克力餅乾」、「原味優格」、「雞胸肉」。如果圖片上看不清楚品名,請根據營養標示的特徵推測,例如:高蛋白低脂 → "蛋白質食品"、高碳水 → "穀物製品")
- servingSize: 每份重量(公克,數字,例如:標示寫「每份30公克」就填30)
- kcal: 每份熱量 (kcal,數字)
- protein: 每份蛋白質 (g,數字)
- carbs: 每份碳水化合物 (總碳水,g,數字)
- fat: 每份脂肪 (總脂肪,g,數字)

重要提醒:
1. **品名辨識優先級:** 包裝正面文字 > 營養標示旁的產品名 > 根據營養比例推測
2. **優先讀取「每份」或「每一份」的數值**
3. 如果標示上寫「每份 30 公克」,servingSize 就填 30
4. 如果標示上只有「每 100g」沒有「每份」,則 servingSize 填 100
5. 只回傳 JSON, 不要 Markdown
6. 數值只包含數字,不要單位文字

範例格式: 
- {"name":"巧克力餅乾","servingSize":30,"kcal":150,"protein":2,"carbs":20,"fat":6}
- {"name":"原味優格","servingSize":100,"kcal":60,"protein":3,"carbs":5,"fat":2}`;

  // 3. 根據模式選擇 Prompt
  const currentPrompt = mode === 'label' ? labelPrompt : foodPrompt;

  // 🟢 修改 3: 加入 safetySettings，防止 AI 誤判食物圖片為不安全內容而拒絕回答
  const payload = {
    contents: [{
      parts: [
        { text: currentPrompt },
        { inline_data: { mime_type: mimeType, data: cleanBase64 } }
      ]
    }],
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
    ]
  };

  try {
    const response = await fetch(`${API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      // 🟢 修改 4: 印出完整錯誤，方便除錯
      console.error("🔥 Google API 錯誤詳情:", JSON.stringify(data, null, 2));
      
      if (response.status === 429) {
        throw new Error("⏰ API 配額已用完,請稍後再試");
      }
      
      const errorMessage = data.error?.message || `API Error: ${response.status}`;
      throw new Error(`AI 分析失敗: ${errorMessage}`);
    }
    
    // 檢查是否有候選回應
    if (!data.candidates || data.candidates.length === 0) {
      // 有時候是因為 Safety Filter 擋住了，這裡可以印出來看
      console.warn("⚠️ AI 拒絕回答，可能是因為 Safety Filter:", data.promptFeedback);
      throw new Error("AI 無法識別此圖片 (可能是圖片不清晰或被誤判)");
    }

    const textResult = data.candidates[0].content?.parts?.[0]?.text;
    if (!textResult) throw new Error("AI 回傳了空內容");

    const jsonString = textResult.replace(/```json|```/g, '').trim();
    
    try {
  const result = JSON.parse(jsonString);
  
  // 🆕 OCR 模式:回傳「每份」格式
  if (mode === 'label') {
    return {
      name: result.name || "掃描食品",
      servingSize: Number(result.servingSize) || 100,
      kcal: Number(result.kcal) || 0,
      protein: Number(result.protein) || 0,
      carb: Number(result.carbs) || 0,
      fat: Number(result.fat) || 0,
      found: true
    };
  }
  
  // 🟢 食物辨識模式:保持原樣
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