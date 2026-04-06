import { InstructionPage } from "@/components/instruction-page";

export default function InstructionsGscPage() {
  return (
    <InstructionPage
      badge="Instructions GSC"
      title="Set up Google Search Console OAuth for the tracker."
      subtitle="These steps mirror the original instructions page, but are phrased for the new Vercel-hosted app."
      sections={[
        {
          title: "Prerequisites",
          bullets: [
            "Have access to the Google account that owns or can view the Search Console properties you need.",
            "Create or reuse a Google Cloud project for the SEO tool.",
          ],
        },
        {
          title: "Enable the API",
          bullets: [
            "Open the Search Console API in Google Cloud and enable it for your project.",
            "Configure an OAuth consent screen with your support email and app name.",
          ],
        },
        {
          title: "Create credentials",
          bullets: [
            "Create a web OAuth client for the Vercel deployment and add the callback URL /api/google/gsc/callback.",
            "Download the JSON and upload it in Settings under Google stack.",
            "Use Connect GSC in Settings to authorize the account and load verified properties.",
          ],
        },
      ]}
    />
  );
}
