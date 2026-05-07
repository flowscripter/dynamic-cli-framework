import type TreePrinterService from "../../api/service/core/TreePrinterService.ts";
import type { TreeNode } from "../../api/service/core/TreePrinterService.ts";

const DEFAULT_NODE_COLOR = "#839496";

export default class DefaultTreePrinterService implements TreePrinterService {
  colorEnabled = true;
  colorFunction: (text: string, hexFormattedColor: string) => string = (text) =>
    text;

  readonly #nodeColor: string;

  constructor(nodeColor: string = DEFAULT_NODE_COLOR) {
    this.#nodeColor = nodeColor;
  }

  #colorLabel(label: string): string {
    if (this.colorEnabled) {
      return this.colorFunction(label, this.#nodeColor);
    }
    return label;
  }

  #renderChildren(
    children: Array<TreeNode | string>,
    prefix: string,
    lines: string[],
  ): void {
    for (let i = 0; i < children.length; i++) {
      const child = children[i]!;
      const isLast = i === children.length - 1;
      const connector = isLast ? "└── " : "├── ";
      const extension = isLast ? "    " : "│   ";

      if (typeof child === "string") {
        lines.push(prefix + connector + this.#colorLabel(child));
      } else {
        lines.push(prefix + connector + this.#colorLabel(child.label));
        this.#renderChildren(child.children ?? [], prefix + extension, lines);
      }
    }
  }

  print(node: TreeNode): string {
    const lines: string[] = [this.#colorLabel(node.label)];
    this.#renderChildren(node.children ?? [], "", lines);
    return lines.join("\n");
  }
}
