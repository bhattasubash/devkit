// Paired React/TSX anti-slop fixture (modeled on AntiSlopUI slop-code-patterns)
export function SlopHero() {
  return (
    <div className="bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 p-[13px] rounded-3xl">
      <h1>Revolutionize your workflow with seamless AI magic</h1>
      <div className="grid grid-cols-3 gap-4">
        <div onClick={() => console.log('clicked')} className="transition-all backdrop-blur-md">
          <span>✨</span>
          <h2>Unlock the power</h2>
          <p>Next-generation automation.</p>
        </div>
      </div>
    </div>
  );
}
