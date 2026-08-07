// Code-owned disclaimer, shared by both work surfaces. A model never writes,
// edits or omits this text.

export const DISCLAIMER_ZH =
  "本演示使用虚构保险产品与合成场景。AI 生成内容仅用于内部比较与知识辅助，不构成报价、保单演示、适合性判断、法律或税务意见，也不构成最终保险推荐。标注处需持牌保险经纪人审核。";

export const DISCLAIMER_EN =
  "Demo uses fictional insurance products and synthetic scenarios. AI-generated content is for internal comparison and knowledge assistance only. It is not a quote, policy illustration, suitability determination, legal or tax advice, or final insurance recommendation. Licensed-agent review is required where indicated.";

export function Disclaimer({ zh, en }: { zh?: string; en?: string } = {}) {
  return (
    <footer
      data-testid="demo-disclaimer"
      className="mt-4 border-t border-slate-200 pt-5 text-xs leading-relaxed text-slate-500"
    >
      <p>{zh ?? DISCLAIMER_ZH}</p>
      <p className="mt-2">{en ?? DISCLAIMER_EN}</p>
    </footer>
  );
}
