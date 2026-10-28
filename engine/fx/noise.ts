// 平滑一维噪声（值噪声 + 余弦插值），纯函数，可复现
import {rand} from '../lib';

export const noise1 = (x: number, seed = 0) => {
  const i = Math.floor(x);
  const f = x - i;
  const a = rand(i * 1.37 + seed * 91.1) * 2 - 1;
  const b = rand((i + 1) * 1.37 + seed * 91.1) * 2 - 1;
  const t = (1 - Math.cos(f * Math.PI)) / 2;
  return a + (b - a) * t;
};

// 多层叠加的平滑噪声，输出约在 -1..1
export const fbm1 = (x: number, seed = 0) =>
  noise1(x, seed) * 0.6 + noise1(x * 2.1, seed + 7) * 0.3 + noise1(x * 4.3, seed + 13) * 0.1;

// 把任意字符串变成稳定的数字 id（用于 SVG filter 的唯一 id）
export const hashId = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
};
