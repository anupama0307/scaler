import ExperienceShell from '@/components/ExperienceShell';

// Particles spread across the FULL width, with negative delays so they are
// already distributed across the whole page on load (not clustered on one side).
const PARTICLE_COLORS = [
  'radial-gradient(circle, rgba(34,211,238,0.9) 0%, rgba(34,211,238,0) 70%)',
  'radial-gradient(circle, rgba(99,102,241,0.9) 0%, rgba(99,102,241,0) 70%)',
  'radial-gradient(circle, rgba(45,212,191,0.9) 0%, rgba(45,212,191,0) 70%)',
];

const PARTICLES = Array.from({ length: 22 }).map((_, i) => {
  // Even horizontal spread from ~3% to ~97% with a little jitter
  const left = 3 + (94 * i) / 21 + ((i % 3) - 1) * 1.5;
  const size = 3 + ((i * 7) % 4); // 3–6px
  const duration = 16 + ((i * 5) % 12); // 16–27s
  const delay = -((i * 3.3) % 24); // negative → already on screen
  return {
    left: Math.max(2, Math.min(97, left)),
    size,
    duration,
    delay,
    background: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
  };
});

export default function Home() {
  return (
    <main
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      {/* Animated gradient mesh background */}
      <div className="gradient-bg" aria-hidden="true">
        <div className="noise" />
        <div className="gradient-bg-orb3" />
        {/* Floating particles across the whole page */}
        <div className="particles">
          {PARTICLES.map((p, i) => (
            <span
              key={i}
              className="particle"
              style={{
                left: `${p.left}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                background: p.background,
                animationDuration: `${p.duration}s`,
                animationDelay: `${p.delay}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Preloader → Chat */}
      <ExperienceShell />
    </main>
  );
}
