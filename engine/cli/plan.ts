// 生成编排表（不渲染）：npx tsx engine/cli/plan.ts <渲染素材目录> [种子] [wide|tall] [起始秒] [结束秒]
// 只输出时间和效果名，不输出歌词文本。
import {readFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {direct} from '../director/director';
import {demoLyrics} from '../director/demo';
import {usage} from '../director/schedule';

const [dir, seedArg = '1', aspect = 'wide', fromArg, toArg] = process.argv.slice(2);
if (!dir) {
  console.error('用法：npx tsx engine/cli/plan.ts <渲染素材目录> [种子] [wide|tall] [起始秒] [结束秒]');
  process.exit(1);
}
const read = (f: string) => JSON.parse(readFileSync(join(dir, f), 'utf-8'));
const analysis = read('analysis.json');
const lyrics = existsSync(join(dir, 'lyrics.json')) ? read('lyrics.json') : demoLyrics(analysis);
const style = existsSync(join(dir, 'style.json')) ? read('style.json') : {};
const plan = direct(lyrics, analysis, Number(seedArg), aspect === 'tall' ? 'tall' : 'wide', style.directives ?? []);
const from = fromArg ? Number(fromArg) : 0;
const to = toArg ? Number(toArg) : analysis.duration;
const shots = plan.shots.filter((s) => s.end > from && s.start < to);

const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
const rows = shots.map((s) =>
  `| ${fmt(s.start)} | ${s.id} | ${s.section}${s.sectionStart ? '★' : ''} | ${s.secEnergy.toFixed(2)} | ${s.mode === 'layout' ? s.template : s.mode}${s.wind ? '+风' : ''}${s.mode === 'strokes' ? `(${s.order === 'shuffle' ? '乱序' : '顺序'})` : ''} | ${s.accent} | ${s.entrance} | ${s.backdrop} | ${s.transIn}${s.peak ? ' ⚡' : ''} |`);
const u = usage(shots);
const line = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}×${v}`).join('  ');
console.log(`# 编排表（${fmt(from)}–${fmt(to)}，种子 ${seedArg}，${shots.length} 个镜头）\n`);
console.log('| 开始 | 镜头 | 段落 | 能量 | 浮现方式/排版 | 主词点缀 | 文字入场 | 背景处理 | 转场 |');
console.log('|---|---|---|---|---|---|---|---|---|');
console.log(rows.join('\n'));
console.log(`\n★ = 新段落第一句，⚡ = 全曲最高点\n`);
console.log(`- 主词点缀（${Object.keys(u.accent).length} 种）：${line(u.accent)}；最长连续重复 ${u.maxRun.accent}`);
console.log(`- 文字入场（${Object.keys(u.entrance).length} 种）：${line(u.entrance)}；最长连续重复 ${u.maxRun.entrance}`);
console.log(`- 背景处理（${Object.keys(u.backdrop).length} 种）：${line(u.backdrop)}；最长连续重复 ${u.maxRun.backdrop}`);
