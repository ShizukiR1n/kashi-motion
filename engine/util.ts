// 纯函数工具：不依赖 Remotion / 浏览器，导演和命令行脚本（Node）都能直接用

export const isCJK = (s: string) => /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uff66-\uff9f\u3005]/.test(s);
// 视觉长度：日文一个字算 1 个字宽，英文字母算 0.5
export const vlen = (s: string) => [...s].reduce((n, ch) => n + (isCJK(ch) ? 1 : 0.5), 0);

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// 可复现的伪随机数（同一个 seed 永远得到同一个值）
export const rand = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
