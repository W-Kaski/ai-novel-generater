// frontend/src/utils/wordCount.ts
// 共享字数统计工具函数，统一计算中文字符与英文单词数量

/**
 * 统计字符串中的中文字符数 + 英文单词数（用于中文小说字数估算）
 */
export function getChineseWordCount(str: string): number {
  if (!str) return 0;
  const chineseChars = str.match(/[\u4e00-\u9fa5]/g);
  const words = str.match(/[a-zA-Z0-9]+/g);
  return (chineseChars?.length ?? 0) + (words?.length ?? 0);
}
