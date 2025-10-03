import {
  hierarchy,
  treemap,
  treemapSquarify,
  HierarchyNode,
  HierarchyRectangularNode,
} from 'd3-hierarchy';
import { NodeDatum } from '@/types';

export function buildTreemapLayout(
  rootData: NodeDatum,
  width: number,
  height: number
): HierarchyRectangularNode<NodeDatum> {
  const root: HierarchyNode<NodeDatum> = hierarchy(rootData)
    .sum((d) => {
      const marketCap = d.data?.marketCap ?? 0;
      return marketCap > 0 ? Math.pow(marketCap, 0.7) : 0;
    })
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  const layout = treemap<NodeDatum>()
    .tile(treemapSquarify.ratio(1.1))
    .size([width, height])
    .paddingInner(2)
    .paddingOuter(4)
    .paddingTop((node) => (node.depth === 1 ? 28 : 0));

  return layout(root);
}
