import React from 'react';
import {CameraMotionBlur} from '@remotion/motion-blur';

/**
 * 按需运动模糊：只有 active=true 的帧才开启 CameraMotionBlur（每帧渲染 samples 次再叠加），
 * 其余帧直接渲染子元素，零额外开销。
 * 建议用法：active = camVelocity(frame, hits, ...) > 阈值（约 6–10），或文字在快速移动的那几帧。
 * 注意：开启时 Remotion 会在时间上偏移若干子帧重复渲染 children，children 必须是纯时间函数（本项目都是）。
 */
export const MaybeMotionBlur: React.FC<{
  active: boolean;
  samples?: number; // 默认 6；越多越顺滑、越慢
  shutterAngle?: number; // 默认 180；越大拖影越长
  children: React.ReactNode;
}> = ({active, samples = 6, shutterAngle = 180, children}) => {
  if (!active) return <>{children}</>;
  return (
    <CameraMotionBlur samples={samples} shutterAngle={shutterAngle}>
      {children}
    </CameraMotionBlur>
  );
};

/** 速度阈值的推荐值：超过就开模糊 */
export const BLUR_THRESHOLD = 7;
