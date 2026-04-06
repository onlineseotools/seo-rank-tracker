import { Panel, PageIntro } from "@/components/ui";

export function InstructionPage({
  badge,
  title,
  subtitle,
  sections,
}: {
  badge: string;
  title: string;
  subtitle: string;
  sections: Array<{ title: string; description?: string; bullets: string[] }>;
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageIntro title={title} subtitle={subtitle} badge={badge} />
      {sections.map((section) => (
        <Panel key={section.title} kicker={badge} title={section.title} description={section.description}>
          <div className="grid gap-2">
            {section.bullets.map((bullet) => (
              <div key={bullet} className="panel-soft rounded-[18px] px-4 py-3 text-sm leading-7 text-[var(--muted)]">
                {bullet}
              </div>
            ))}
          </div>
        </Panel>
      ))}
    </div>
  );
}
