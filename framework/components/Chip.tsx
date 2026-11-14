import { useRef } from 'react';
import { clamp01 } from '../math';
import { useMeasure } from '../useMeasure';

export type ChipColour = 'blue' | 'orange' | 'pink' | 'ink';

export interface ChipProps {
  colour: ChipColour;
  /** the chip's centre */
  cx: number;
  cy: number;
  text: string;
  opacity: number;
  /** the narrowest the chip may be; by default room for the text at about 8px a character */
  minWidth?: number;
}

/** A small label marking a known value on an axis (theme.css draws it). It is as wide as its text needs. */
export function Chip({ colour, cx, cy, text, opacity, minWidth }: ChipProps) {
  const textRef = useRef<SVGTextElement | null>(null);
  const textWidth = useMeasure(
    textRef,
    () => textRef.current?.getComputedTextLength() || 0,
    0,
    [text]
  );
  const w = Math.max(minWidth || 14 + 8 * text.length, textWidth + 14);
  return (
    <g className={'chip ' + colour} opacity={clamp01(opacity)}>
      <rect height={22} x={cx - w / 2} y={cy - 11} width={w} />
      <text ref={textRef} x={cx} y={cy + 4.8}>
        {text}
      </text>
    </g>
  );
}
