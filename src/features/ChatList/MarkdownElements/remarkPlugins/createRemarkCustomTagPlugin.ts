import { SKIP, visit } from 'unist-util-visit';

import { treeNodeToString } from './getNodeContent';

export const createRemarkCustomTagPlugin = (tag: string) => () => {
  return (tree: any) => {
    visit(tree, 'html', (node, index, parent) => {
      if (node.value === `<${tag}>`) {
        const startIndex = index as number;
        let endIndex = startIndex + 1;
        let hasCloseTag = false;

        // 查找闭合标签
        while (endIndex < parent.children.length) {
          const sibling = parent.children[endIndex];
          if (sibling.type === 'html' && sibling.value === `</${tag}>`) {
            hasCloseTag = true;
            break;
          }
          endIndex++;
        }

        // 计算需要删除的节点范围
        const deleteCount = hasCloseTag
          ? endIndex - startIndex + 1
          : parent.children.length - startIndex;

        // 提取内容节点
        const contentNodes = parent.children.slice(
          startIndex + 1,
          hasCloseTag ? endIndex : undefined,
        );

        // 转换为 Markdown 字符串

        const content = treeNodeToString(contentNodes);

        // 创建自定义节点
        const customNode = {
          data: {
            hChildren: [{ type: 'text', value: content }],
            hName: tag,
          },
          position: node.position,
          type: `${tag}Block`,
        };

        // 替换原始节点
        parent.children.splice(startIndex, deleteCount, customNode);

        // 跳过已处理的节点
        return [SKIP, startIndex + 1];
      }
    });

    // Pass 2: Unwrap paragraphs containing block elements
    visit(tree, 'paragraph', (node, index, parent) => {
      const blockIndex = node.children.findIndex((child: any) => child.type === `${tag}Block`);

      if (blockIndex !== -1 && parent) {
        // Found a block node inside a paragraph
        const preChildren = node.children.slice(0, blockIndex);
        const blockNode = node.children[blockIndex];
        const postChildren = node.children.slice(blockIndex + 1);

        const newNodes = [];

        // Add pre-text paragraph if not empty
        if (preChildren.length > 0) {
          // Filter out purely whitespace text nodes if desired, or keep them.
          // Commonmark often trims, but safety first: check if meaningful.
          // For now, just create a paragraph.
          newNodes.push({
            children: preChildren,
            type: 'paragraph',
          });
        }

        // Add the block node directly (hoisted)
        newNodes.push(blockNode);

        // Add post-text paragraph if not empty
        if (postChildren.length > 0) {
          newNodes.push({
            children: postChildren,
            type: 'paragraph',
          });
        }

        // Replace the original paragraph with the new nodes in the parent
        parent.children.splice(index, 1, ...newNodes);

        // Return the new index to continue traversal correctly
        // We replaced 1 node with N nodes.
        // We want to skip the nodes we just inserted to avoid infinite loop (though they aren't paragraphs?)
        // Actually, we inserted a paragraph (pre), a block, and a paragraph (post).
        // We want to verify those new paragraphs?
        // If we revisit them, we might find OTHER blocks?
        // But for this specific block tag, we just handled it.
        // Let's safe skip them.
        return [SKIP, (index || 0) + newNodes.length];
      }
    });
  };
};
