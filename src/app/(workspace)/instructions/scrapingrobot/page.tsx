import { InstructionPage } from "@/components/instruction-page";

export default function InstructionsScrapingRobotPage() {
  return (
    <InstructionPage
      badge="Instructions ScrapingRobot"
      title="Create and save a ScrapingRobot API key."
      subtitle="This mirrors the original ScrapingRobot instruction page."
      sections={[
        {
          title: "Get the key",
          bullets: [
            "Create or sign in to your ScrapingRobot account.",
            "Open the API section in your dashboard and copy the token.",
          ],
        },
        {
          title: "Connect in the app",
          bullets: [
            "Open Settings and paste the token into the ScrapingRobot field.",
            "Save the SERP settings.",
            "Use ScrapingRobot as a fallback provider when needed.",
          ],
        },
      ]}
    />
  );
}
