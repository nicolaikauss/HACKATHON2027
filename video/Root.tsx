import { Composition } from 'remotion';
import { DomaniPitch, FPS, TOTAL_FRAMES } from './Pitch';

export const Root = () => (
  <Composition id="DomaniPitch" component={DomaniPitch} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1920} height={1080} />
);
