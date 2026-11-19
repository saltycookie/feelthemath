import React from 'react';
import { Scene, SceneRendererRegistry } from '../types';
import { resolveSceneRendererEntry } from '../stepTimeline';
import { TitleBar } from './TitleBar';

export interface DemoCanvasProps {
  title: string;
  scene: Scene<any> | null;
  renderers: SceneRendererRegistry;
  isAnimating: boolean;
  onHomeClick?: () => void;
  homeHref?: string;
  onUpdateSceneState: (statePatch: Record<string, any>) => void;
  topMessage?: React.ReactNode;
  bottomMessage?: React.ReactNode;
  topMessageOpacity?: number;
  bottomMessageOpacity?: number;
  reserveTopMessage?: boolean;
  reserveBottomMessage?: boolean;
}

/**
 * Shared Demo Canvas Component:
 * Renders the title area at the top (with the "home" icon on the left and centered title)
 * and the coordinate stage below where the active Scene and optional top/bottom messages render.
 */
export const DemoCanvas: React.FC<DemoCanvasProps> = ({
  title,
  scene,
  renderers,
  isAnimating,
  onHomeClick,
  homeHref,
  onUpdateSceneState,
  topMessage,
  bottomMessage,
  topMessageOpacity = 0,
  bottomMessageOpacity = 0,
  reserveTopMessage = false,
  reserveBottomMessage = false,
}) => {
  const entry = scene ? renderers[scene.type] : undefined;
  const Renderer = entry ? resolveSceneRendererEntry(entry).renderer : null;

  let sceneStyle: React.CSSProperties | undefined;
  if (scene) {
    const duration = scene.transitionDurationMs ?? 0;
    const easing = scene.transitionEasing ?? 'cubic-bezier(0.22, 1, 0.36, 1)';
    const scale = scene.scale ?? 1;
    const hasTransform = scene.x !== 0 || scene.y !== 0 || scale !== 1;

    sceneStyle = {
      transform: hasTransform
        ? `translate3d(${scene.x}px, ${scene.y}px, 0) scale(${scale})`
        : undefined,
      opacity: scene.opacity,
      transition:
        duration > 0
          ? `transform ${duration}ms ${easing}, opacity ${duration}ms ${easing}`
          : 'none',
    };
  }

  return (
    <>
      <TitleBar title={title} onHomeClick={onHomeClick} homeHref={homeHref} />

      <div className="stage" role="region" aria-label={title}>
        {(topMessage !== undefined || reserveTopMessage) && (
          <div className="fw-msg-slot fw-msg-slot--top">
            {topMessage !== undefined && (
              <p className="fw-step-msg fw-step-msg--top" style={{ opacity: topMessageOpacity }}>
                {topMessage}
              </p>
            )}
          </div>
        )}

        <div className="fw-stage-body">
          {scene && Renderer && (
            <div
              key={scene.id}
              id={`fw-scene-${scene.id}`}
              className="fw-visual-element"
              style={sceneStyle}
              data-scene-id={scene.id}
              data-scene-type={scene.type}
              data-inactive={scene.opacity < 0.05 ? 'true' : undefined}
            >
              <Renderer
                scene={scene}
                isAnimating={isAnimating}
                updateState={onUpdateSceneState}
              />
            </div>
          )}
        </div>

        {(bottomMessage !== undefined || reserveBottomMessage) && (
          <div className="fw-msg-slot fw-msg-slot--bottom">
            {bottomMessage !== undefined && (
              <p
                className="fw-step-msg fw-step-msg--bottom"
                style={{ opacity: bottomMessageOpacity }}
              >
                {bottomMessage}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
};
