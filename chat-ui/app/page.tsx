import ChatInterface from '@/components/ChatInterface';

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
      </div>

      {/* Chat interface */}
      <ChatInterface />
    </main>
  );
}
