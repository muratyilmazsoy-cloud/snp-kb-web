"use client";

import { useEffect, useRef } from "react";

interface NeuralNetworkProps {
  width?: number;
  height?: number;
  nodeCount?: number;
  className?: string;
}

export default function NeuralNetwork({
  width = 800,
  height = 400,
  nodeCount = 80,
  className = "",
}: NeuralNetworkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Beyin seklinde node dagilimi (elipsoid)
    const cx = width / 2;
    const cy = height / 2;
    const rx = width * 0.38;
    const ry = height * 0.35;

    const nodes: {
      x: number;
      y: number;
      r: number;
      color: string;
      pulse: number;
      pulseSpeed: number;
    }[] = [];

    const colors = ["#10a37f", "#cc785c", "#6366f1", "#4285f4", "#22d3ee", "#0ea5e9", "#94a3b8", "#fbbf24"];

    for (let i = 0; i < nodeCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.pow(Math.random(), 0.6); // Merkeze dogru yogunlas
      const x = cx + Math.cos(angle) * rx * dist;
      const y = cy + Math.sin(angle) * ry * dist;
      nodes.push({
        x,
        y,
        r: 2 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.02 + Math.random() * 0.04,
      });
    }

    // Kenarlar
    const edges: { a: number; b: number }[] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 90) {
          edges.push({ a: i, b: j });
        }
      }
    }

    // Particle'lar (bilgi akisi)
    const particles: {
      edgeIndex: number;
      progress: number;
      speed: number;
      color: string;
    }[] = [];

    let frame = 0;
    let rafId: number;

    function animate() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      // Kenarlari ciz
      for (const e of edges) {
        const na = nodes[e.a];
        const nb = nodes[e.b];
        const alpha = 0.08 + Math.sin(frame * 0.01 + e.a) * 0.04;
        ctx.beginPath();
        ctx.moveTo(na.x, na.y);
        ctx.lineTo(nb.x, nb.y);
        ctx.strokeStyle = `rgba(74, 184, 255, ${alpha})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      // Node'lari ciz (parlama ile)
      for (const n of nodes) {
        n.pulse += n.pulseSpeed;
        const glow = 0.4 + Math.sin(n.pulse) * 0.3;

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = n.color + "30";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.globalAlpha = glow;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Parlama
        if (Math.sin(n.pulse) > 0.7) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r * 3, 0, Math.PI * 2);
          ctx.fillStyle = n.color + "15";
          ctx.fill();
        }
      }

      // Yeni particle olustur
      if (Math.random() < 0.15 && edges.length > 0) {
        const ei = Math.floor(Math.random() * edges.length);
        particles.push({
          edgeIndex: ei,
          progress: 0,
          speed: 0.01 + Math.random() * 0.02,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }

      // Particle'lari guncelle ve ciz
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.progress += p.speed;
        if (p.progress >= 1) {
          particles.splice(i, 1);
          continue;
        }
        const e = edges[p.edgeIndex];
        const na = nodes[e.a];
        const nb = nodes[e.b];
        const px = na.x + (nb.x - na.x) * p.progress;
        const py = na.y + (nb.y - na.y) * p.progress;

        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      frame++;
      rafId = requestAnimationFrame(animate);
    }

    animate();

    return () => cancelAnimationFrame(rafId);
  }, [width, height, nodeCount]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className={className}
    />
  );
}
