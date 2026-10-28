// 生产线三方共用的数据格式。所有时间单位都是秒。

// ---------- 1. 音频分析结果：public/song/analysis.json（由 tools/analyze_audio.py 生成） ----------
export type Analysis = {
  duration: number; // 歌曲总长
  bpm: number;
  beats: number[]; // 每一拍的时间
  downbeats: number[]; // 每小节第一拍
  onsets: {t: number; strength: number}[]; // 人声（或整体）音头，strength 0..1
  energy: {hop: number; values: number[]}; // 响度曲线：第 i 个值对应 i*hop 秒，已归一化到 0..1
  sections: {start: number; end: number; label: string; energy: number}[]; // 段落（intro/verse/chorus/bridge/outro 或 A/B/C），energy 0..1
  peak: number; // 全曲能量最高点的时间（用于唯一一次 glitch 爆发）
  drums?: {kick: Hit[]; snare: Hit[]; hat: Hit[]}; // 鼓分轨里识别出的鼓点（有人声分离时才有）
};
export type Hit = {t: number; strength: number};

// ---------- 2. 歌词对齐结果：public/song/lyrics.json（由 tools/align_lyrics.py 生成） ----------
export type LyricWord = {
  text: string; // 显示文本（已去掉标记符号）
  start: number;
  end: number;
  emph: boolean; // 主词：用户在歌词里用 *word* 标记；没有标记时由导演自动挑选
  long: boolean; // 拖长音：end-start >= 1.2 秒，或用户用 word~ 标记
  lang?: 'ja' | 'en';
  chars?: {c: string; t: number}[]; // 每个字唱到的时间（逐字浮现用）
};
export type LyricLine = {
  text: string;
  start: number; // = 第一个词的 start
  end: number; // = 最后一个词的 end
  section: string; // 来自歌词里的 [verse] / [chorus] 等标签，没有就是 ''
  group?: number; // 第几个画面组（歌词里用空行分隔）
  words: LyricWord[];
};
export type Lyrics = {
  lines: LyricLine[];
  title?: string;
  artist?: string;
};

// 用户的歌词文本格式（public/song/lyrics.txt）：
//   # title: 歌名
//   # artist: 歌手
//   [chorus]              ← 段落标签，可选
//   some *words* here     ← *word* 标记主词
//   hold this note~       ← word~ 标记拖长音
//   （空行 = 换一个画面组）
