import type {Analysis, Lyrics, LyricLine, LyricWord} from './types';

// 没有歌词时的演示模式：把拉丁占位词按音频里检测到的音头排上去，用来验证卡点和效果。
const LOREM = (
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore ' +
  'magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo ' +
  'consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint ' +
  'occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum'
).split(' ');

export const demoLyrics = (a: Analysis): Lyrics => {
  // 只取较强的音头，间隔至少 0.2 秒
  const picks: number[] = [];
  for (const o of a.onsets) {
    if (o.strength < 0.25) continue;
    if (picks.length && o.t - picks[picks.length - 1] < 0.2) continue;
    picks.push(o.t);
  }
  const lines: LyricLine[] = [];
  let cur: LyricWord[] = [];
  let wi = 0;
  const flush = () => {
    if (cur.length >= 2) {
      // 每句挑最长的词当主词
      let best = 0;
      cur.forEach((w, i) => (w.text.length >= cur[best].text.length ? (best = i) : null));
      cur[best].emph = true;
      const start = cur[0].start;
      const sec = a.sections.find((s) => start >= s.start && start < s.end);
      lines.push({text: cur.map((w) => w.text).join(' '), start, end: cur[cur.length - 1].end, section: sec?.label ?? '', words: cur});
    }
    cur = [];
  };
  for (let i = 0; i < picks.length; i++) {
    const t = picks[i];
    const next = picks[i + 1] ?? t + 1.5;
    const gap = next - t;
    const end = Math.min(t + Math.max(0.25, gap - 0.05), t + 2.5);
    cur.push({text: LOREM[wi++ % LOREM.length], start: t, end, emph: false, long: end - t >= 1.2});
    if (gap > 0.9 || cur.length >= 6) flush();
  }
  flush();
  return {lines, title: 'song title', artist: 'ARTIST NAME'};
};
