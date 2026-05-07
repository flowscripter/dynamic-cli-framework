export const TREE_PRINTER_SERVICE_ID =
  "@flowscripter/dynamic-cli-framework/tree-printer-service";

export interface TreeNode {
  label: string;
  children?: Array<TreeNode | string>;
}

export default interface TreePrinterService {
  print(node: TreeNode): string;
}
