// The product film on the landing page. It grows into place as the visitor scrolls to it,
// starts by itself without sound when it is in view, and pauses when it leaves.
import { motion, useScroll, useTransform } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './parts';

const SRC = '/film/nexi-agent-demo.mp4';
const POSTER = '/film/poster.webp';

export function FilmSection() {
  const section = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const [muted, setMuted] = useState(true);

  // 0 when the section top enters at the bottom of the screen, 1 when the film is centred.
  const { scrollYProgress } = useScroll({ target: section, offset: ['start end', 'center center'] });
  const scale = useTransform(scrollYProgress, [0, 1], [0.8, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [90, 0]);
  const radius = useTransform(scrollYProgress, [0, 1], [44, 22]);
  const head = useTransform(scrollYProgress, [0.35, 0.9], [0, 1]);

  useEffect(() => {
    const el = section.current;
    const v = video.current;
    if (!el || !v) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // The 5 MB file starts to download only when the visitor is close to the film.
    const load = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      setNear(true);
      load.disconnect();
    }, { rootMargin: '900px 0px' });
    const play = new IntersectionObserver(([e]) => {
      if (e.intersectionRatio >= 0.6 && !still) void v.play().catch(() => undefined);
      else if (e.intersectionRatio < 0.25) v.pause();
    }, { threshold: [0, 0.25, 0.6] });
    load.observe(el);
    play.observe(v);
    return () => {
      load.disconnect();
      play.disconnect();
    };
  }, []);

  const soundOn = () => {
    const v = video.current;
    if (!v) return;
    v.muted = false;
    v.currentTime = 0;
    setMuted(false);
    void v.play().catch(() => undefined);
  };

  return (
    <section ref={section} className="section film-section" id="film">
      <motion.header className="section-head" style={{ opacity: head }}>
        <p className="eyebrow">The film · 57 seconds</p>
        <h2>See the agent set up, pay, ask first and stop.</h2>
      </motion.header>
      <motion.div className="film-card" style={{ scale, y, borderRadius: radius }}>
        <video
          ref={video}
          src={near ? SRC : undefined}
          poster={POSTER}
          muted={muted}
          controls={!muted}
          playsInline
          loop={muted}
          preload={near ? 'auto' : 'none'}
          aria-label="Product film: Nexi agent payments, 57 seconds, with voice-over and captions"
        />
        {muted && (
          <button className="film-sound" onClick={soundOn}>
            <Icon name="volume" size={18} />Play with sound
          </button>
        )}
      </motion.div>
      <p className="film-note">Voice made with AI. People and shops are made up. <a className="link" href="#/film">Open the film as a live page</a></p>
    </section>
  );
}
