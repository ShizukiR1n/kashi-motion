import React from 'react';
import {AbsoluteFill, Easing, useCurrentFrame} from 'remotion';
import {Background, Grain, Vignette} from '../components/Fx';
import {Word} from '../components/Word';
import {FPS, kf} from '../lib';
import {CameraRig, camVelocity, Hit} from './CameraRig';
import {FlickerIn, LetterDistort, SlideBlur, Slam} from './Entrances';
import {BLUR_THRESHOLD, MaybeMotionBlur} from './MotionBlur';
import {AmbientDust, ParticleBurst, ParticleSwirl} from './Particles';

// 效果库演示（竖屏 1080×1920，10 秒）。画面上只用拉丁占位词。

// 冲击点：每个词入场一次重击 + 每半拍一个轻击 + 逐字母时的小击
const HITS: Hit[] = [
  ...Array.from({length: 20}, (_, i) => ({t: i * 0.5, strength: 0.16})),
  {t: 1.0, strength: 1.25},
  {t: 3.0, strength: 0.9},
  {t: 5.0, strength: 1.0},
  ...Array.from({length: 10}, (_, i) => ({t: 7.0 + i * 0.07, strength: 0.32})),
  {t: 9.0, strength: 1.3},
].sort((a, b) => a.t - b.t);

// 8.6–9.15 秒的甩镜头：快速甩出，再从另一侧甩进新的词
const whip = (t: number) => {
  const fr = t * FPS;
  if (t < 8.6 || t > 9.2) return {};
  const tx = t < 8.86
    ? kf(fr, [[8.6, 0], [8.86, -1250]], Easing.in(Easing.cubic))
    : kf(fr, [[8.86, 1250], [9.15, 0]], Easing.out(Easing.cubic));
  return {tx, rot: tx * -0.004};
};

export const FxDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const vel = camVelocity(frame, HITS, 1, whip);
  const fastMove = vel > BLUR_THRESHOLD;

  return (
    <AbsoluteFill style={{background: '#1a0d14', overflow: 'hidden'}}>
      {/* 背景原图是横屏尺寸，放大铺满竖屏 */}
      <AbsoluteFill style={{transform: 'scale(2.3)', transformOrigin: '30% 0%'}}>
        <Background />
      </AbsoluteFill>
      <AmbientDust count={110} bokeh={12} />

      <MaybeMotionBlur active={fastMove} samples={8} shutterAngle={220}>
        <CameraRig hits={HITS} wiggle={1} extra={whip}>
          {/* 1. 重砸 */}
          {t < 2.9 && (
            <ParticleSwirl x={150} y={700} w={780} h={240} at={1.0} dur={1.5} seed={1}>
              <Slam id="w1" text="LOREM" x={540} y={820} size={230} at={1.0} anchor="center" glow={1} ca={3} out={2.6} outDur={0.25} />
            </ParticleSwirl>
          )}
          <ParticleBurst x={540} y={820} at={1.0} seed={11} />

          {/* 2. 闪烁 */}
          {t >= 2.9 && t < 4.9 && (
            <ParticleSwirl x={270} y={890} w={540} h={220} at={3.0} dur={1.4} seed={2} count={110}>
              <FlickerIn id="w2" text="ipsum" x={540} y={1000} size={200} at={3.0} anchor="center" glow={0.9} out={4.6} outDur={0.25} />
            </ParticleSwirl>
          )}
          <ParticleBurst x={540} y={1000} at={3.0} seed={12} count={50} />

          {/* 3. 滑入 + 方向模糊 */}
          {t >= 4.9 && t < 6.9 && (
            <ParticleSwirl x={180} y={790} w={540} h={220} at={5.1} dur={1.3} seed={3} count={110}>
              <SlideBlur id="w3" text="dolor" x={180} y={900} size={210} at={5.0} glow={0.9} dist={420} out={6.6} outDur={0.25} />
            </ParticleSwirl>
          )}

          {/* 4. 竖排逐字母 + 扭曲，粒子轨道竖着绕 */}
          {t >= 6.9 && t < 8.86 && (
            <ParticleSwirl x={455} y={400} w={170} h={1010} at={7.0} dur={1.8} seed={4} count={170} tilt={90}>
              <LetterDistort id="w4" text="voluptates" x={540} y={400} size={170} vertical at={7.0} stagger={0.07} glow={1} ca={2.5} />
            </ParticleSwirl>
          )}
          <ParticleBurst x={540} y={620} at={7.0} seed={14} spread={1.4} count={50} />

          {/* 5. 甩镜头进来的词（这几帧开运动模糊） */}
          {t >= 8.86 && (
            <ParticleSwirl x={270} y={840} w={540} h={240} at={9.0} dur={1.2} seed={5}>
              <Word text="amet" x={540} y={960} size={260} at={8.86} stagger={0} letterDur={0.05} anchor="center" glow={1.1} ca={3} />
            </ParticleSwirl>
          )}
          <ParticleBurst x={540} y={960} at={9.0} seed={15} speed={1200} />
        </CameraRig>
      </MaybeMotionBlur>

      <AbsoluteFill style={{transform: 'scale(2.7)', transformOrigin: '0 0'}}>
        <Grain />
      </AbsoluteFill>
      <Vignette />
    </AbsoluteFill>
  );
};
