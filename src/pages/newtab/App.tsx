function App() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div
        className="rounded-[var(--radius-lg)] p-12 text-center"
        style={{
          background: 'rgba(255, 255, 255, 0.25)',
          backdropFilter: 'var(--blur-card)',
          WebkitBackdropFilter: 'var(--blur-card)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
        }}
      >
        <h1 className="text-5xl font-bold text-white drop-shadow-lg mb-4">
          Canopy
        </h1>
        <p className="text-lg text-white/80">
          你的标签，一目了然
        </p>
      </div>
    </div>
  );
}

export default App;
