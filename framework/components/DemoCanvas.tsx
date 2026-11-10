import React from 'react';
import { ElementRendererRegistry, ElementsMap } from '../types';
import { TitleBar } from './TitleBar';

export interface DemoCanvasProps {
  title: string;
  elements: ElementsMap;
  renderers: ElementRendererRegistry;
  isAnimating: boolean;
  onHomeClick?: () => void;
  homeHref?: string;
  onUpdateElementState: (elementId: string, statePatch: Record<string, any>) => void;
}

/**
 * Shared Demo Canvas Component (Requirement 2):
 * Renders the title area at the top (with the "home" icon on the left and centered title)
 * and the coordinate stage below where all active VisualElements are positioned and animated.
 */
export const DemoCanvas: React.FC<DemoCanvasProps> = ({
  title,
  elements,
  renderers,
  isAnimating,
  onHomeClick,
  homeHref,
  onUpdateElementState,
}) => {
  const elementList = Object.values(elements);

  return (
    <>
      <TitleBar title={title} onHomeClick={onHomeClick} homeHref={homeHref} />

      <div className="stage" role="region" aria-label={title}>
        {elementList.map((el) => {
          const Renderer = renderers[el.type];
          if (!Renderer) {
            return null;
          }

          const duration = el.transitionDurationMs ?? 0;
          const easing = el.transitionEasing ?? 'cubic-bezier(0.22, 1, 0.36, 1)';
          const scale = el.scale ?? 1;
          const hasTransform = el.x !== 0 || el.y !== 0 || scale !== 1;

          const style: React.CSSProperties = {
            transform: hasTransform
              ? `translate3d(${el.x}px, ${el.y}px, 0) scale(${scale})`
              : undefined,
            opacity: el.opacity,
            transition:
              duration > 0
                ? `transform ${duration}ms ${easing}, opacity ${duration}ms ${easing}`
                : 'none',
          };

          return (
            <div
              key={el.id}
              id={`fw-element-${el.id}`}
              className="fw-visual-element"
              style={style}
              data-element-id={el.id}
              data-element-type={el.type}
              data-inactive={el.opacity < 0.05 ? 'true' : undefined}
            >
              <Renderer
                element={el}
                isAnimating={isAnimating}
                updateState={(patch) => onUpdateElementState(el.id, patch)}
              />
            </div>
          );
        })}
      </div>
    </>
  );
};
