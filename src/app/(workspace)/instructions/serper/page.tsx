import { InstructionPage } from "@/components/instruction-page";

export default function InstructionsSerperPage() {
  return (
    <InstructionPage
      badge="Instructions Serper"
      title="Create and save a Serper.dev API key."
      subtitle="This mirrors the original Serper setup guide."
      sections={[
        {
          title: "Account setup",
          bullets: [
            "Create a Serper.dev account and verify your email.",
            "Open the Serper dashboard and copy the API key from your account.",
          ],
        },
        {
          title: "Connect in the app",
          bullets: [
            "Open Settings in the Vercel app.",
            "Paste the key into the Serper field and save the SERP settings.",
            "Set Serper.dev as default if it is your main rank-check provider.",
          ],
        },
      ]}
    />
  );
}
