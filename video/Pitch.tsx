import { useEffect, useState } from 'react';
import { AbsoluteFill, cancelRender, continueRender, delayRender, Sequence } from 'remotion';
import { SceneFade } from './kit';
import { Architecture, Close, ColdOpen, Cost, Ecosystem, Evidence, Future, Intro } from './scenes';

export const FPS = 30;

export const SCENES = [
  { id: 'cold', len: 15, node: <ColdOpen />, dark: true },
  { id: 'future', len: 18, node: <Future /> },
  { id: 'evidence', len: 13, node: <Evidence /> },
  { id: 'cost', len: 17, node: <Cost /> },
  { id: 'intro', len: 7, node: <Intro />, dark: true },
  { id: 'arch', len: 17, node: <Architecture /> },
  { id: 'eco', len: 11, node: <Ecosystem /> },
  { id: 'close', len: 9, node: <Close />, dark: true },
];

export const TOTAL_FRAMES = SCENES.reduce((sum, s) => sum + s.len * FPS, 0);

export function DomaniPitch() {
  const [handle] = useState(() => delayRender('fonts'));
  useEffect(() => {
    Promise.all([
      document.fonts.load('300 200px "Urbanist Variable"'),
      document.fonts.load('600 40px "Urbanist Variable"'),
      document.fonts.load('400 40px "DM Sans Variable"'),
      document.fonts.load('400 80px "Abril Fatface"'),
    ])
      .then(() => continueRender(handle))
      .catch((err) => cancelRender(err));
  }, [handle]);

  let from = 0;
  return (
    <AbsoluteFill style={{ background: '#15120e', fontFamily: 'var(--body)', color: '#15120e' }}>
      {SCENES.map((scene) => {
        const start = from;
        from += scene.len * FPS;
        return (
          <Sequence key={scene.id} name={scene.id} from={start} durationInFrames={scene.len * FPS} premountFor={FPS}>
            <SceneFade len={scene.len} dark={scene.dark}>{scene.node}</SceneFade>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
