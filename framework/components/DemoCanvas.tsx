import React from 'react';
import { SceneRendererRegistry, ScenesMap } from '../types';
import { resolveSceneRendererEntry } from '../stepTimeline';
import { TitleBar } from './TitleBar';

export interface DemoCanvasProps {
  title: string;
  scenes: ScenesMap;
  renderers: SceneRendererRegistry;
  isAnimating: boolean;
  onHomeClick?: () => void;
  homeHref?: string;
  onUpdateSceneState: (sceneId: string, statePatch: Record<string, any>) => void;
}

/**
 * Shared Demo Canvas Component:
 * Renders the title area at the top (with the "home" icon on the left and centered title)
 * and the coordinate stage below where the active Scene is positioned and animated.
 */
export const DemoCanvas: React.FC<DemoCanvasProps> = ({
  title,
  scenes,
  renderers,
  isAnimating,
  onHomeClick,
  homeHref,
  onUpdateSceneState,
}) => {
  const sceneList = Object.values(scenes);

  return (
    <>
      <TitleBar title={title} onHomeClick={onHomeClick} homeHref={homeHref} />

      <div className="stage" role="region" aria-label={title}>
        {sceneList.map((sc) => {
          const entry = renderers[sc.type];
          if (!entry) {
            return null;
          }
          const Renderer = resolveSceneRendererEntry(entry).renderer;

          const duration = sc.transitionDurationMs ?? 0;
          const easing = sc.transitionEasing ?? 'cubic-bezier(0.22, 1, 0.36, 1)';
          const scale = sc.scale ?? 1;
          const hasTransform = sc.x !== 0 || sc.y !== 0 || scale !== 1;

          const style: React.CSSProperties = {
            transform: hasTransform
              ? `translate3d(${sc.x}px, ${sc.y}px, 0) scale(${scale})`
              : undefined,
            opacity: sc.opacity,
            transition:
              duration > 0
                ? `transform ${duration}ms ${easing}, opacity ${duration}ms ${easing}`
                : 'none',
          };

          return (
            <div
              key={sc.id}
              id={`fw-scene-${sc.id}`}
              className="fw-visual-element"
              style={style}
              data-scene-id={sc.id}
              data-scene-type={sc.type}
              data-inactive={sc.opacity < 0.05 ? 'true' : undefined}
            >
              <Renderer
                scene={sc}
                isAnimating={isAnimating}
                updateState={(patch) => onUpdateSceneState(sc.id, patch)}
              />
            </div>
          );
        })}
      </div>
    </>
  );
};
