import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jusmile.app',
  appName: 'Ju Smile',
  webDir: 'dist',
  ios: {
    // 🔧 iOS 專屬配置
    contentInset: 'automatic',
    // 🔐 權限說明（永久保留，不會被 sync 覆蓋）
    infoPlist: {
      NSCameraUsageDescription: 'Ju Smile 需要使用相機來辨識食物照片與掃描營養標示，幫助您快速記錄飲食。',
      NSPhotoLibraryUsageDescription: 'Ju Smile 需要存取您的相簿以選擇食物照片進行 AI 辨識，所有照片僅用於即時分析，不會儲存。',
      NSPhotoLibraryAddUsageDescription: 'Ju Smile 需要儲存照片權限以便您保存飲食記錄。'
    }
  }
};

export default config;