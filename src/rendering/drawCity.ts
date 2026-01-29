import type { City, NodeId } from '../types/problem';

export interface DrawCityOptions {
  highlightedPath?: NodeId[];
  selectedNode?: NodeId;
  hoverNode?: NodeId;
  scale?: number;
}

export function drawCity(
  ctx: CanvasRenderingContext2D,
  city: City,
  options: DrawCityOptions = {}
): void {
  const { highlightedPath, selectedNode, hoverNode, scale = 1 } = options;
  const pathSet = new Set(highlightedPath || []);

  // Draw edges
  for (const edge of city.edges.values()) {
    const fromNode = city.nodes.get(edge.from);
    const toNode = city.nodes.get(edge.to);
    if (!fromNode || !toNode) continue;

    // Check if this edge is part of the highlighted path
    const isHighlighted =
      highlightedPath &&
      highlightedPath.length > 1 &&
      pathSet.has(edge.from) &&
      pathSet.has(edge.to);

    ctx.beginPath();
    ctx.moveTo(fromNode.x, fromNode.y);
    ctx.lineTo(toNode.x, toNode.y);

    if (isHighlighted) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 4 / scale;
    } else {
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 2 / scale;
    }

    ctx.stroke();
  }

  // Draw nodes (very subtle, 2px)
  for (const node of city.nodes.values()) {
    const isSelected = node.id === selectedNode;
    const isHover = node.id === hoverNode;
    const isPath = pathSet.has(node.id);

    // Only draw larger nodes if they're selected/hovered/in path
    if (isSelected || isHover || isPath) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, (isSelected || isHover ? 6 : 4) / scale, 0, Math.PI * 2);

      if (isSelected) {
        ctx.fillStyle = '#ef4444';
      } else if (isHover) {
        ctx.fillStyle = '#f97316';
      } else {
        ctx.fillStyle = '#3b82f6';
      }

      ctx.fill();
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 1 / scale;
      ctx.stroke();
    } else {
      // Subtle small dot for regular nodes
      ctx.beginPath();
      ctx.arc(node.x, node.y, 2 / scale, 0, Math.PI * 2);
      ctx.fillStyle = '#94a3b8';
      ctx.fill();
    }
  }
}

// Find node at position (for click detection)
export function findNodeAtPosition(
  city: City,
  x: number,
  y: number,
  threshold: number = 12
): NodeId | null {
  for (const node of city.nodes.values()) {
    const dx = node.x - x;
    const dy = node.y - y;
    if (dx * dx + dy * dy <= threshold * threshold) {
      return node.id;
    }
  }
  return null;
}
