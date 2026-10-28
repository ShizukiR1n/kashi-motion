// 导演和效果库（engine/fx/）之间的接口层
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {BLUR_THRESHOLD, MaybeMotionBlur} from '../fx/MotionBlur';
import {camVelocity, CameraRig as Rig, Hit} from '../fx/CameraRig';
import {ParticleBurst, ParticleSwirl} from '../fx/Particles';
import type {Shot} from '../director/director';

// 镜头：基础推拉（导演给的 tx/ty/s/rot）+ 冲击与漂移（效果库）+ 快速运动时的运动模糊
export const CameraRig: React.FC<{
  hits: Hit[]; wiggle: number; motionBlur: boolean;
  base: {tx: number; ty: number; s: number; rot: number}; children: React.ReactNode;
}> = ({hits, wiggle, motionBlur, base, children}) => {
  const frame = useCurrentFrame();
  const fast = motionBlur && camVelocity(frame, hits, wiggle) > BLUR_THRESHOLD;
  return (
    <MaybeMotionBlur active={fast} samples={5}>
      <AbsoluteFill style={{transform: `translate(${base.tx}px,${base.ty}px) scale(${base.s}) rotate(${base.rot}deg)`}}>
        <Rig hits={hits} wiggle={wiggle}>{children}</Rig>
      </AbsoluteFill>
    </MaybeMotionBlur>
  );
};

// 主词周围的粒子：缠绕 + 出现瞬间的爆散。amount 为风格里的粒子数量倍数
export const Particles: React.FC<{shot: Shot; amount: number}> = ({shot, amount}) => {
  const b = shot.mainBox;
  const vertical = b.h > b.w * 1.3;
  const dur = Math.max(1.2, Math.min(4, b.end - b.at));
  const strong = shot.energy > 0.55 || shot.long;
  return (
    <>
      <ParticleSwirl x={b.x} y={b.y} w={b.w} h={b.h} at={b.at} dur={dur} count={Math.round((strong ? 150 : 90) * amount)}
        seed={shot.id * 7 + 1} intensity={strong ? 1.15 : 0.85} tilt={vertical ? 90 : 0} layer="both" />
      <ParticleBurst x={b.x + b.w / 2} y={b.y + b.h / 2} at={b.at} count={Math.round((strong ? 80 : 45) * amount)}
        speed={strong ? 1000 : 700} seed={shot.id * 13 + 5} spread={vertical ? 1 : 0.7} />
    </>
  );
};
