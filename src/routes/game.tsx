import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/game")({
  head: () => ({
    meta: [
      { title: "Sweet Santa Hunt: New Year Vape Edition" },
      { name: "description", content: "Новогодняя игра LoveVape." },
    ],
  }),
  component: () => (
    <div style={{ position: "fixed", inset: 0, background: "#0b0b1a" }}>
      <iframe
        src="/game/index.html"
        title="Sweet Zombie Hunt"
        style={{ width: "100%", height: "100%", border: "none" }}
        allow="autoplay"
      />
    </div>
  ),
});
